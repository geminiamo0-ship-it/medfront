import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminGateGuard } from "../admin/admin-gate.guard";
import { AdminHistoryService } from "../admin/admin-history.service";
import { SettingsService } from "../settings/settings.service";
import { UserRole } from "../entities/user.entity";
import {
  SECURITY_FAMILY_LABELS,
  SECURITY_SETTINGS_DEFAULTS,
} from "./security.constants";
import { SecurityPolicyService } from "./security-policy.service";
import { SecurityService } from "./security.service";
import { BlockedIpService } from "./ip-block.service";
import { SecurityQuotaService } from "./security-quota.service";

type CompactSettings = {
  libraryProtection: {
    freeDailyArticleCap: string;
    countUniqueOnly: string;
    requestWindowSeconds: string;
    maxRequestsPerWindow: string;
    sameArticleMaxHits: string;
    distinctArticlesPerMinute: string;
    tooltipWindowSeconds: string;
    tooltipMaxHits: string;
    tooltipExactEndpointWindowSeconds: string;
    tooltipExactEndpointMaxHits: string;
    autoDeactivateOnAbuse: string;
    abuseStrikeThreshold: string;
    severeSameArticleHits: string;
    severeDistinctArticlesPerMinute: string;
  };
  testProtection: {
    freeTotalTests: string;
    dailyTestCap: string;
    dailyCapSpamWindowSeconds: string;
    dailyCapSpamThreshold: string;
    createTestAbuseWindowSeconds: string;
    createTestAbuseMaxHits: string;
    autoDeactivateOnAbuse: string;
    abuseStrikeThreshold: string;
  };
  accountEnforcement: {
    protectionEnabled: string;
    autoDeactivateRoleScope: string;
  };
  otpProtection: {
    maxPerWindow: string;
    windowSeconds: string;
  };
  ipBlocking: {
    enabled: string;
    deactivateAlsoBlocksIp: string;
  };
  alerts: {
    telegramEnabled: string;
    securityChatId: string;
    telegramMinSeverity: string;
  };
  watermarking: {
    enabled: string;
  };
  advancedProtection: {
    cooldownSeconds: string;
    contentLockSeconds: string;
    repeatOffenseMultiplier: string;
    testExplanationWindowSeconds: string;
    testExplanationMaxHits: string;
    testExplanationSameTargetMaxHits: string;
    testExplanationExactEndpointMaxHits: string;
    testExplanationDistinctMinuteMax: string;
    testExplanationDistinctHourMax: string;
    testExplanationDistinctDayMax: string;
    testExplanationDailyHardCap: string;
    testPracticeDistinctMinuteMax: string;
    testPracticeDistinctHourMax: string;
    testPracticeDistinctDayMax: string;
    testPracticeDailyHardCap: string;
    testPayloadDistinctMinuteMax: string;
    testPayloadDistinctHourMax: string;
    testPayloadDistinctDayMax: string;
  };
  rateLimiting: {
    aiBurstTtl: string;
    aiBurstMax: string;
    aiBurstBlockDuration: string;
    libraryViewTtl: string;
    libraryViewMax: string;
    libraryViewBlockDuration: string;
    authTtl: string;
    authMax: string;
    authBlockDuration: string;
    testCreateTtl: string;
    testCreateMax: string;
    testCreateBlockDuration: string;
    publicTtl: string;
    publicReadMax: string;
    publicWriteMax: string;
    publicBlockDuration: string;
    mediaTtl: string;
    mediaMax: string;
    mediaBlockDuration: string;
    jobAppTtl: string;
    jobAppMax: string;
    jobAppBlockDuration: string;
    backoffWindow: string;
    backoffMultiplier: string;
    backoffMaxBlockDuration: string;
  };
};

@ApiTags("Admin - Security")
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class SecurityAdminController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly policyService: SecurityPolicyService,
    private readonly securityService: SecurityService,
    private readonly blockedIpService: BlockedIpService,
    private readonly securityQuotaService: SecurityQuotaService,
    private readonly historyService: AdminHistoryService,
  ) {}

  @Get("settings/security-content")
  @ApiOperation({ summary: "Get scraping protection settings" })
  async getSecurityContentSettings(@Request() req) {
    this.assertAdmin(req.user);
    return {
      success: true,
      data: await this.buildGroupedSettings(),
    };
  }

  @Patch("settings/security-content")
  @ApiOperation({ summary: "Update scraping protection settings" })
  async updateSecurityContentSettings(@Request() req, @Body() body: Record<string, any>) {
    this.assertAdmin(req.user);
    const adminEmail =
      req.user.email || req.user.userId?.toString() || req.user.id?.toString();
    const before = await this.buildGroupedSettings();
    const applied = await this.applyGroupedUpdates(body, adminEmail);
    await this.policyService.clearCache();
    const after = await this.buildGroupedSettings();
    await this.historyService.record(
      adminEmail,
      "UPDATE_SECURITY_CONTENT_SETTINGS",
      "AppSetting",
      "SECURITY_CONTENT",
      { before, after, applied },
      "Security",
    );
    return { success: true, data: after };
  }

  @Get("security/incidents")
  @ApiOperation({ summary: "Get scraping security incidents" })
  async getSecurityIncidents(
    @Request() req,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("userId") userId?: string,
    @Query("ip") ip?: string,
    @Query("search") search?: string,
    @Query("severity") severity?: string,
    @Query("incidentType") incidentType?: string,
    @Query("actionTaken") actionTaken?: string,
    @Query("endpointFamily") endpointFamily?: string,
  ) {
    this.assertAdmin(req.user);
    const safeLimit = this.parseInt(limit, 100);
    const safeOffset = this.parseInt(offset, 0);
    const result = await this.securityService.listIncidents(
      {
        limit: safeLimit,
        offset: safeOffset,
        from,
        to,
        userId: userId ? this.parseInt(userId, 0) : undefined,
        ip,
        search,
        severity,
        incidentType,
        actionTaken,
        endpointFamily,
      },
    );
    return { success: true, data: result.rows, total: result.total, limit: safeLimit, offset: safeOffset };
  }

  @Get("security/actors")
  @ApiOperation({ summary: "Get security actor states" })
  async getSecurityActors(
    @Request() req,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("lockedOnly") lockedOnly?: string,
  ) {
    this.assertAdmin(req.user);
    const safeLimit = this.parseInt(limit, 100);
    const safeOffset = this.parseInt(offset, 0);
    const safeLockedOnly = String(lockedOnly || "").toLowerCase() === "true";
    const result = await this.securityService.listActorStates(
      safeLimit,
      safeOffset,
      safeLockedOnly,
    );
    return { success: true, data: result.rows, total: result.total, limit: safeLimit, offset: safeOffset };
  }

  @Post("security/actors/:id/unlock")
  @ApiOperation({ summary: "Unlock a security actor" })
  async unlockSecurityActor(
    @Request() req,
    @Param("id") idParam: string,
  ) {
    this.assertAdmin(req.user);
    const id = this.parseInt(idParam, 0);
    const adminEmail =
      req.user.email || req.user.userId?.toString() || req.user.id?.toString();
    const state = await this.securityService.unlockActor(id, adminEmail);
    await this.historyService.record(
      adminEmail,
      "UNLOCK_SECURITY_ACTOR",
      "SecurityActorState",
      String(id),
      {
        actorKey: state.actorKey,
        lastExactEndpointKey: state.lastExactEndpointKey,
      },
      "Security",
    );
    return { success: true, data: state };
  }

  @Get("security/ip-blocks")
  @ApiOperation({ summary: "Get blocked IP addresses" })
  async getBlockedIps(
    @Request() req,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("activeOnly") activeOnly?: string,
  ) {
    this.assertAdmin(req.user);
    const result = await this.blockedIpService.listBlockedIps(
      this.parseInt(limit, 100),
      this.parseInt(offset, 0),
      String(activeOnly || "true").toLowerCase() !== "false",
    );
    return { success: true, data: result.rows, total: result.total };
  }

  @Get("security/ip-attempts")
  @ApiOperation({ summary: "Get blocked IP attempts" })
  async getBlockedIpAttempts(
    @Request() req,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    this.assertAdmin(req.user);
    const result = await this.blockedIpService.listBlockedAttempts(
      this.parseInt(limit, 100),
      this.parseInt(offset, 0),
    );
    return { success: true, data: result.rows, total: result.total };
  }

  @Get("security/quota-usage")
  @ApiOperation({ summary: "Get quota usage rows" })
  async getQuotaUsage(
    @Request() req,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    this.assertAdmin(req.user);
    const result = await this.securityQuotaService.listQuotaUsage(
      this.parseInt(limit, 100),
      this.parseInt(offset, 0),
    );
    return { success: true, data: result.rows, total: result.total };
  }

  @Post("security/ip-blocks/:id/unlock")
  @ApiOperation({ summary: "Unblock an IP address" })
  async unlockBlockedIp(@Request() req, @Param("id") idParam: string) {
    this.assertAdmin(req.user);
    const adminEmail =
      req.user.email || req.user.userId?.toString() || req.user.id?.toString();
    const state = await this.blockedIpService.unblockIp(
      this.parseInt(idParam, 0),
      adminEmail,
    );
    return { success: true, data: state };
  }

  private assertAdmin(user: any) {
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN)) {
      throw new ForbiddenException("Admin access required");
    }
  }

  private parseInt(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private parsePositiveNumber(value: any, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }

  private async buildGroupedSettings() {
    const data: CompactSettings = {
      libraryProtection: {
        freeDailyArticleCap: await this.readSetting("SECURITY_FREE_LIBRARY_DAILY_ARTICLE_CAP"),
        countUniqueOnly: await this.readSetting("SECURITY_LIBRARY_QUOTA_COUNT_UNIQUE_ONLY"),
        requestWindowSeconds: await this.readSetting("SECURITY_LIBRARY_ARTICLE_WINDOW_SECONDS"),
        maxRequestsPerWindow: await this.readSetting("SECURITY_LIBRARY_ARTICLE_MAX_HITS"),
        sameArticleMaxHits: await this.readSetting("SECURITY_LIBRARY_ARTICLE_SAME_TARGET_MAX_HITS"),
        distinctArticlesPerMinute: await this.readSetting("SECURITY_LIBRARY_ARTICLE_DISTINCT_MINUTE_MAX"),
        tooltipWindowSeconds: await this.readSetting("SECURITY_LIBRARY_TOOLTIP_WINDOW_SECONDS"),
        tooltipMaxHits: await this.readSetting("SECURITY_LIBRARY_TOOLTIP_MAX_HITS"),
        tooltipExactEndpointWindowSeconds: await this.readSetting("SECURITY_LIBRARY_TOOLTIP_EXACT_ENDPOINT_WINDOW_SECONDS"),
        tooltipExactEndpointMaxHits: await this.readSetting("SECURITY_LIBRARY_TOOLTIP_EXACT_ENDPOINT_MAX_HITS"),
        autoDeactivateOnAbuse: await this.readSetting("SECURITY_LIBRARY_ABUSE_AUTO_DEACTIVATE_ENABLED"),
        abuseStrikeThreshold: await this.readSetting("SECURITY_LIBRARY_ABUSE_STRIKE_THRESHOLD"),
        severeSameArticleHits: await this.readSetting("SECURITY_LIBRARY_ABUSE_SEVERE_EXACT_ENDPOINT_HITS"),
        severeDistinctArticlesPerMinute: await this.readSetting("SECURITY_LIBRARY_ABUSE_SEVERE_DISTINCT_MINUTE_HITS"),
      },
      testProtection: {
        freeTotalTests: await this.readSetting("SECURITY_FREE_USER_TOTAL_TEST_CAP"),
        dailyTestCap: await this.readSetting("SECURITY_ALL_USER_DAILY_TEST_CAP"),
        dailyCapSpamWindowSeconds: await this.readSetting(
          "SECURITY_DAILY_TEST_CAP_SPAM_WINDOW_SECONDS",
        ),
        dailyCapSpamThreshold: await this.readSetting(
          "SECURITY_DAILY_TEST_CAP_SPAM_THRESHOLD",
        ),
        createTestAbuseWindowSeconds: await this.readSetting("SECURITY_TEST_CREATION_ABUSE_WINDOW_SECONDS"),
        createTestAbuseMaxHits: await this.readSetting("SECURITY_TEST_CREATION_ABUSE_MAX_HITS"),
        autoDeactivateOnAbuse: await this.readSetting("SECURITY_TEST_CREATION_AUTO_DEACTIVATE_ENABLED"),
        abuseStrikeThreshold: await this.readSetting("SECURITY_TEST_CREATION_ABUSE_STRIKE_THRESHOLD"),
      },
      accountEnforcement: {
        protectionEnabled: await this.readSetting("SECURITY_SCRAPING_PROTECTION_ENABLED"),
        autoDeactivateRoleScope: await this.readSetting("SECURITY_AUTO_DEACTIVATE_ROLE_SCOPE"),
      },
      otpProtection: {
        maxPerWindow: await this.readSetting("SECURITY_OTP_MAX_PER_WINDOW"),
        windowSeconds: await this.readSetting("SECURITY_OTP_WINDOW_SECONDS"),
      },
      ipBlocking: {
        enabled: await this.readSetting("SECURITY_IP_BLOCKING_ENABLED"),
        deactivateAlsoBlocksIp: await this.readSetting("SECURITY_DEACTIVATE_ALSO_BLOCK_IP"),
      },
      alerts: {
        telegramEnabled: await this.readSetting("ENABLE_TELEGRAM_SECURITY_ALERTS"),
        securityChatId: await this.readSetting("SECURITY_TELEGRAM_CHAT_ID"),
        telegramMinSeverity: await this.readSetting("SECURITY_TELEGRAM_MIN_SEVERITY"),
      },
      watermarking: {
        enabled: await this.readSetting("SECURITY_WATERMARKING_ENABLED"),
      },
      advancedProtection: {
        cooldownSeconds: await this.readSetting("SECURITY_COOLDOWN_SECONDS"),
        contentLockSeconds: await this.readSetting("SECURITY_CONTENT_LOCK_SECONDS"),
        repeatOffenseMultiplier: await this.readSetting(
          "SECURITY_REPEAT_OFFENSE_MULTIPLIER",
        ),
        testExplanationWindowSeconds: await this.readSetting(
          "SECURITY_TEST_EXPLANATION_WINDOW_SECONDS",
        ),
        testExplanationMaxHits: await this.readSetting(
          "SECURITY_TEST_EXPLANATION_MAX_HITS",
        ),
        testExplanationSameTargetMaxHits: await this.readSetting(
          "SECURITY_TEST_EXPLANATION_SAME_TARGET_MAX_HITS",
        ),
        testExplanationExactEndpointMaxHits: await this.readSetting(
          "SECURITY_TEST_EXPLANATION_EXACT_ENDPOINT_MAX_HITS",
        ),
        testExplanationDistinctMinuteMax: await this.readSetting(
          "SECURITY_TEST_EXPLANATION_DISTINCT_MINUTE_MAX",
        ),
        testExplanationDistinctHourMax: await this.readSetting(
          "SECURITY_TEST_EXPLANATION_DISTINCT_HOUR_MAX",
        ),
        testExplanationDistinctDayMax: await this.readSetting(
          "SECURITY_TEST_EXPLANATION_DISTINCT_DAY_MAX",
        ),
        testExplanationDailyHardCap: await this.readSetting(
          "SECURITY_TEST_EXPLANATION_DAILY_HARD_CAP",
        ),
        testPracticeDistinctMinuteMax: await this.readSetting(
          "SECURITY_TEST_PRACTICE_DISTINCT_MINUTE_MAX",
        ),
        testPracticeDistinctHourMax: await this.readSetting(
          "SECURITY_TEST_PRACTICE_DISTINCT_HOUR_MAX",
        ),
        testPracticeDistinctDayMax: await this.readSetting(
          "SECURITY_TEST_PRACTICE_DISTINCT_DAY_MAX",
        ),
        testPracticeDailyHardCap: await this.readSetting(
          "SECURITY_TEST_PRACTICE_DAILY_HARD_CAP",
        ),
        testPayloadDistinctMinuteMax: await this.readSetting(
          "SECURITY_TEST_PAYLOAD_DISTINCT_MINUTE_MAX",
        ),
        testPayloadDistinctHourMax: await this.readSetting(
          "SECURITY_TEST_PAYLOAD_DISTINCT_HOUR_MAX",
        ),
        testPayloadDistinctDayMax: await this.readSetting(
          "SECURITY_TEST_PAYLOAD_DISTINCT_DAY_MAX",
        ),
      },
      rateLimiting: {
        aiBurstTtl: await this.readSetting("RATE_LIMIT_AI_BURST_TTL"),
        aiBurstMax: await this.readSetting("RATE_LIMIT_AI_BURST_MAX"),
        aiBurstBlockDuration: await this.readSetting("RATE_LIMIT_AI_BURST_BLOCK_DURATION"),
        libraryViewTtl: await this.readSetting("RATE_LIMIT_LIBRARY_VIEW_TTL"),
        libraryViewMax: await this.readSetting("RATE_LIMIT_LIBRARY_VIEW_MAX"),
        libraryViewBlockDuration: await this.readSetting("RATE_LIMIT_LIBRARY_VIEW_BLOCK_DURATION"),
        authTtl: await this.readSetting("RATE_LIMIT_AUTH_TTL"),
        authMax: await this.readSetting("RATE_LIMIT_AUTH_MAX"),
        authBlockDuration: await this.readSetting("RATE_LIMIT_AUTH_BLOCK_DURATION"),
        testCreateTtl: await this.readSetting("RATE_LIMIT_TEST_CREATE_TTL"),
        testCreateMax: await this.readSetting("RATE_LIMIT_TEST_CREATE_MAX"),
        testCreateBlockDuration: await this.readSetting("RATE_LIMIT_TEST_CREATE_BLOCK_DURATION"),
        publicTtl: await this.readSetting("RATE_LIMIT_PUBLIC_TTL"),
        publicReadMax: await this.readSetting("RATE_LIMIT_PUBLIC_READ_MAX"),
        publicWriteMax: await this.readSetting("RATE_LIMIT_PUBLIC_WRITE_MAX"),
        publicBlockDuration: await this.readSetting("RATE_LIMIT_PUBLIC_BLOCK_DURATION"),
        mediaTtl: await this.readSetting("RATE_LIMIT_MEDIA_TTL"),
        mediaMax: await this.readSetting("RATE_LIMIT_MEDIA_MAX"),
        mediaBlockDuration: await this.readSetting("RATE_LIMIT_MEDIA_BLOCK_DURATION"),
        jobAppTtl: await this.readSetting("RATE_LIMIT_JOB_APP_TTL"),
        jobAppMax: await this.readSetting("RATE_LIMIT_JOB_APP_MAX"),
        jobAppBlockDuration: await this.readSetting("RATE_LIMIT_JOB_APP_BLOCK_DURATION"),
        backoffWindow: await this.readSetting("RATE_LIMIT_BACKOFF_WINDOW"),
        backoffMultiplier: await this.readSetting("RATE_LIMIT_BACKOFF_MULTIPLIER"),
        backoffMaxBlockDuration: await this.readSetting("RATE_LIMIT_BACKOFF_MAX_BLOCK_DURATION"),
      },
    };

    return {
      sections: data,
      families: SECURITY_FAMILY_LABELS,
    };
  }

  private async applyGroupedUpdates(
    body: Record<string, any>,
    adminEmail: string,
  ) {
    const applied: Record<string, string> = {};
    const library = body?.libraryProtection || {};
    const tests = body?.testProtection || {};
    const account = body?.accountEnforcement || {};
    const ipBlocking = body?.ipBlocking || {};
    const alerts = body?.alerts || {};
    const watermarking = body?.watermarking || {};
    const advanced = body?.advancedProtection || {};
    const otp = body?.otpProtection || {};

    const libraryWindowSeconds = this.parsePositiveNumber(
      library.requestWindowSeconds,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_LIBRARY_ARTICLE_WINDOW_SECONDS),
    );
    const libraryMaxRequests = this.parsePositiveNumber(
      library.maxRequestsPerWindow,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_LIBRARY_ARTICLE_MAX_HITS),
    );
    const librarySameArticleMaxHits = this.parsePositiveNumber(
      library.sameArticleMaxHits,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_LIBRARY_ARTICLE_SAME_TARGET_MAX_HITS),
    );
    const libraryDistinctMinute = this.parsePositiveNumber(
      library.distinctArticlesPerMinute,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_LIBRARY_ARTICLE_DISTINCT_MINUTE_MAX),
    );
    const tooltipWindowSeconds = this.parsePositiveNumber(
      library.tooltipWindowSeconds,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_LIBRARY_TOOLTIP_WINDOW_SECONDS)
    );
    const tooltipMaxHits = this.parsePositiveNumber(
      library.tooltipMaxHits,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_LIBRARY_TOOLTIP_MAX_HITS)
    );
    const tooltipExactEndpointWindowSeconds = this.parsePositiveNumber(
      library.tooltipExactEndpointWindowSeconds,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_LIBRARY_TOOLTIP_EXACT_ENDPOINT_WINDOW_SECONDS)
    );
    const tooltipExactEndpointMaxHits = this.parsePositiveNumber(
      library.tooltipExactEndpointMaxHits,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_LIBRARY_TOOLTIP_EXACT_ENDPOINT_MAX_HITS)
    );
    const librarySevereSameArticleHits = this.parsePositiveNumber(
      library.severeSameArticleHits,
      Number(
        SECURITY_SETTINGS_DEFAULTS.SECURITY_LIBRARY_ABUSE_SEVERE_EXACT_ENDPOINT_HITS,
      ),
    );
    const librarySevereDistinctMinute = this.parsePositiveNumber(
      library.severeDistinctArticlesPerMinute,
      Number(
        SECURITY_SETTINGS_DEFAULTS.SECURITY_LIBRARY_ABUSE_SEVERE_DISTINCT_MINUTE_HITS,
      ),
    );
    const testCreationWindowSeconds = this.parsePositiveNumber(
      tests.createTestAbuseWindowSeconds,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_TEST_CREATION_ABUSE_WINDOW_SECONDS),
    );
    const testCreationMaxHits = this.parsePositiveNumber(
      tests.createTestAbuseMaxHits,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_TEST_CREATION_ABUSE_MAX_HITS),
    );
    const dailyCapSpamWindowSeconds = this.parsePositiveNumber(
      tests.dailyCapSpamWindowSeconds,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_DAILY_TEST_CAP_SPAM_WINDOW_SECONDS),
    );
    const dailyCapSpamThreshold = this.parsePositiveNumber(
      tests.dailyCapSpamThreshold,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_DAILY_TEST_CAP_SPAM_THRESHOLD),
    );
    const cooldownSeconds = this.parsePositiveNumber(
      advanced.cooldownSeconds,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_COOLDOWN_SECONDS),
    );
    const contentLockSeconds = this.parsePositiveNumber(
      advanced.contentLockSeconds,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_CONTENT_LOCK_SECONDS),
    );
    const repeatOffenseMultiplier = this.parsePositiveNumber(
      advanced.repeatOffenseMultiplier,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_REPEAT_OFFENSE_MULTIPLIER),
    );
    const testExplanationWindowSeconds = this.parsePositiveNumber(
      advanced.testExplanationWindowSeconds,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_TEST_EXPLANATION_WINDOW_SECONDS),
    );
    const testExplanationMaxHits = this.parsePositiveNumber(
      advanced.testExplanationMaxHits,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_TEST_EXPLANATION_MAX_HITS),
    );
    const testExplanationSameTargetMaxHits = this.parsePositiveNumber(
      advanced.testExplanationSameTargetMaxHits,
      Number(
        SECURITY_SETTINGS_DEFAULTS.SECURITY_TEST_EXPLANATION_SAME_TARGET_MAX_HITS,
      ),
    );
    const testExplanationExactEndpointMaxHits = this.parsePositiveNumber(
      advanced.testExplanationExactEndpointMaxHits,
      Number(
        SECURITY_SETTINGS_DEFAULTS.SECURITY_TEST_EXPLANATION_EXACT_ENDPOINT_MAX_HITS,
      ),
    );
    const testExplanationDistinctMinuteMax = this.parsePositiveNumber(
      advanced.testExplanationDistinctMinuteMax,
      Number(
        SECURITY_SETTINGS_DEFAULTS.SECURITY_TEST_EXPLANATION_DISTINCT_MINUTE_MAX,
      ),
    );
    const testExplanationDistinctHourMax = this.parsePositiveNumber(
      advanced.testExplanationDistinctHourMax,
      Number(
        SECURITY_SETTINGS_DEFAULTS.SECURITY_TEST_EXPLANATION_DISTINCT_HOUR_MAX,
      ),
    );
    const testExplanationDistinctDayMax = this.parsePositiveNumber(
      advanced.testExplanationDistinctDayMax,
      Number(
        SECURITY_SETTINGS_DEFAULTS.SECURITY_TEST_EXPLANATION_DISTINCT_DAY_MAX,
      ),
    );
    const testExplanationDailyHardCap = this.parsePositiveNumber(
      advanced.testExplanationDailyHardCap,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_TEST_EXPLANATION_DAILY_HARD_CAP),
    );
    const testPracticeDistinctMinuteMax = this.parsePositiveNumber(
      advanced.testPracticeDistinctMinuteMax,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_TEST_PRACTICE_DISTINCT_MINUTE_MAX),
    );
    const testPracticeDistinctHourMax = this.parsePositiveNumber(
      advanced.testPracticeDistinctHourMax,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_TEST_PRACTICE_DISTINCT_HOUR_MAX),
    );
    const testPracticeDistinctDayMax = this.parsePositiveNumber(
      advanced.testPracticeDistinctDayMax,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_TEST_PRACTICE_DISTINCT_DAY_MAX),
    );
    const testPracticeDailyHardCap = this.parsePositiveNumber(
      advanced.testPracticeDailyHardCap,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_TEST_PRACTICE_DAILY_HARD_CAP),
    );
    const testPayloadDistinctMinuteMax = this.parsePositiveNumber(
      advanced.testPayloadDistinctMinuteMax,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_TEST_PAYLOAD_DISTINCT_MINUTE_MAX),
    );
    const testPayloadDistinctHourMax = this.parsePositiveNumber(
      advanced.testPayloadDistinctHourMax,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_TEST_PAYLOAD_DISTINCT_HOUR_MAX),
    );
    const testPayloadDistinctDayMax = this.parsePositiveNumber(
      advanced.testPayloadDistinctDayMax,
      Number(SECURITY_SETTINGS_DEFAULTS.SECURITY_TEST_PAYLOAD_DISTINCT_DAY_MAX),
    );

    await this.writeSetting(applied, "SECURITY_FREE_LIBRARY_DAILY_ARTICLE_CAP", library.freeDailyArticleCap, adminEmail);
    await this.writeSetting(applied, "SECURITY_LIBRARY_QUOTA_COUNT_UNIQUE_ONLY", library.countUniqueOnly, adminEmail);
    await this.writeSetting(applied, "SECURITY_LIBRARY_QUOTA_COUNT_ONLY_ARTICLE_OPENS", "true", adminEmail);

    await this.writeSetting(applied, "SECURITY_LIBRARY_ARTICLE_WINDOW_SECONDS", String(libraryWindowSeconds), adminEmail);
    await this.writeSetting(applied, "SECURITY_LIBRARY_ARTICLE_MAX_HITS", String(libraryMaxRequests), adminEmail);
    await this.writeSetting(applied, "SECURITY_LIBRARY_ARTICLE_SAME_TARGET_MAX_HITS", String(librarySameArticleMaxHits), adminEmail);
    await this.writeSetting(applied, "SECURITY_LIBRARY_ARTICLE_EXACT_ENDPOINT_MAX_HITS", String(librarySameArticleMaxHits), adminEmail);
    await this.writeSetting(applied, "SECURITY_LIBRARY_ARTICLE_DISTINCT_MINUTE_MAX", String(libraryDistinctMinute), adminEmail);
    await this.writeSetting(applied, "SECURITY_LIBRARY_ARTICLE_DISTINCT_HOUR_MAX", String(Math.max(libraryDistinctMinute * 6, libraryDistinctMinute)), adminEmail);
    await this.writeSetting(applied, "SECURITY_LIBRARY_ARTICLE_DISTINCT_DAY_MAX", String(Math.max(libraryDistinctMinute * 20, libraryDistinctMinute)), adminEmail);

    await this.writeSetting(applied, "SECURITY_LIBRARY_STRUCTURE_WINDOW_SECONDS", String(libraryWindowSeconds), adminEmail);
    await this.writeSetting(applied, "SECURITY_LIBRARY_STRUCTURE_MAX_HITS", String(Math.max(libraryMaxRequests, 20)), adminEmail);
    await this.writeSetting(applied, "SECURITY_LIBRARY_SEARCH_WINDOW_SECONDS", String(libraryWindowSeconds), adminEmail);
    await this.writeSetting(applied, "SECURITY_LIBRARY_SEARCH_MAX_HITS", String(Math.max(Math.floor(libraryMaxRequests * 0.75), 12)), adminEmail);
    await this.writeSetting(applied, "SECURITY_LIBRARY_TOOLTIP_WINDOW_SECONDS", String(tooltipWindowSeconds), adminEmail);
    await this.writeSetting(applied, "SECURITY_LIBRARY_TOOLTIP_MAX_HITS", String(tooltipMaxHits), adminEmail);
    await this.writeSetting(applied, "SECURITY_LIBRARY_TOOLTIP_EXACT_ENDPOINT_WINDOW_SECONDS", String(tooltipExactEndpointWindowSeconds), adminEmail);
    await this.writeSetting(applied, "SECURITY_LIBRARY_TOOLTIP_EXACT_ENDPOINT_MAX_HITS", String(tooltipExactEndpointMaxHits), adminEmail);
    await this.writeSetting(
      applied,
      "SECURITY_LIBRARY_ABUSE_AUTO_DEACTIVATE_ENABLED",
      library.autoDeactivateOnAbuse ?? "false",
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_LIBRARY_ABUSE_STRIKE_THRESHOLD",
      library.abuseStrikeThreshold ?? "5",
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_LIBRARY_ABUSE_SEVERE_EXACT_ENDPOINT_HITS",
      String(librarySevereSameArticleHits),
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_LIBRARY_ABUSE_SEVERE_DISTINCT_MINUTE_HITS",
      String(librarySevereDistinctMinute),
      adminEmail,
    );

    await this.writeSetting(applied, "SECURITY_FREE_USER_TOTAL_TEST_CAP", tests.freeTotalTests, adminEmail);
    await this.writeSetting(applied, "SECURITY_FREE_USER_TOTAL_TEST_CAP_GRANDFATHER_EXISTING", "true", adminEmail);
    await this.writeSetting(applied, "SECURITY_ALL_USER_DAILY_TEST_CAP", tests.dailyTestCap, adminEmail);
    await this.writeSetting(
      applied,
      "SECURITY_DAILY_TEST_CAP_SPAM_WINDOW_SECONDS",
      String(dailyCapSpamWindowSeconds),
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_DAILY_TEST_CAP_SPAM_THRESHOLD",
      String(dailyCapSpamThreshold),
      adminEmail,
    );
    await this.writeSetting(applied, "SECURITY_TEST_PROTECTION_ROLE_SCOPE", "user", adminEmail);
    await this.writeSetting(applied, "SECURITY_TEST_CREATION_ABUSE_WINDOW_SECONDS", String(testCreationWindowSeconds), adminEmail);
    await this.writeSetting(applied, "SECURITY_TEST_CREATION_ABUSE_MAX_HITS", String(testCreationMaxHits), adminEmail);
    await this.writeSetting(
      applied,
      "SECURITY_TEST_CREATION_ABUSE_STRIKE_THRESHOLD",
      tests.abuseStrikeThreshold ?? "2",
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_TEST_CREATION_AUTO_DEACTIVATE_ENABLED",
      tests.autoDeactivateOnAbuse ?? "true",
      adminEmail,
    );

    await this.writeSetting(applied, "SECURITY_SCRAPING_PROTECTION_ENABLED", account.protectionEnabled, adminEmail);
    await this.writeSetting(applied, "SECURITY_COOLDOWN_SECONDS", String(cooldownSeconds), adminEmail);
    await this.writeSetting(applied, "SECURITY_CONTENT_LOCK_SECONDS", String(contentLockSeconds), adminEmail);
    await this.writeSetting(applied, "SECURITY_REPEAT_OFFENSE_MULTIPLIER", String(repeatOffenseMultiplier), adminEmail);
    await this.writeSetting(applied, "SECURITY_AUTO_DEACTIVATE_ROLE_SCOPE", account.autoDeactivateRoleScope, adminEmail);
    
    await this.writeSetting(applied, "SECURITY_OTP_MAX_PER_WINDOW", otp.maxPerWindow, adminEmail);
    await this.writeSetting(applied, "SECURITY_OTP_WINDOW_SECONDS", otp.windowSeconds, adminEmail);
    await this.writeSetting(
      applied,
      "SECURITY_TEST_EXPLANATION_WINDOW_SECONDS",
      String(testExplanationWindowSeconds),
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_TEST_EXPLANATION_MAX_HITS",
      String(testExplanationMaxHits),
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_TEST_EXPLANATION_SAME_TARGET_MAX_HITS",
      String(testExplanationSameTargetMaxHits),
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_TEST_EXPLANATION_EXACT_ENDPOINT_MAX_HITS",
      String(testExplanationExactEndpointMaxHits),
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_TEST_EXPLANATION_DISTINCT_MINUTE_MAX",
      String(testExplanationDistinctMinuteMax),
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_TEST_EXPLANATION_DISTINCT_HOUR_MAX",
      String(testExplanationDistinctHourMax),
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_TEST_EXPLANATION_DISTINCT_DAY_MAX",
      String(testExplanationDistinctDayMax),
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_TEST_EXPLANATION_DAILY_HARD_CAP",
      String(testExplanationDailyHardCap),
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_TEST_PRACTICE_DISTINCT_MINUTE_MAX",
      String(testPracticeDistinctMinuteMax),
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_TEST_PRACTICE_DISTINCT_HOUR_MAX",
      String(testPracticeDistinctHourMax),
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_TEST_PRACTICE_DISTINCT_DAY_MAX",
      String(testPracticeDistinctDayMax),
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_TEST_PRACTICE_DAILY_HARD_CAP",
      String(testPracticeDailyHardCap),
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_TEST_PAYLOAD_DISTINCT_MINUTE_MAX",
      String(testPayloadDistinctMinuteMax),
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_TEST_PAYLOAD_DISTINCT_HOUR_MAX",
      String(testPayloadDistinctHourMax),
      adminEmail,
    );
    await this.writeSetting(
      applied,
      "SECURITY_TEST_PAYLOAD_DISTINCT_DAY_MAX",
      String(testPayloadDistinctDayMax),
      adminEmail,
    );

    await this.writeSetting(applied, "SECURITY_IP_BLOCKING_ENABLED", ipBlocking.enabled, adminEmail);
    await this.writeSetting(applied, "SECURITY_BLOCKED_IP_SCOPE", "all_requests", adminEmail);
    await this.writeSetting(applied, "SECURITY_DEACTIVATE_ALSO_BLOCK_IP", ipBlocking.deactivateAlsoBlocksIp, adminEmail);

    await this.writeSetting(applied, "ENABLE_TELEGRAM_SECURITY_ALERTS", alerts.telegramEnabled, adminEmail);
    await this.writeSetting(applied, "SECURITY_TELEGRAM_CHAT_ID", alerts.securityChatId, adminEmail);
    await this.writeSetting(
      applied,
      "SECURITY_TELEGRAM_ALERT_COOLDOWN_SECONDS",
      SECURITY_SETTINGS_DEFAULTS.SECURITY_TELEGRAM_ALERT_COOLDOWN_SECONDS,
      adminEmail,
    );
    await this.writeSetting(applied, "SECURITY_TELEGRAM_MIN_SEVERITY", alerts.telegramMinSeverity, adminEmail);

    await this.writeSetting(applied, "SECURITY_WATERMARKING_ENABLED", watermarking.enabled, adminEmail);

    // Rate Limiting
    const rateLimiting = body?.rateLimiting || {};
    await this.writeSetting(applied, "RATE_LIMIT_AI_BURST_TTL", rateLimiting.aiBurstTtl, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_AI_BURST_MAX", rateLimiting.aiBurstMax, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_AI_BURST_BLOCK_DURATION", rateLimiting.aiBurstBlockDuration, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_LIBRARY_VIEW_TTL", rateLimiting.libraryViewTtl, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_LIBRARY_VIEW_MAX", rateLimiting.libraryViewMax, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_LIBRARY_VIEW_BLOCK_DURATION", rateLimiting.libraryViewBlockDuration, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_AUTH_TTL", rateLimiting.authTtl, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_AUTH_MAX", rateLimiting.authMax, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_AUTH_BLOCK_DURATION", rateLimiting.authBlockDuration, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_TEST_CREATE_TTL", rateLimiting.testCreateTtl, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_TEST_CREATE_MAX", rateLimiting.testCreateMax, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_TEST_CREATE_BLOCK_DURATION", rateLimiting.testCreateBlockDuration, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_PUBLIC_TTL", rateLimiting.publicTtl, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_PUBLIC_READ_MAX", rateLimiting.publicReadMax, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_PUBLIC_WRITE_MAX", rateLimiting.publicWriteMax, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_PUBLIC_BLOCK_DURATION", rateLimiting.publicBlockDuration, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_MEDIA_TTL", rateLimiting.mediaTtl, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_MEDIA_MAX", rateLimiting.mediaMax, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_MEDIA_BLOCK_DURATION", rateLimiting.mediaBlockDuration, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_JOB_APP_TTL", rateLimiting.jobAppTtl, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_JOB_APP_MAX", rateLimiting.jobAppMax, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_JOB_APP_BLOCK_DURATION", rateLimiting.jobAppBlockDuration, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_BACKOFF_WINDOW", rateLimiting.backoffWindow, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_BACKOFF_MULTIPLIER", rateLimiting.backoffMultiplier, adminEmail);
    await this.writeSetting(applied, "RATE_LIMIT_BACKOFF_MAX_BLOCK_DURATION", rateLimiting.backoffMaxBlockDuration, adminEmail);

    return applied;
  }

  private async readSetting(
    key: keyof typeof SECURITY_SETTINGS_DEFAULTS,
  ): Promise<string> {
    return this.settingsService.getString(key, SECURITY_SETTINGS_DEFAULTS[key]);
  }

  private async writeSetting(
    applied: Record<string, string>,
    key: keyof typeof SECURITY_SETTINGS_DEFAULTS,
    value: any,
    adminEmail: string,
  ) {
    if (value === null || value === undefined || value === "") {
      return;
    }
    await this.settingsService.setString(key, String(value), adminEmail);
    applied[key] = String(value);
  }
}
