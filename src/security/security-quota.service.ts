import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Test } from "../entities/test.entity";
import {
  SubscriptionPlan,
  User,
  UserRole,
} from "../entities/user.entity";
import { UserQuotaCounter } from "../entities/user-quota-counter.entity";
import { SecurityIncident } from "../entities/security-incident.entity";
import { SettingsService } from "../settings/settings.service";
import { TelegramService } from "../integrations/telegram.service";
import { BlockedIpService } from "./ip-block.service";
import { SECURITY_SETTINGS_DEFAULTS } from "./security.constants";
import { authUserCacheKey } from "../cache/cache-keys.util";
import { AdminNotificationsService } from "../admin/admin-notifications.service";
import { NotificationType } from "../entities/notification.entity";

@Injectable()
export class SecurityQuotaService {
  constructor(
    @InjectRepository(Test)
    private readonly testRepo: Repository<Test>,
    @InjectRepository(UserQuotaCounter)
    private readonly quotaRepo: Repository<UserQuotaCounter>,
    @InjectRepository(SecurityIncident)
    private readonly incidentRepo: Repository<SecurityIncident>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly settingsService: SettingsService,
    private readonly telegramService: TelegramService,
    private readonly blockedIpService: BlockedIpService,
    private readonly adminNotificationsService: AdminNotificationsService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async assertCanCreateTest(input: {
    user: User;
    ip: string;
    userAgent?: string | null;
    path: string;
  }) {
    const user = input.user;
    if (this.isSuperAdmin(user)) {
      return;
    }
    const roleScope = await this.getString(
      "SECURITY_TEST_PROTECTION_ROLE_SCOPE",
    );
    if (!this.roleMatches(user.role, roleScope)) {
      return;
    }

    await this.assertNoActiveTestContentRestriction(user.id, input.ip);

    if (user.subscriptionPlan === SubscriptionPlan.FREE) {
      const totalCap = await this.getNumber("SECURITY_FREE_USER_TOTAL_TEST_CAP");
      if (totalCap > 0) {
        // Query current active tests
        const activeTests = await this.testRepo.count({
          where: { userId: user.id },
        });

        // Query historical tests created from quota counters
        const quotaResult = await this.quotaRepo
          .createQueryBuilder("q")
          .select("SUM(q.count)", "total")
          .where("q.userId = :userId", { userId: user.id })
          .andWhere("q.quotaType = 'tests_created'")
          .getRawOne();
        const historicalTests = Number(quotaResult?.total || 0);

        // Prevent quota bypass by deleting tests: use whichever is higher
        const totalTests = Math.max(activeTests, historicalTests);

        if (totalTests >= totalCap) {
          const dayBucket = this.getDayBucket();
          await this.maybeRecordFreeLifetimeTestCapReached(
            input,
            totalCap,
            totalTests,
            dayBucket,
          );
          const freeCapSpam = await this.bumpFreeLifetimeCapSpam(
            input,
            totalCap,
            totalTests,
          );
          if (freeCapSpam) {
            throw freeCapSpam;
          }
          throw new HttpException(
            {
              statusCode: 403,
              code: "SECURITY_TEST_TOTAL_CAP_REACHED",
              message: "Free account test limit reached.",
              limit: totalCap,
            },
            HttpStatus.FORBIDDEN,
          );
        }
      }
    }

    const dayBucket = this.getDayBucket();
    const counter = await this.quotaRepo.findOne({
      where: { userId: user.id, quotaType: "tests_created", dayBucket },
    });
    const dailyCap = await this.getNumber("SECURITY_ALL_USER_DAILY_TEST_CAP");
    if (dailyCap > 0 && Number(counter?.count || 0) >= dailyCap) {
      await this.maybeRecordDailyTestCapReached(input, dailyCap, dayBucket, Number(counter?.count || 0));
      const dailyCapSpam = await this.bumpDailyCapSpam(input, dailyCap);
      if (dailyCapSpam) {
        throw dailyCapSpam;
      }

      throw new HttpException(
        {
          statusCode: 403,
          code: "SECURITY_DAILY_TEST_CAP_REACHED",
          message: "Daily test creation limit reached.",
          limit: dailyCap,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const testAbuse = await this.bumpCreateTestBurst(input);
    if (testAbuse) {
      throw testAbuse;
    }
  }

  async recordCreatedTest(userId: number) {
    const dayBucket = this.getDayBucket();
    let counter = await this.quotaRepo.findOne({
      where: { userId, quotaType: "tests_created", dayBucket },
    });
    if (!counter) {
      counter = this.quotaRepo.create({
        userId,
        quotaType: "tests_created",
        dayBucket,
        count: 0,
        distinctTargetCount: 0,
      });
    }
    counter.count = Number(counter.count || 0) + 1;
    counter.firstHitAt = counter.firstHitAt || new Date();
    counter.lastHitAt = new Date();
    await this.quotaRepo.save(counter);
  }

  async assertAndRecordLibraryArticleView(input: {
    user: User;
    articleId: number | string;
    ip: string;
    userAgent?: string | null;
    path: string;
  }) {
    if (this.isSuperAdmin(input.user)) {
      return;
    }
    if (input.user.subscriptionPlan !== SubscriptionPlan.FREE) {
      return;
    }
    const roleScope = await this.getString(
      "SECURITY_TEST_PROTECTION_ROLE_SCOPE",
    );
    if (!this.roleMatches(input.user.role, roleScope)) {
      return;
    }

    const cap = await this.getNumber("SECURITY_FREE_LIBRARY_DAILY_ARTICLE_CAP");
    if (cap <= 0) {
      return;
    }

    const uniqueOnly = await this.getBoolean("SECURITY_LIBRARY_QUOTA_COUNT_UNIQUE_ONLY");
    const dayBucket = this.getDayBucket();
    let counter = await this.quotaRepo.findOne({
      where: { userId: input.user.id, quotaType: "library_unique_articles", dayBucket },
    });

    if (!counter) {
      counter = this.quotaRepo.create({
        userId: input.user.id,
        quotaType: "library_unique_articles",
        dayBucket,
        count: 0,
        distinctTargetCount: 0,
        metadata: { articleIds: [] },
      });
    }

    const metadata = (counter.metadata || {}) as Record<string, any>;
    const articleIds = Array.isArray(metadata.articleIds)
      ? metadata.articleIds.map((value: any) => String(value))
      : [];
    const articleKey = String(input.articleId);
    const alreadyCounted = articleIds.includes(articleKey);

    if ((!uniqueOnly || !alreadyCounted) && Number(counter.count || 0) >= cap) {
      await this.recordIncident({
        endpointFamily: "library_article",
        user: input.user,
        ip: input.ip,
        userAgent: input.userAgent,
        rawPath: input.path,
        normalizedRoute: "/library/article/:id",
        exactEndpointKey: `GET:${input.path}`,
        incidentType: "free_library_daily_cap_reached",
        severity: "high",
        actionTaken: "quota_block",
        targetType: "article",
        targetValue: articleKey,
        hitCountInWindow: Number(counter.count || 0),
        distinctTargetCountInWindow: Number(counter.distinctTargetCount || 0),
        metadata: { cap, uniqueOnly },
        notifyTelegram: true,
      });
      throw new HttpException(
        {
          statusCode: 403,
          code: "SECURITY_LIBRARY_DAILY_CAP_REACHED",
          message: "Daily library article limit reached for this free account.",
          limit: cap,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    if (!uniqueOnly || !alreadyCounted) {
      counter.count = Number(counter.count || 0) + 1;
      counter.distinctTargetCount = Number(counter.distinctTargetCount || 0) + 1;
      metadata.articleIds = Array.from(new Set([...articleIds, articleKey])).slice(-500);
    }
    counter.metadata = metadata;
    counter.firstHitAt = counter.firstHitAt || new Date();
    counter.lastHitAt = new Date();
    await this.quotaRepo.save(counter);
  }

  async listQuotaUsage(limit = 100, offset = 0) {
    const [rows, total] = await this.quotaRepo.findAndCount({
      order: { updatedAt: "DESC" },
      take: Math.max(1, Math.min(limit, 500)),
      skip: Math.max(0, offset),
    });
    return { rows, total, limit, offset };
  }

  async deactivateUserForSecurity(input: {
    userId: number;
    ip: string;
    reason: string;
    sourceType: string;
    sourceId?: number | null;
  }) {
    const roleScope = await this.getString("SECURITY_AUTO_DEACTIVATE_ROLE_SCOPE");
    const user = await this.userRepo.findOne({ where: { id: input.userId } });
    if (!user || !user.isActive || !this.roleMatches(user.role, roleScope)) {
      return user;
    }

    user.isActive = false;
    await this.userRepo.save(user);
    await this.cacheManager.del(authUserCacheKey(user.id));

    const accountIncident = await this.recordIncident({
      endpointFamily: input.sourceType === "library_abuse" ? "library_article" : "test_creation",
      user,
      ip: input.ip,
      rawPath: input.sourceType,
      normalizedRoute: input.sourceType,
      exactEndpointKey: input.sourceType,
      incidentType: "account_auto_deactivated",
      severity: "critical",
      actionTaken: "account_deactivated",
      targetType: "user",
      targetValue: String(user.id),
      metadata: { reason: input.reason },
      notifyTelegram: false,
    });

    let ipBlocked = false;
    let ipBlockIncident: SecurityIncident | null = null;
    if (
      (await this.blockedIpService.isBlockingEnabled()) &&
      (await this.blockedIpService.shouldBlockIpOnDeactivation())
    ) {
      await this.blockedIpService.blockIp({
        ip: input.ip,
        reason: input.reason,
        linkedUserId: user.id,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        blockedBy: "security_automation",
      });

      ipBlocked = true;
      ipBlockIncident = await this.recordIncident({
        endpointFamily: "ip_blocking",
        user,
        ip: input.ip,
        rawPath: input.sourceType,
        normalizedRoute: input.sourceType,
        exactEndpointKey: input.sourceType,
        incidentType: "ip_auto_blocked",
        severity: "critical",
        actionTaken: "ip_blocked",
        targetType: "ip",
        targetValue: input.ip,
        metadata: { reason: input.reason },
        notifyTelegram: false,
      });
    }

    try {
      await this.telegramService.sendAdminSecurityEscalationAlert({
        userId: user.id,
        userEmail: user.email || null,
        ip: input.ip,
        sourceType: input.sourceType,
        reason: input.reason,
        accountIncidentId: accountIncident.id,
        ipBlocked,
        ipBlockIncidentId: ipBlockIncident?.id ?? null,
      });
    } catch {
      // never block security enforcement if telegram fails
    }

    return user;
  }

  private async bumpCreateTestBurst(input: {
    user: User;
    ip: string;
    userAgent?: string | null;
    path: string;
  }) {
    const windowSeconds = await this.getNumber(
      "SECURITY_TEST_CREATION_ABUSE_WINDOW_SECONDS",
    );
    const maxHits = await this.getNumber("SECURITY_TEST_CREATION_ABUSE_MAX_HITS");
    if (windowSeconds <= 0 || maxHits <= 0) {
      return null;
    }

    const key = `security:test-create:${input.user.id}:${input.ip}`;
    const current = (await this.cacheManager.get<number>(key)) || 0;
    const next = Number(current) + 1;
    await this.cacheManager.set(key, next, windowSeconds * 1000);

    if (next <= maxHits) {
      return null;
    }

    const threshold = await this.getNumber(
      "SECURITY_TEST_CREATION_ABUSE_STRIKE_THRESHOLD",
    );
    const autoDeactivate = await this.getBoolean(
      "SECURITY_TEST_CREATION_AUTO_DEACTIVATE_ENABLED",
    );
    const strikesKey = `${key}:strikes`;
    const strikes = ((await this.cacheManager.get<number>(strikesKey)) || 0) + 1;
    await this.cacheManager.set(strikesKey, strikes, 86_400_000);

    await this.recordIncident({
      endpointFamily: "test_creation",
      user: input.user,
      ip: input.ip,
      userAgent: input.userAgent,
      rawPath: input.path,
      normalizedRoute: "/tests",
      exactEndpointKey: `POST:${input.path}`,
      incidentType: "test_creation_spam",
      severity: strikes >= threshold ? "critical" : "high",
      actionTaken:
        strikes >= threshold && autoDeactivate
          ? "account_deactivated"
          : "quota_block",
      targetType: "user",
      targetValue: String(input.user.id),
      hitCountInWindow: next,
      distinctTargetCountInWindow: 0,
      metadata: { windowSeconds, maxHits, strikes, threshold },
      notifyTelegram: true,
    });

    if (strikes >= threshold && autoDeactivate) {
      await this.deactivateUserForSecurity({
        userId: input.user.id,
        ip: input.ip,
        reason: "Repeated test creation abuse threshold breaches",
        sourceType: "test_creation_abuse",
      });
    }

    return new HttpException(
      {
        statusCode: 429,
        code: "SECURITY_TEST_CREATION_SPAM",
        message: "Too many test creation requests.",
        retryAfterSeconds: windowSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async bumpDailyCapSpam(
    input: {
      user: User;
      ip: string;
      userAgent?: string | null;
      path: string;
    },
    dailyCap: number,
  ) {
    const windowSeconds = await this.getNumber(
      "SECURITY_DAILY_TEST_CAP_SPAM_WINDOW_SECONDS",
    );
    const threshold = await this.getNumber(
      "SECURITY_DAILY_TEST_CAP_SPAM_THRESHOLD",
    );
    if (windowSeconds <= 0 || threshold <= 0) {
      return null;
    }

    const key = `security:test-create-daily-cap:${input.user.id}:${input.ip}`;
    const current = (await this.cacheManager.get<number>(key)) || 0;
    const next = Number(current) + 1;
    await this.cacheManager.set(key, next, windowSeconds * 1000);

    if (next <= threshold) {
      return null;
    }

    await this.recordIncident({
      endpointFamily: "test_creation",
      user: input.user,
      ip: input.ip,
      userAgent: input.userAgent,
      rawPath: input.path,
      normalizedRoute: "/tests",
      exactEndpointKey: `POST:${input.path}`,
      incidentType: "daily_test_cap_spam",
      severity: "critical",
      actionTaken: "account_deactivated",
      targetType: "user",
      targetValue: String(input.user.id),
      hitCountInWindow: next,
      distinctTargetCountInWindow: 0,
      lockDurationSeconds: windowSeconds,
      metadata: { dailyCap, threshold, windowSeconds },
      notifyTelegram: true,
    });

    await this.deactivateUserForSecurity({
      userId: input.user.id,
      ip: input.ip,
      reason: "Repeated test creation attempts after hitting the daily cap",
      sourceType: "daily_test_cap_spam",
    });

    return new HttpException(
      {
        statusCode: 429,
        code: "SECURITY_TEST_CREATION_SPAM",
        message: "Too many test creation requests.",
        retryAfterSeconds: windowSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async maybeRecordFreeLifetimeTestCapReached(
    input: {
      user: User;
      ip: string;
      userAgent?: string | null;
      path: string;
    },
    totalCap: number,
    totalTests: number,
    dayBucket: string,
  ) {
    const cacheKey = `security:free-test-cap-reached:${input.user.id}:${dayBucket}`;
    const existing = await this.cacheManager.get(cacheKey);
    if (existing) {
      return;
    }

    await this.cacheManager.set(cacheKey, true, 24 * 60 * 60 * 1000);
    await this.recordIncident({
      endpointFamily: "test_creation",
      user: input.user,
      ip: input.ip,
      userAgent: input.userAgent,
      rawPath: input.path,
      normalizedRoute: "/tests",
      exactEndpointKey: `POST:${input.path}`,
      incidentType: "free_lifetime_test_cap_reached",
      severity: "high",
      actionTaken: "quota_block",
      targetType: "user",
      targetValue: String(input.user.id),
      hitCountInWindow: totalTests,
      distinctTargetCountInWindow: 0,
      metadata: { totalCap, totalTests, dayBucket },
      notifyTelegram: true,
    });
  }

  private async bumpFreeLifetimeCapSpam(
    input: {
      user: User;
      ip: string;
      userAgent?: string | null;
      path: string;
    },
    totalCap: number,
    totalTests: number,
  ) {
    const windowSeconds = await this.getNumber(
      "SECURITY_DAILY_TEST_CAP_SPAM_WINDOW_SECONDS",
    );
    const threshold = await this.getNumber(
      "SECURITY_DAILY_TEST_CAP_SPAM_THRESHOLD",
    );
    if (windowSeconds <= 0 || threshold <= 0) {
      return null;
    }

    const key = `security:free-test-cap-spam:${input.user.id}:${input.ip}`;
    const current = (await this.cacheManager.get<number>(key)) || 0;
    const next = Number(current) + 1;
    await this.cacheManager.set(key, next, windowSeconds * 1000);

    if (next <= threshold) {
      return null;
    }

    await this.recordIncident({
      endpointFamily: "test_creation",
      user: input.user,
      ip: input.ip,
      userAgent: input.userAgent,
      rawPath: input.path,
      normalizedRoute: "/tests",
      exactEndpointKey: `POST:${input.path}`,
      incidentType: "free_lifetime_test_cap_spam",
      severity: "critical",
      actionTaken: "account_deactivated",
      targetType: "user",
      targetValue: String(input.user.id),
      hitCountInWindow: next,
      distinctTargetCountInWindow: 0,
      lockDurationSeconds: windowSeconds,
      metadata: { totalCap, totalTests, threshold, windowSeconds },
      notifyTelegram: true,
    });

    await this.deactivateUserForSecurity({
      userId: input.user.id,
      ip: input.ip,
      reason: "Repeated attempts to create tests after hitting the free lifetime cap",
      sourceType: "free_lifetime_test_cap_spam",
    });

    return new HttpException(
      {
        statusCode: 429,
        code: "SECURITY_TEST_CREATION_SPAM",
        message: "Too many test creation requests.",
        retryAfterSeconds: windowSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async maybeRecordDailyTestCapReached(
    input: {
      user: User;
      ip: string;
      userAgent?: string | null;
      path: string;
    },
    dailyCap: number,
    dayBucket: string,
    currentCount: number,
  ) {
    const cacheKey = `security:daily-test-cap-reached:${input.user.id}:${dayBucket}`;
    const existing = await this.cacheManager.get(cacheKey);
    if (existing) {
      return;
    }

    await this.cacheManager.set(cacheKey, true, 24 * 60 * 60 * 1000);
    await this.recordIncident({
      endpointFamily: "test_creation",
      user: input.user,
      ip: input.ip,
      userAgent: input.userAgent,
      rawPath: input.path,
      normalizedRoute: "/tests",
      exactEndpointKey: `POST:${input.path}`,
      incidentType: "daily_test_cap_reached",
      severity: "high",
      actionTaken: "quota_block",
      targetType: "user",
      targetValue: String(input.user.id),
      hitCountInWindow: currentCount,
      distinctTargetCountInWindow: 0,
      metadata: { dailyCap, dayBucket, currentCount },
      notifyTelegram: true,
    });
  }

  private async recordIncident(input: {
    endpointFamily: string;
    user?: User | null;
    ip: string;
    userAgent?: string | null;
    rawPath: string;
    normalizedRoute: string;
    exactEndpointKey: string;
    incidentType: string;
    severity: string;
    actionTaken?: string | null;
    targetType?: string | null;
    targetValue?: string | null;
    hitCountInWindow?: number;
    distinctTargetCountInWindow?: number;
    scoreDelta?: number;
    lockDurationSeconds?: number;
    metadata?: Record<string, any>;
    notifyTelegram?: boolean;
  }) {
    const userId = input.user?.id ?? null;
    const incident = this.incidentRepo.create({
      actorType: userId ? "user" : "ip",
      actorKey: userId ? `user:${userId}|ip:${input.ip}` : `ip:${input.ip}`,
      userId,
      ip: input.ip,
      userAgent: input.userAgent || null,
      rawPath: String(input.rawPath || "").slice(0, 255),
      normalizedRoute: String(input.normalizedRoute || "").slice(0, 255),
      method: input.exactEndpointKey.startsWith("POST:")
        ? "POST"
        : input.exactEndpointKey.startsWith("GET:")
          ? "GET"
          : "SYSTEM",
      queryString: null,
      endpointFamily: input.endpointFamily,
      targetType: input.targetType || null,
      targetValue: input.targetValue || null,
      exactEndpointKey: String(input.exactEndpointKey || "").slice(0, 255),
      incidentType: input.incidentType,
      severity: input.severity,
      scoreDelta: Number(input.scoreDelta || 0),
      cumulativeScore: Number(input.scoreDelta || 0),
      actionTaken: input.actionTaken || null,
      hitCountInWindow: Number(input.hitCountInWindow || 0),
      distinctTargetCountInWindow: Number(input.distinctTargetCountInWindow || 0),
      lockDurationSeconds: Number(input.lockDurationSeconds || 0),
      metadata: input.metadata || null,
    });
    const saved = await this.incidentRepo.save(incident);
    await this.createAdminSecurityNotification(saved, input);

    if (input.notifyTelegram) {
      const minSeverity = await this.getString("SECURITY_TELEGRAM_MIN_SEVERITY");
      const severityOrder = ["low", "medium", "high", "critical"];
      if (
        severityOrder.indexOf(input.severity) >=
        severityOrder.indexOf(minSeverity)
      ) {
        try {
          await this.telegramService.sendAdminSecurityAlert({
            severity: input.severity,
            userId,
            userEmail: input.user?.email || null,
            ip: input.ip,
            endpointFamily: input.endpointFamily,
            endpointLabel: this.getEndpointLabel(input.endpointFamily),
            exactEndpoint: input.exactEndpointKey,
            normalizedRoute: input.normalizedRoute,
            targetValue: input.targetValue || null,
            incidentType: input.incidentType,
            actionTaken: input.actionTaken || "logged",
            scoreDelta: Number(input.scoreDelta || 0),
            cumulativeScore: Number(input.scoreDelta || 0),
            hitCountInWindow: Number(input.hitCountInWindow || 0),
            distinctTargetCountInWindow: Number(
              input.distinctTargetCountInWindow || 0,
            ),
            lockDurationSeconds: Number(input.lockDurationSeconds || 0),
            incidentId: saved.id,
          });
        } catch {
          // never block request flow on alert failure
        }
      }
    }

    return saved;
  }

  private async createAdminSecurityNotification(
    incident: SecurityIncident,
    input: {
      endpointFamily: string;
      user?: User | null;
      ip: string;
      userAgent?: string | null;
      rawPath: string;
      normalizedRoute: string;
      exactEndpointKey: string;
      incidentType: string;
      severity: string;
      actionTaken?: string | null;
      targetType?: string | null;
      targetValue?: string | null;
      hitCountInWindow?: number;
      distinctTargetCountInWindow?: number;
      scoreDelta?: number;
      lockDurationSeconds?: number;
      metadata?: Record<string, any>;
      notifyTelegram?: boolean;
    },
  ) {
    const actorLabel =
      input.user?.email ||
      input.user?.name ||
      (input.user?.id ? `User #${input.user.id}` : input.ip);

    try {
      await this.adminNotificationsService.createAdminNotification({
        title: `Security ${String(input.severity || "medium").toUpperCase()}: ${this.getEndpointLabel(input.endpointFamily)}`,
        message: `${actorLabel} triggered ${input.incidentType} on ${input.exactEndpointKey}. Action: ${input.actionTaken || "logged"}.`,
        type: NotificationType.WARNING,
        userId: input.user?.id ?? null,
        metadata: {
          category: "security",
          alertType: input.endpointFamily,
          incidentId: incident.id,
          endpointFamily: input.endpointFamily,
          exactEndpoint: input.exactEndpointKey,
          normalizedRoute: input.normalizedRoute,
          incidentType: input.incidentType,
          severity: input.severity,
          actionTaken: input.actionTaken || "logged",
          ip: input.ip,
          hitCountInWindow: Number(input.hitCountInWindow || 0),
          distinctTargetCountInWindow: Number(
            input.distinctTargetCountInWindow || 0,
          ),
        },
      });
    } catch {
      // keep security flow resilient if admin notification storage fails
    }
  }

  private getEndpointLabel(endpointFamily: string) {
    const labels: Record<string, string> = {
      test_creation: "Test Creation",
      library_article: "Library Article",
      ip_blocking: "IP Blocking",
    };
    return labels[endpointFamily] || endpointFamily;
  }

  private roleMatches(role: UserRole, scope: string) {
    const allowedRoles = String(scope || "user")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return allowedRoles.length === 0 || allowedRoles.includes(role);
  }

  private isSuperAdmin(user?: User | null) {
    return user?.role === UserRole.SUPER_ADMIN;
  }

  private getDayBucket() {
    return new Date().toISOString().slice(0, 10);
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

  private async getString(key: keyof typeof SECURITY_SETTINGS_DEFAULTS) {
    return this.settingsService.getString(key, SECURITY_SETTINGS_DEFAULTS[key]);
  }

  private async assertNoActiveTestContentRestriction(userId: number, ip: string) {
    const actorKey = `user:${userId}|ip:${ip}`;
    const cooldown = await this.cacheManager.get<number>(
      `security:lock:cooldown:${actorKey}`,
    );
    if (cooldown && cooldown > Date.now()) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((cooldown - Date.now()) / 1000),
      );
      throw new HttpException(
        {
          statusCode: 423,
          code: "SECURITY_TEST_CREATION_BLOCKED",
          message:
            "Test creation is temporarily blocked because your test access is cooling down.",
          retryAfterSeconds,
        },
        423,
      );
    }

    const contentLock = await this.cacheManager.get<number>(
      `security:lock:content_lock:${actorKey}`,
    );
    if (contentLock && contentLock > Date.now()) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((contentLock - Date.now()) / 1000),
      );
      throw new HttpException(
        {
          statusCode: 423,
          code: "SECURITY_TEST_CREATION_BLOCKED",
          message:
            "Test creation is temporarily blocked because your test content access is locked.",
          retryAfterSeconds,
        },
        423,
      );
    }
  }
}
