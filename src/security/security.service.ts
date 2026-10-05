import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SecurityIncident } from "../entities/security-incident.entity";
import { SecurityActorState } from "../entities/security-actor-state.entity";
import { User } from "../entities/user.entity";
import { TelegramService } from "../integrations/telegram.service";
import { SecurityPolicyService } from "./security-policy.service";
import { SettingsService } from "../settings/settings.service";
import {
  SecurityAction,
  SecurityFamily,
  SECURITY_FAMILY_LABELS,
  SECURITY_SETTINGS_DEFAULTS,
  SecuritySeverity,
} from "./security.constants";
import { SecurityQuotaService } from "./security-quota.service";
import { AdminNotificationsService } from "../admin/admin-notifications.service";
import { NotificationType } from "../entities/notification.entity";

type ActorType = "user" | "ip" | "mixed" | "anonymous";

type RequestFingerprint = {
  actorType: ActorType;
  actorKey: string;
  userId: number | null;
  userEmail: string | null;
  ip: string;
  userAgent: string | null;
  method: string;
  rawPath: string;
  normalizedRoute: string;
  queryString: string | null;
  exactEndpointKey: string;
  endpointFamily: SecurityFamily;
  targetType: string | null;
  targetValue: string | null;
};

type EvaluationResult = {
  scoreDelta: number;
  incidentType: string | null;
  severity: SecuritySeverity;
  action: SecurityAction;
  hitCountInWindow: number;
  distinctTargetCountInWindow: number;
  retryAfterSeconds: number;
  metadata: Record<string, any>;
};

const DAY_SECONDS = 86400;

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(
    @InjectRepository(SecurityIncident)
    private readonly incidentRepo: Repository<SecurityIncident>,
    @InjectRepository(SecurityActorState)
    private readonly actorStateRepo: Repository<SecurityActorState>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly policyService: SecurityPolicyService,
    private readonly settingsService: SettingsService,
    private readonly telegramService: TelegramService,
    private readonly securityQuotaService: SecurityQuotaService,
    private readonly adminNotificationsService: AdminNotificationsService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async evaluateContentRequest(input: {
    family: SecurityFamily;
    method: string;
    rawPath: string;
    normalizedRoute: string;
    queryString: string | null;
    exactEndpointKey: string;
    targetType?: string | null;
    targetValue?: string | null;
    userId?: number | null;
    userEmail?: string | null;
    ip: string;
    userAgent?: string | null;
  }) {
    const config = await this.policyService.getConfig();
    if (!config.enabled) {
      return;
    }

    const fingerprint = this.buildFingerprint(input);
    await this.assertNotLocked(fingerprint);

    const familyPolicy = config.families[fingerprint.endpointFamily];
    const hitCount = await this.incrementCounter(
      this.counterKey(fingerprint.actorKey, fingerprint.endpointFamily, "hits"),
      familyPolicy.windowSeconds,
    );

    const exactEndpointCount = await this.incrementCounter(
      this.counterKey(
        fingerprint.actorKey,
        fingerprint.endpointFamily,
        "exact",
        fingerprint.exactEndpointKey,
      ),
      familyPolicy.exactEndpointWindowSeconds,
    );

    const sameTargetCount = fingerprint.targetValue
      ? await this.incrementCounter(
          this.counterKey(
            fingerprint.actorKey,
            fingerprint.endpointFamily,
            "target",
            fingerprint.targetValue,
          ),
          familyPolicy.sameTargetWindowSeconds,
        )
      : 0;

    const distinctMinute = fingerprint.targetValue
      ? await this.trackDistinct(
          this.distinctKey(
            fingerprint.actorKey,
            fingerprint.endpointFamily,
            "minute",
          ),
          fingerprint.targetValue,
          60,
        )
      : 0;
    const distinctHour = fingerprint.targetValue
      ? await this.trackDistinct(
          this.distinctKey(
            fingerprint.actorKey,
            fingerprint.endpointFamily,
            "hour",
          ),
          fingerprint.targetValue,
          3600,
        )
      : 0;
    const distinctDay = fingerprint.targetValue
      ? await this.trackDistinct(
          this.distinctKey(fingerprint.actorKey, fingerprint.endpointFamily, "day"),
          fingerprint.targetValue,
          DAY_SECONDS,
        )
      : 0;

    const dailyFamilyCount = await this.incrementCounter(
      this.counterKey(fingerprint.actorKey, fingerprint.endpointFamily, "day"),
      DAY_SECONDS,
    );

    if (
      fingerprint.endpointFamily === "test_explanation" &&
      dailyFamilyCount > config.testExplanationDailyHardCap
    ) {
      await this.handleViolation(fingerprint, {
        scoreDelta: familyPolicy.scoreBurst,
        incidentType: "daily_hard_cap_explanation",
        severity: "critical",
        action: "content_lock",
        hitCountInWindow: dailyFamilyCount,
        distinctTargetCountInWindow: distinctDay,
        retryAfterSeconds: config.contentLockSeconds,
        metadata: { dailyFamilyCount, hardCap: config.testExplanationDailyHardCap },
      });
    }

    if (
      fingerprint.endpointFamily === "test_practice" &&
      dailyFamilyCount > config.testPracticeDailyHardCap
    ) {
      await this.handleViolation(fingerprint, {
        scoreDelta: familyPolicy.scoreBurst,
        incidentType: "daily_hard_cap_practice",
        severity: "critical",
        action: "content_lock",
        hitCountInWindow: dailyFamilyCount,
        distinctTargetCountInWindow: distinctDay,
        retryAfterSeconds: config.contentLockSeconds,
        metadata: { dailyFamilyCount, hardCap: config.testPracticeDailyHardCap },
      });
    }

    if (
      familyPolicy.exactEndpointMaxHits > 0 &&
      exactEndpointCount > familyPolicy.exactEndpointMaxHits
    ) {
      await this.handleViolation(fingerprint, {
        scoreDelta: familyPolicy.scoreExactEndpoint,
        incidentType: "exact_endpoint_spam",
        severity:
          fingerprint.endpointFamily === "library_article" ? "critical" : "high",
        action:
          fingerprint.endpointFamily === "library_article"
            ? "content_lock"
            : "content_cooldown",
        hitCountInWindow: exactEndpointCount,
        distinctTargetCountInWindow: distinctMinute,
        retryAfterSeconds:
          fingerprint.endpointFamily === "library_article"
            ? config.contentLockSeconds
            : config.cooldownSeconds,
        metadata: {
          exactEndpointMaxHits: familyPolicy.exactEndpointMaxHits,
          windowSeconds: familyPolicy.exactEndpointWindowSeconds,
        },
      });
    }

    if (hitCount > familyPolicy.maxHits) {
      await this.handleViolation(fingerprint, {
        scoreDelta: familyPolicy.scoreBurst,
        incidentType: "burst_hits",
        severity: "medium",
        action: "soft_throttle",
        hitCountInWindow: hitCount,
        distinctTargetCountInWindow: distinctMinute,
        retryAfterSeconds: config.cooldownSeconds,
        metadata: { maxHits: familyPolicy.maxHits, windowSeconds: familyPolicy.windowSeconds },
      });
    }

    if (
      fingerprint.targetValue &&
      familyPolicy.sameTargetMaxHits > 0 &&
      sameTargetCount > familyPolicy.sameTargetMaxHits
    ) {
      await this.handleViolation(fingerprint, {
        scoreDelta: familyPolicy.scoreSameTarget,
        incidentType: "same_target_spam",
        severity:
          fingerprint.endpointFamily === "library_article" ? "critical" : "high",
        action:
          fingerprint.endpointFamily === "library_article"
            ? "content_lock"
            : "content_cooldown",
        hitCountInWindow: sameTargetCount,
        distinctTargetCountInWindow: distinctMinute,
        retryAfterSeconds:
          fingerprint.endpointFamily === "library_article"
            ? config.contentLockSeconds
            : config.cooldownSeconds,
        metadata: {
          sameTargetMaxHits: familyPolicy.sameTargetMaxHits,
          windowSeconds: familyPolicy.sameTargetWindowSeconds,
        },
      });
    }

    if (
      (familyPolicy.distinctMinuteMax > 0 &&
        distinctMinute > familyPolicy.distinctMinuteMax) ||
      (familyPolicy.distinctHourMax > 0 &&
        distinctHour > familyPolicy.distinctHourMax) ||
      (familyPolicy.distinctDayMax > 0 &&
        distinctDay > familyPolicy.distinctDayMax)
    ) {
      await this.handleViolation(fingerprint, {
        scoreDelta: familyPolicy.scoreDistinct,
        incidentType: "distinct_target_crawl",
        severity: "high",
        action: "content_cooldown",
        hitCountInWindow: hitCount,
        distinctTargetCountInWindow: Math.max(distinctMinute, distinctHour, distinctDay),
        retryAfterSeconds: config.cooldownSeconds,
        metadata: {
          distinctMinute,
          distinctHour,
          distinctDay,
          minuteMax: familyPolicy.distinctMinuteMax,
          hourMax: familyPolicy.distinctHourMax,
          dayMax: familyPolicy.distinctDayMax,
        },
      });
    }
  }

  async listIncidents(params: {
    limit?: number;
    offset?: number;
    from?: string;
    to?: string;
    userId?: number;
    ip?: string;
    search?: string;
    severity?: string;
    incidentType?: string;
    actionTaken?: string;
    endpointFamily?: string;
  }) {
    const limit = Math.max(1, Math.min(params.limit ?? 100, 500));
    const offset = Math.max(0, params.offset ?? 0);
    const qb = this.incidentRepo
      .createQueryBuilder("incident")
      .leftJoin(User, "user", "user.id = incident.userId")
      .select([
        "incident.id AS id",
        "incident.userId AS \"userId\"",
        "user.name AS name",
        "user.email AS email",
        "incident.ip AS ip",
        "incident.endpointFamily AS \"endpointFamily\"",
        "incident.incidentType AS \"incidentType\"",
        "incident.severity AS severity",
        "incident.actionTaken AS \"actionTaken\"",
        "incident.exactEndpointKey AS \"exactEndpointKey\"",
        "incident.normalizedRoute AS \"normalizedRoute\"",
        "incident.hitCountInWindow AS \"hitCountInWindow\"",
        "incident.distinctTargetCountInWindow AS \"distinctTargetCountInWindow\"",
        "incident.lockDurationSeconds AS \"lockDurationSeconds\"",
        "incident.createdAt AS \"createdAt\"",
        "incident.updatedAt AS \"updatedAt\"",
      ])
      .orderBy("incident.updatedAt", "DESC")
      .take(limit)
      .skip(offset);

    if (params.from) {
      qb.andWhere("incident.createdAt >= :from", { from: new Date(params.from) });
    }

    if (params.to) {
      qb.andWhere("incident.createdAt <= :to", { to: new Date(params.to) });
    }

    if (params.userId) {
      qb.andWhere("incident.userId = :userId", { userId: params.userId });
    }

    if (params.ip) {
      qb.andWhere("incident.ip = :ip", { ip: params.ip });
    }

    if (params.search) {
      const search = `%${String(params.search).trim().toLowerCase()}%`;
      qb.andWhere(
        `(
          LOWER(COALESCE(user.name, '')) LIKE :search
          OR LOWER(COALESCE(user.email, '')) LIKE :search
          OR LOWER(COALESCE(incident.ip, '')) LIKE :search
          OR LOWER(COALESCE(incident.endpointFamily, '')) LIKE :search
          OR LOWER(COALESCE(incident.incidentType, '')) LIKE :search
          OR LOWER(COALESCE(incident.exactEndpointKey, '')) LIKE :search
          OR LOWER(COALESCE(incident.normalizedRoute, '')) LIKE :search
        )`,
        { search },
      );
    }

    if (params.severity) {
      qb.andWhere("LOWER(incident.severity) = :severity", {
        severity: String(params.severity).toLowerCase(),
      });
    }

    if (params.incidentType) {
      qb.andWhere("incident.incidentType = :incidentType", {
        incidentType: params.incidentType,
      });
    }

    if (params.actionTaken) {
      if (params.actionTaken === "none") {
        qb.andWhere("(incident.actionTaken IS NULL OR incident.actionTaken = '')");
      } else {
        qb.andWhere("incident.actionTaken = :actionTaken", {
          actionTaken: params.actionTaken,
        });
      }
    }

    if (params.endpointFamily) {
      qb.andWhere("incident.endpointFamily = :endpointFamily", {
        endpointFamily: params.endpointFamily,
      });
    }

    const [rows, total] = await Promise.all([
      qb.getRawMany(),
      qb.clone().skip(undefined).take(undefined).getCount(),
    ]);
    return { rows, total, limit, offset };
  }

  async listActorStates(limit = 100, offset = 0, lockedOnly = false) {
    const qb = this.actorStateRepo
      .createQueryBuilder("state")
      .orderBy("state.updatedAt", "DESC")
      .take(Math.max(1, Math.min(limit, 500)))
      .skip(Math.max(0, offset));

    if (lockedOnly) {
      qb.where(
        '(state.contentLockUntil IS NOT NULL AND state.contentLockUntil > NOW()) OR (state.cooldownUntil IS NOT NULL AND state.cooldownUntil > NOW())',
      );
    }

    const [rows, total] = await qb.getManyAndCount();
    return { rows, total, limit, offset };
  }

  async unlockActor(stateId: number, adminEmail: string) {
    const state = await this.actorStateRepo.findOne({ where: { id: stateId } });
    if (!state) {
      throw new ForbiddenException("Security actor state not found");
    }
    state.cooldownUntil = null;
    state.contentLockUntil = null;
    state.currentScore = 0;
    state.metadata = {
      ...(state.metadata || {}),
      manuallyUnlockedBy: adminEmail,
      manuallyUnlockedAt: new Date().toISOString(),
    };
    await this.actorStateRepo.save(state);
    await this.cacheManager.del(this.lockKey(state.actorKey, "cooldown"));
    await this.cacheManager.del(this.lockKey(state.actorKey, "content_lock"));
    return state;
  }

  private buildFingerprint(input: {
    family: SecurityFamily;
    method: string;
    rawPath: string;
    normalizedRoute: string;
    queryString: string | null;
    exactEndpointKey: string;
    targetType?: string | null;
    targetValue?: string | null;
    userId?: number | null;
    userEmail?: string | null;
    ip: string;
    userAgent?: string | null;
  }): RequestFingerprint {
    const userId = input.userId ?? null;
    const actorType: ActorType = userId ? "mixed" : "ip";
    const actorKey = userId ? `user:${userId}|ip:${input.ip}` : `ip:${input.ip}`;
    return {
      actorType,
      actorKey,
      userId,
      userEmail: input.userEmail ?? null,
      ip: input.ip,
      userAgent: input.userAgent ?? null,
      method: input.method.toUpperCase(),
      rawPath: input.rawPath.slice(0, 255),
      normalizedRoute: input.normalizedRoute.slice(0, 255),
      queryString: input.queryString ? input.queryString.slice(0, 1000) : null,
      exactEndpointKey: input.exactEndpointKey.slice(0, 255),
      endpointFamily: input.family,
      targetType: input.targetType ?? null,
      targetValue: input.targetValue ? String(input.targetValue).slice(0, 128) : null,
    };
  }

  private async assertNotLocked(fingerprint: RequestFingerprint) {
    const cooldown = await this.cacheManager.get<number>(
      this.lockKey(fingerprint.actorKey, "cooldown"),
    );
    if (cooldown && cooldown > Date.now()) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((cooldown - Date.now()) / 1000),
      );
      throw new HttpException(
        {
          statusCode: 423,
          error: "Locked",
          code: "SECURITY_CONTENT_COOLDOWN",
          retryAfterSeconds,
          lockReason: "suspicious scraping behavior detected",
        },
        423,
      );
    }

    const contentLock = await this.cacheManager.get<number>(
      this.lockKey(fingerprint.actorKey, "content_lock"),
    );
    if (contentLock && contentLock > Date.now()) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((contentLock - Date.now()) / 1000),
      );
      throw new HttpException(
        {
          statusCode: 423,
          error: "Locked",
          code: "SECURITY_CONTENT_LOCKED",
          retryAfterSeconds,
          lockReason: "content access temporarily locked due to repeated scraping",
        },
        423,
      );
    }
  }

  private async handleViolation(
    fingerprint: RequestFingerprint,
    result: EvaluationResult,
  ): Promise<never> {
    const policy = await this.policyService.getConfig();
    const actorState = await this.upsertActorState(fingerprint, result);
    const incident = await this.upsertIncident(fingerprint, result, actorState);
    await this.createAdminSecurityNotification(
      fingerprint,
      result,
      actorState,
      incident,
    );
    await this.maybeDeactivateForLibraryAbuse(
      fingerprint,
      actorState,
      incident,
      result,
    );

    if (policy.telegramAlertsEnabled) {
      void this.sendTelegramAlert(fingerprint, result, actorState, incident);
    }

    const retryAfterSeconds = Math.max(1, result.retryAfterSeconds);
    if (result.action === "soft_throttle") {
      throw new HttpException(
        {
          statusCode: 429,
          error: "Too Many Requests",
          code:
            result.incidentType === "exact_endpoint_spam"
              ? "SECURITY_SINGLE_TARGET_SPAM"
              : "RATE_LIMITED_CONTENT",
          retryAfterSeconds,
          exactEndpoint: fingerprint.exactEndpointKey,
          normalizedRoute: fingerprint.normalizedRoute,
          message: "Content access temporarily throttled due to suspicious activity.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    throw new HttpException(
      {
        statusCode: 423,
        error: "Locked",
        code:
          result.action === "content_lock"
            ? "SECURITY_CONTENT_LOCKED"
            : "SECURITY_CONTENT_COOLDOWN",
        retryAfterSeconds,
        exactEndpoint: fingerprint.exactEndpointKey,
        normalizedRoute: fingerprint.normalizedRoute,
        message:
          result.action === "content_lock"
            ? "Content access has been temporarily locked due to repeated suspicious activity."
            : "Content access is cooling down due to suspicious activity.",
      },
      423,
    );
  }

  private async upsertActorState(
    fingerprint: RequestFingerprint,
    result: EvaluationResult,
  ) {
    const policy = await this.policyService.getConfig();
    let state = await this.actorStateRepo.findOne({
      where: { actorKey: fingerprint.actorKey },
    });
    if (!state) {
      state = this.actorStateRepo.create({
        actorType: fingerprint.actorType,
        actorKey: fingerprint.actorKey,
        userId: fingerprint.userId,
        ip: fingerprint.ip,
        userAgent: fingerprint.userAgent,
      });
    }

    const multiplier = Math.max(1, policy.repeatOffenseMultiplier || 1);
    const effectiveScore =
      result.scoreDelta * Math.max(1, state.strikeCount || 0 ? multiplier : 1);
    state.currentScore = Math.max(0, Number(state.currentScore || 0) + effectiveScore);
    state.strikeCount = Number(state.strikeCount || 0) + 1;
    state.lastIncidentAt = new Date();
    state.lastRawPath = fingerprint.rawPath;
    state.lastNormalizedRoute = fingerprint.normalizedRoute;
    state.lastExactEndpointKey = fingerprint.exactEndpointKey;
    state.metadata = {
      ...(state.metadata || {}),
      latestIncidentType: result.incidentType,
      latestSeverity: result.severity,
      latestAction: result.action,
      hitCountInWindow: result.hitCountInWindow,
      distinctTargetCountInWindow: result.distinctTargetCountInWindow,
    };

    const now = Date.now();
    if (result.action === "content_cooldown") {
      state.cooldownUntil = new Date(now + result.retryAfterSeconds * 1000);
      await this.cacheManager.set(
        this.lockKey(fingerprint.actorKey, "cooldown"),
        state.cooldownUntil.getTime(),
        result.retryAfterSeconds * 1000,
      );
    } else if (result.action === "content_lock") {
      state.contentLockUntil = new Date(now + result.retryAfterSeconds * 1000);
      await this.cacheManager.set(
        this.lockKey(fingerprint.actorKey, "content_lock"),
        state.contentLockUntil.getTime(),
        result.retryAfterSeconds * 1000,
      );
    }

    return this.actorStateRepo.save(state);
  }

  private async upsertIncident(
    fingerprint: RequestFingerprint,
    result: EvaluationResult,
    actorState: SecurityActorState,
  ) {
    const policy = await this.policyService.getConfig();
    const since = new Date(Date.now() - policy.aggregationWindowSeconds * 1000);
    const existing = await this.incidentRepo.findOne({
      where: {
        actorKey: fingerprint.actorKey,
        endpointFamily: fingerprint.endpointFamily,
        incidentType: result.incidentType || "unknown",
      },
      order: { updatedAt: "DESC" },
    });

    const sampleEndpoints = [
      fingerprint.exactEndpointKey,
      ...(((existing?.metadata?.sampleEndpoints as string[]) || []).filter(
        (value) => value !== fingerprint.exactEndpointKey,
      )),
    ].slice(0, 10);

    if (existing && existing.updatedAt >= since) {
      existing.userId = fingerprint.userId;
      existing.userAgent = fingerprint.userAgent;
      existing.rawPath = fingerprint.rawPath;
      existing.normalizedRoute = fingerprint.normalizedRoute;
      existing.queryString = fingerprint.queryString;
      existing.exactEndpointKey = fingerprint.exactEndpointKey;
      existing.targetType = fingerprint.targetType;
      existing.targetValue = fingerprint.targetValue;
      existing.severity = result.severity;
      existing.scoreDelta += result.scoreDelta;
      existing.cumulativeScore = actorState.currentScore;
      existing.actionTaken = result.action;
      existing.hitCountInWindow = result.hitCountInWindow;
      existing.distinctTargetCountInWindow = result.distinctTargetCountInWindow;
      existing.lockDurationSeconds = result.retryAfterSeconds;
      existing.metadata = {
        ...(existing.metadata || {}),
        ...result.metadata,
        sampleEndpoints,
        latestExactEndpoint: fingerprint.exactEndpointKey,
      };
      return this.incidentRepo.save(existing);
    }

    const incident = this.incidentRepo.create({
      actorType: fingerprint.actorType,
      actorKey: fingerprint.actorKey,
      userId: fingerprint.userId,
      ip: fingerprint.ip,
      userAgent: fingerprint.userAgent,
      rawPath: fingerprint.rawPath,
      normalizedRoute: fingerprint.normalizedRoute,
      method: fingerprint.method,
      queryString: fingerprint.queryString,
      endpointFamily: fingerprint.endpointFamily,
      targetType: fingerprint.targetType,
      targetValue: fingerprint.targetValue,
      exactEndpointKey: fingerprint.exactEndpointKey,
      incidentType: result.incidentType || "unknown",
      severity: result.severity,
      scoreDelta: result.scoreDelta,
      cumulativeScore: actorState.currentScore,
      actionTaken: result.action,
      hitCountInWindow: result.hitCountInWindow,
      distinctTargetCountInWindow: result.distinctTargetCountInWindow,
      lockDurationSeconds: result.retryAfterSeconds,
      metadata: {
        ...result.metadata,
        sampleEndpoints,
        latestExactEndpoint: fingerprint.exactEndpointKey,
      },
    });
    return this.incidentRepo.save(incident);
  }

  private async sendTelegramAlert(
    fingerprint: RequestFingerprint,
    result: EvaluationResult,
    actorState: SecurityActorState,
    incident: SecurityIncident,
  ) {
    const policy = await this.policyService.getConfig();
    const severityOrder: SecuritySeverity[] = [
      "low",
      "medium",
      "high",
      "critical",
    ];
    if (
      severityOrder.indexOf(result.severity) <
      severityOrder.indexOf(policy.telegramMinSeverity)
    ) {
      return;
    }

    const cooldownKey = `security:telegram:${fingerprint.actorKey}:${result.incidentType}`;
    const existing = await this.cacheManager.get(cooldownKey);
    if (existing) {
      return;
    }
    await this.cacheManager.set(
      cooldownKey,
      true,
      policy.telegramAlertCooldownSeconds * 1000,
    );

    let userEmail = fingerprint.userEmail;
    if (!userEmail && fingerprint.userId) {
      const user = await this.userRepo.findOne({
        where: { id: fingerprint.userId },
        select: ["id", "email"],
      });
      userEmail = user?.email || null;
    }

    try {
      await this.telegramService.sendAdminSecurityAlert({
        severity: result.severity,
        userId: fingerprint.userId,
        userEmail,
        ip: fingerprint.ip,
        endpointFamily: fingerprint.endpointFamily,
        endpointLabel: SECURITY_FAMILY_LABELS[fingerprint.endpointFamily],
        exactEndpoint: fingerprint.exactEndpointKey,
        normalizedRoute: fingerprint.normalizedRoute,
        targetValue: fingerprint.targetValue,
        incidentType: result.incidentType || "unknown",
        actionTaken: result.action,
        scoreDelta: result.scoreDelta,
        cumulativeScore: actorState.currentScore,
        hitCountInWindow: result.hitCountInWindow,
        distinctTargetCountInWindow: result.distinctTargetCountInWindow,
        lockDurationSeconds: result.retryAfterSeconds,
        incidentId: incident.id,
      });
    } catch (error) {
      this.logger.warn(`Failed to send security Telegram alert: ${error}`);
    }
  }

  private async createAdminSecurityNotification(
    fingerprint: RequestFingerprint,
    result: EvaluationResult,
    actorState: SecurityActorState,
    incident: SecurityIncident,
  ) {
    let userEmail = fingerprint.userEmail;
    if (!userEmail && fingerprint.userId) {
      const user = await this.userRepo.findOne({
        where: { id: fingerprint.userId },
        select: ["id", "email"],
      });
      userEmail = user?.email || null;
    }

    const actorLabel =
      userEmail || (fingerprint.userId ? `User #${fingerprint.userId}` : fingerprint.ip);
    const severityLabel = String(result.severity || "medium").toUpperCase();
    const actionLabel =
      result.action === "content_lock"
        ? "content lock"
        : result.action === "content_cooldown"
          ? "cooldown"
          : "throttle";

    try {
      await this.adminNotificationsService.createAdminNotification({
        title: `Security ${severityLabel}: ${SECURITY_FAMILY_LABELS[fingerprint.endpointFamily]}`,
        message: `${actorLabel} triggered ${result.incidentType || "security incident"} on ${fingerprint.exactEndpointKey} and received a ${actionLabel}.`,
        type: NotificationType.WARNING,
        userId: fingerprint.userId,
        metadata: {
          category: "security",
          alertType: "protected_content_incident",
          incidentId: incident.id,
          actorKey: fingerprint.actorKey,
          endpointFamily: fingerprint.endpointFamily,
          severity: result.severity,
          incidentType: result.incidentType,
          actionTaken: result.action,
          exactEndpoint: fingerprint.exactEndpointKey,
          normalizedRoute: fingerprint.normalizedRoute,
          ip: fingerprint.ip,
          userEmail,
          hitCountInWindow: result.hitCountInWindow,
          distinctTargetCountInWindow: result.distinctTargetCountInWindow,
          strikeCount: actorState.strikeCount,
          cumulativeScore: actorState.currentScore,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to create admin security notification: ${error}`);
    }
  }

  private async maybeDeactivateForLibraryAbuse(
    fingerprint: RequestFingerprint,
    actorState: SecurityActorState,
    incident: SecurityIncident,
    result: EvaluationResult,
  ) {
    if (
      fingerprint.endpointFamily !== "library_article" ||
      !fingerprint.userId ||
      (result.action !== "content_cooldown" && result.action !== "content_lock")
    ) {
      return;
    }

    if (
      result.incidentType !== "exact_endpoint_spam" &&
      result.incidentType !== "distinct_target_crawl"
    ) {
      return;
    }

    const enabled = await this.getBoolean(
      "SECURITY_LIBRARY_ABUSE_AUTO_DEACTIVATE_ENABLED",
    );
    const strikeThreshold = await this.getNumber(
      "SECURITY_LIBRARY_ABUSE_STRIKE_THRESHOLD",
    );
    if (!enabled || strikeThreshold <= 0 || actorState.strikeCount < strikeThreshold) {
      return;
    }

    const severeExactEndpointHits = await this.getNumber(
      "SECURITY_LIBRARY_ABUSE_SEVERE_EXACT_ENDPOINT_HITS",
    );
    const severeDistinctMinuteHits = await this.getNumber(
      "SECURITY_LIBRARY_ABUSE_SEVERE_DISTINCT_MINUTE_HITS",
    );
    const clearlyAbusive =
      (result.incidentType === "exact_endpoint_spam" &&
        result.hitCountInWindow >= Math.max(severeExactEndpointHits, 1)) ||
      (result.incidentType === "distinct_target_crawl" &&
        result.distinctTargetCountInWindow >= Math.max(severeDistinctMinuteHits, 1));

    if (!clearlyAbusive) {
      return;
    }

    await this.securityQuotaService.deactivateUserForSecurity({
      userId: fingerprint.userId,
      ip: fingerprint.ip,
      reason: `Library abuse threshold reached (${result.incidentType || "unknown"})`,
      sourceType: "library_abuse",
      sourceId: incident.id,
    });
  }

  private lockKey(actorKey: string, type: "cooldown" | "content_lock") {
    return `security:lock:${type}:${actorKey}`;
  }

  private counterKey(
    actorKey: string,
    family: SecurityFamily,
    kind: string,
    suffix?: string,
  ) {
    return `security:counter:${actorKey}:${family}:${kind}:${suffix || "base"}`;
  }

  private distinctKey(
    actorKey: string,
    family: SecurityFamily,
    bucket: "minute" | "hour" | "day",
  ) {
    return `security:distinct:${actorKey}:${family}:${bucket}`;
  }

  private async incrementCounter(key: string, ttlSeconds: number) {
    const current = (await this.cacheManager.get<number>(key)) || 0;
    const next = Number(current) + 1;
    await this.cacheManager.set(key, next, ttlSeconds * 1000);
    return next;
  }

  private async trackDistinct(key: string, value: string, ttlSeconds: number) {
    const current = (await this.cacheManager.get<string[]>(key)) || [];
    if (!current.includes(value)) {
      current.push(value);
      await this.cacheManager.set(key, current.slice(-500), ttlSeconds * 1000);
    }
    return current.length;
  }

  private async getBoolean(key: keyof typeof SECURITY_SETTINGS_DEFAULTS) {
    const raw = await this.settingsService.getString(
      key,
      SECURITY_SETTINGS_DEFAULTS[key],
    );
    return String(raw).toLowerCase() === "true";
  }

  private async getNumber(key: keyof typeof SECURITY_SETTINGS_DEFAULTS) {
    return this.settingsService.getNumber(
      key,
      Number(SECURITY_SETTINGS_DEFAULTS[key]),
    );
  }
}
