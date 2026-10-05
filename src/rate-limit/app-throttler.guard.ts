import { CACHE_MANAGER } from "@nestjs/cache-manager";
import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { Cache } from "cache-manager";
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerRequest,
  ThrottlerStorage,
} from "@nestjs/throttler";

// @nestjs/throttler's @Throttle() decorator stores per-throttler limit data
// under the metadata key `THROTTLER:LIMIT<name>` (limit value), `THROTTLER:TTL<name>`
// for TTL, etc. The constant `THROTTLER_LIMIT = "THROTTLER:LIMIT"` exists
// in @nestjs/throttler/dist/throttler.constants.js but is NOT in the public
// index re-export, so we mirror the literal here. Stable across the entire
// v6 release line — verified against throttler.decorator.js source.
const THROTTLER_LIMIT_METADATA_PREFIX = "THROTTLER:LIMIT";
import {
  buildRateLimitBackoffKeys,
  buildRateLimitMessage,
  calculateBackoffDuration,
  formatRetryAfter,
  getClientIp,
  getRateLimitTracker,
  isSafeHttpMethod,
  parsePositiveFloat,
  parsePositiveInt,
} from "./rate-limit.utils";
import { ActivityService } from "../activity/activity.service";
import { SettingsService } from "../settings/settings.service";
import { verifyJwtPayload } from "../auth/jwt-verify.util";
import { UserRole } from "../entities/user.entity";
import { seconds } from "@nestjs/throttler";

type BackoffSettings = {
  windowMs: number;
  multiplier: number;
  maxBlockDurationMs: number;
};

type ThrottlerIncrementResult = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

type ThrottlingExceptionDetail = ThrottlerIncrementResult & {
  limit: number;
  ttl: number;
  key: string;
  tracker: string;
};

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions()
    options: ThrottlerModuleOptions,
    @InjectThrottlerStorage()
    storageService: ThrottlerStorage,
    reflector: Reflector,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly activityService: ActivityService,
    private readonly settingsService: SettingsService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    return getRateLimitTracker(req);
  }

  /**
   * Returns true iff the current route's @Throttle decorator (on the handler
   * or the controller) explicitly references the given throttler name.
   *
   * The `@Throttle({ foo: { ... } })` decorator stores its metadata under the
   * key `THROTTLER_LIMIT + 'foo'` on the target. We check both method and
   * class-level metadata so a controller-wide @Throttle still scopes correctly.
   */
  private routeReferencesThrottler(
    context: ExecutionContext,
    throttlerName: string,
  ): boolean {
    const metadataKey = THROTTLER_LIMIT_METADATA_PREFIX + throttlerName;
    const value = this.reflector.getAllAndOverride<unknown>(metadataKey, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Existence check (not truthiness) so a hypothetical `@Throttle({ x: { limit: 0 } })`
    // would still count as "this route uses the x throttler".
    return value !== undefined && value !== null;
  }

  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    let { limit, ttl, blockDuration } = requestProps;
    const { context, throttler, getTracker, generateKey } = requestProps;
    const { req, res } = this.getRequestResponse(context);

    // SCOPE NAMED THROTTLERS TO THEIR DECORATED ROUTES.
    //
    // @nestjs/throttler runs EVERY registered throttler on EVERY request by
    // default — a route without @Throttle still gets counted by `auth`,
    // `media`, `job_application`, etc. That means hitting the careers form
    // limit (3 per 10 min on `job_application`) would block subscription
    // reads, library views, login, everything.
    //
    // Fix: `default` is the only globally-applied throttler. Other named
    // throttlers only apply when the route's @Throttle decorator references
    // them. @Throttle stores its data under `THROTTLER_LIMIT + <name>`
    // metadata, so we just check that key on the method and the controller.
    if (throttler.name && throttler.name !== "default") {
      if (!this.routeReferencesThrottler(context, throttler.name)) {
        return true; // skip this throttler for this route
      }
    }

    // Defaults below mirror the SECURE-by-default values in rate-limit.config.ts.
    // Ops can override any value via the matching DB setting key — but if a
    // setting is missing, the fallback must already be safe.
    if (throttler.name === "auth") {
      ttl = seconds(await this.settingsService.getNumber("RATE_LIMIT_AUTH_TTL", 60));
      // Was 20 — far too loose for brute-force surfaces (login, OTP, password
      // reset). Tightened to 5/min to match the original intent in
      // rate-limit.constants.ts and the security audit recommendation.
      limit = await this.settingsService.getNumber("RATE_LIMIT_AUTH_MAX", 5);
      blockDuration = seconds(await this.settingsService.getNumber("RATE_LIMIT_AUTH_BLOCK_DURATION", 600));
    } else if (throttler.name === "public_resource") {
      ttl = seconds(await this.settingsService.getNumber("RATE_LIMIT_PUBLIC_TTL", 60));
      // Was 400/120 — tightened to 120/30 (read/write) to match the secure
      // initial limits in rate-limit.config.ts.
      const readLimit = await this.settingsService.getNumber("RATE_LIMIT_PUBLIC_READ_MAX", 120);
      const writeLimit = await this.settingsService.getNumber("RATE_LIMIT_PUBLIC_WRITE_MAX", 30);
      limit = isSafeHttpMethod(req?.method) ? readLimit : writeLimit;
      blockDuration = seconds(await this.settingsService.getNumber("RATE_LIMIT_PUBLIC_BLOCK_DURATION", 60));
    } else if (throttler.name === "media") {
      ttl = seconds(await this.settingsService.getNumber("RATE_LIMIT_MEDIA_TTL", 60));
      // Was 80 — tightened to 20 to match the constants file.
      limit = await this.settingsService.getNumber("RATE_LIMIT_MEDIA_MAX", 20);
      blockDuration = seconds(await this.settingsService.getNumber("RATE_LIMIT_MEDIA_BLOCK_DURATION", 300));
    } else if (throttler.name === "ai_burst") {
      ttl = seconds(await this.settingsService.getNumber("RATE_LIMIT_AI_BURST_TTL", 60));
      // Was 40 — tightened to 10 (AI calls cost real money).
      limit = await this.settingsService.getNumber("RATE_LIMIT_AI_BURST_MAX", 10);
      blockDuration = seconds(await this.settingsService.getNumber("RATE_LIMIT_AI_BURST_BLOCK_DURATION", 120));
    } else if (throttler.name === "job_application") {
      ttl = seconds(await this.settingsService.getNumber("RATE_LIMIT_JOB_APP_TTL", 600));
      // Was 12 / 10 min — tightened to 3.
      limit = await this.settingsService.getNumber("RATE_LIMIT_JOB_APP_MAX", 3);
      blockDuration = seconds(await this.settingsService.getNumber("RATE_LIMIT_JOB_APP_BLOCK_DURATION", 1800));
    } else if (throttler.name === "test_create") {
      ttl = seconds(await this.settingsService.getNumber("RATE_LIMIT_TEST_CREATE_TTL", 60));
      // Was 40 — tightened to 10.
      limit = await this.settingsService.getNumber("RATE_LIMIT_TEST_CREATE_MAX", 10);
      blockDuration = seconds(await this.settingsService.getNumber("RATE_LIMIT_TEST_CREATE_BLOCK_DURATION", 300));
    } else if (throttler.name === "library_view") {
      ttl = seconds(await this.settingsService.getNumber("RATE_LIMIT_LIBRARY_VIEW_TTL", 60));
      // Was 120 — tightened to 30 (anti-scrape).
      limit = await this.settingsService.getNumber("RATE_LIMIT_LIBRARY_VIEW_MAX", 30);
      blockDuration = seconds(await this.settingsService.getNumber("RATE_LIMIT_LIBRARY_VIEW_BLOCK_DURATION", 300));
    }

    const ignoreUserAgents =
      throttler.ignoreUserAgents ?? this.commonOptions.ignoreUserAgents;

    if (Array.isArray(ignoreUserAgents)) {
      for (const pattern of ignoreUserAgents) {
        if (pattern.test(req.headers["user-agent"])) {
          return true;
        }
      }
    }

    if (this.isSuperAdminRequest(req)) {
      return true;
    }

    const tracker = await getTracker(req, context);
    const key = generateKey(context, tracker, throttler.name);
    const { strikesKey, activeBlockKey } = buildRateLimitBackoffKeys(key);
    const strikeCount = await this.getStrikeCount(strikesKey);
    const backoffSettings = await this.getBackoffSettings();
    const effectiveBlockDuration = calculateBackoffDuration(
      blockDuration,
      strikeCount,
      backoffSettings.multiplier,
      backoffSettings.maxBlockDurationMs,
    );
    const throttlerResult = await this.storageService.increment(
      key,
      ttl,
      limit,
      effectiveBlockDuration,
      throttler.name,
    );

    await this.syncBackoffState(
      throttlerResult,
      strikesKey,
      activeBlockKey,
      effectiveBlockDuration,
      backoffSettings,
    );

    const getThrottlerSuffix = (name: string) =>
      name === "default" ? "" : `-${name}`;
    const setHeaders =
      throttler.setHeaders ?? this.commonOptions.setHeaders ?? true;

    if (throttlerResult.isBlocked) {
      if (setHeaders) {
        res.header(
          `Retry-After${getThrottlerSuffix(throttler.name)}`,
          throttlerResult.timeToBlockExpire,
        );
      }

      await this.maybeRecordRateLimitAlert(
        req,
        tracker,
        limit,
        throttlerResult,
      );

      await this.throwThrottlingException(context, {
        limit,
        ttl,
        key,
        tracker,
        ...throttlerResult,
      });
    }

    if (setHeaders) {
      res.header(
        `${this.headerPrefix}-Limit${getThrottlerSuffix(throttler.name)}`,
        limit,
      );
      res.header(
        `${this.headerPrefix}-Remaining${getThrottlerSuffix(throttler.name)}`,
        Math.max(0, limit - throttlerResult.totalHits),
      );
      res.header(
        `${this.headerPrefix}-Reset${getThrottlerSuffix(throttler.name)}`,
        throttlerResult.timeToExpire,
      );
    }

    return true;
  }

  protected async throwThrottlingException(
    _context: ExecutionContext,
    throttlerLimitDetail: ThrottlingExceptionDetail,
  ): Promise<void> {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(throttlerLimitDetail.timeToBlockExpire),
    );

    throw new HttpException(
      {
        statusCode: 429,
        error: "Too Many Requests",
        message: buildRateLimitMessage(retryAfterSeconds),
        retryAfterSeconds,
        retryAfterHuman: formatRetryAfter(retryAfterSeconds),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async getBackoffSettings(): Promise<BackoffSettings> {
    const windowSeconds = await this.settingsService.getNumber("RATE_LIMIT_BACKOFF_WINDOW", 1800);
    const multiplier = await this.settingsService.getNumber("RATE_LIMIT_BACKOFF_MULTIPLIER", 2);
    const maxBlockDurationSeconds = await this.settingsService.getNumber("RATE_LIMIT_BACKOFF_MAX_BLOCK_DURATION", 3600);

    return {
      windowMs: windowSeconds * 1000,
      multiplier,
      maxBlockDurationMs: maxBlockDurationSeconds * 1000,
    };
  }

  private async getStrikeCount(strikesKey: string): Promise<number> {
    const value = await this.cacheManager.get<number>(strikesKey);
    return Number.isFinite(value) && (value as number) > 0 ? Number(value) : 0;
  }

  private async syncBackoffState(
    throttlerResult: ThrottlerIncrementResult,
    strikesKey: string,
    activeBlockKey: string,
    effectiveBlockDuration: number,
    backoffSettings: BackoffSettings,
  ): Promise<void> {
    if (!throttlerResult.isBlocked) {
      await this.cacheManager.del(activeBlockKey);
      return;
    }

    const activeBlock = await this.cacheManager.get(activeBlockKey);
    if (activeBlock) {
      return;
    }

    const currentStrikes = await this.getStrikeCount(strikesKey);
    const nextStrikes = currentStrikes + 1;

    await this.cacheManager.set(
      strikesKey,
      nextStrikes,
      backoffSettings.windowMs,
    );
    await this.cacheManager.set(
      activeBlockKey,
      true,
      Math.max(
        effectiveBlockDuration,
        throttlerResult.timeToBlockExpire * 1000,
      ),
    );
  }

  private extractUserId(req: Record<string, any>): number | null {
    const direct =
      req.user?.id ?? req.user?.userId ?? req.user?.sub ?? req.user?.user?.id;
    if (direct && Number.isFinite(Number(direct))) {
      return Number(direct);
    }

    const header =
      req.headers?.authorization || req.headers?.Authorization || "";
    if (typeof header !== "string" || header.length === 0) {
      return null;
    }
    const token = header.startsWith("Bearer ") ? header.slice(7) : header;
    const payload = this.decodeJwtPayload(token);
    const candidate = payload?.sub ?? payload?.userId ?? payload?.id;
    return candidate && Number.isFinite(Number(candidate))
      ? Number(candidate)
      : null;
  }

  private decodeJwtPayload(token: string): Record<string, any> | null {
    const secret = this.configService.get<string>("JWT_SECRET");
    if (!secret) {
      return null;
    }
    return verifyJwtPayload(token, secret, {
      issuer: this.configService.get<string>("JWT_ISSUER") || "medpark.io",
      audience: this.configService.get<string>("JWT_AUDIENCE") || "api.medpark.io",
    });
  }

  private isSuperAdminRequest(req: Record<string, any>): boolean {
    const directRole =
      req.user?.role ?? req.user?.user?.role ?? req.user?.payload?.role ?? null;
    if (directRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    const header =
      req.headers?.authorization || req.headers?.Authorization || "";
    if (typeof header !== "string" || header.length === 0) {
      return false;
    }
    const token = header.startsWith("Bearer ") ? header.slice(7) : header;
    const payload = this.decodeJwtPayload(token);
    return payload?.role === UserRole.SUPER_ADMIN;
  }

  private async maybeRecordRateLimitAlert(
    req: Record<string, any>,
    tracker: string,
    limit: number,
    throttlerResult: ThrottlerIncrementResult,
  ) {
    try {
      const cooldownKey = `security:rate-limit:cooldown:${tracker}`;
      const existing = await this.cacheManager.get(cooldownKey);
      if (existing) {
        return;
      }

      await this.cacheManager.set(cooldownKey, true, 300 * 1000);

      const userId = this.extractUserId(req);
      await this.activityService.recordRateLimitAlert({
        userId,
        ip: getClientIp(req),
        path: String(req.originalUrl || req.url || "").slice(0, 255),
        method: String(req.method || "GET"),
        userAgent: req.headers?.["user-agent"] || null,
        limit,
        totalHits: throttlerResult.totalHits,
        ttlSeconds: Math.max(
          1,
          Math.ceil(throttlerResult.timeToBlockExpire || 0),
        ),
      });
    } catch {
      // Avoid blocking throttling flow on monitoring errors
    }
  }
}
