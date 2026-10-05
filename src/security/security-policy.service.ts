import { Inject, Injectable } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { SettingsService } from "../settings/settings.service";
import {
  FamilyPolicy,
  SECURITY_SETTINGS_DEFAULTS,
  SecurityPolicyConfig,
  SecuritySeverity,
} from "./security.constants";

const POLICY_CACHE_KEY = "security:policy:config";
const POLICY_CACHE_TTL_MS = 5000;

@Injectable()
export class SecurityPolicyService {
  constructor(
    private readonly settingsService: SettingsService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async getConfig(): Promise<SecurityPolicyConfig> {
    const cached = await this.cacheManager.get<SecurityPolicyConfig>(
      POLICY_CACHE_KEY,
    );
    if (cached) {
      return cached;
    }

    const config: SecurityPolicyConfig = {
      enabled: await this.getBoolean("SECURITY_SCRAPING_PROTECTION_ENABLED"),
      telegramAlertsEnabled: await this.getBoolean(
        "SECURITY_TELEGRAM_ALERTS_ENABLED",
      ),
      watermarkingEnabled: await this.getBoolean(
        "SECURITY_WATERMARKING_ENABLED",
      ),
      scoreMedium: await this.getNumber("SECURITY_SCORE_MEDIUM"),
      scoreHigh: await this.getNumber("SECURITY_SCORE_HIGH"),
      scoreCritical: await this.getNumber("SECURITY_SCORE_CRITICAL"),
      cooldownSeconds: await this.getNumber("SECURITY_COOLDOWN_SECONDS"),
      contentLockSeconds: await this.getNumber("SECURITY_CONTENT_LOCK_SECONDS"),
      strikeWindowSeconds: await this.getNumber("SECURITY_STRIKE_WINDOW_SECONDS"),
      repeatOffenseMultiplier: await this.getNumber(
        "SECURITY_REPEAT_OFFENSE_MULTIPLIER",
      ),
      aggregationWindowSeconds: await this.getNumber(
        "SECURITY_AGGREGATION_WINDOW_SECONDS",
      ),
      telegramAlertCooldownSeconds: await this.getNumber(
        "SECURITY_TELEGRAM_ALERT_COOLDOWN_SECONDS",
      ),
      telegramMinSeverity: await this.getSeverity(
        "SECURITY_TELEGRAM_MIN_SEVERITY",
      ),
      testSearchResultLimit: await this.getNumber(
        "SECURITY_TEST_SEARCH_RESULT_LIMIT",
      ),
      testExplanationDailyHardCap: await this.getNumber(
        "SECURITY_TEST_EXPLANATION_DAILY_HARD_CAP",
      ),
      testPracticeDailyHardCap: await this.getNumber(
        "SECURITY_TEST_PRACTICE_DAILY_HARD_CAP",
      ),
      families: {
        library_structure: await this.getFamilyPolicy("SECURITY_LIBRARY_STRUCTURE"),
        library_article: await this.getFamilyPolicy("SECURITY_LIBRARY_ARTICLE"),
        library_search: await this.getFamilyPolicy("SECURITY_LIBRARY_SEARCH"),
        library_tooltip: await this.getFamilyPolicy("SECURITY_LIBRARY_TOOLTIP"),
        test_payload: await this.getFamilyPolicy("SECURITY_TEST_PAYLOAD"),
        test_search: await this.getFamilyPolicy("SECURITY_TEST_SEARCH"),
        test_practice: await this.getFamilyPolicy("SECURITY_TEST_PRACTICE"),
        test_explanation: await this.getFamilyPolicy("SECURITY_TEST_EXPLANATION"),
      },
    };

    await this.cacheManager.set(POLICY_CACHE_KEY, config, POLICY_CACHE_TTL_MS);
    return config;
  }

  async clearCache() {
    await this.cacheManager.del(POLICY_CACHE_KEY);
  }

  private async getFamilyPolicy(prefix: string): Promise<FamilyPolicy> {
    return {
      windowSeconds: await this.getNumber(`${prefix}_WINDOW_SECONDS` as any),
      maxHits: await this.getNumber(`${prefix}_MAX_HITS` as any),
      sameTargetWindowSeconds: await this.getNumber(
        `${prefix}_SAME_TARGET_WINDOW_SECONDS` as any,
      ),
      sameTargetMaxHits: await this.getNumber(`${prefix}_SAME_TARGET_MAX_HITS` as any),
      exactEndpointWindowSeconds: await this.getNumber(
        `${prefix}_EXACT_ENDPOINT_WINDOW_SECONDS` as any,
      ),
      exactEndpointMaxHits: await this.getNumber(
        `${prefix}_EXACT_ENDPOINT_MAX_HITS` as any,
      ),
      distinctMinuteMax: await this.getNumber(`${prefix}_DISTINCT_MINUTE_MAX` as any),
      distinctHourMax: await this.getNumber(`${prefix}_DISTINCT_HOUR_MAX` as any),
      distinctDayMax: await this.getNumber(`${prefix}_DISTINCT_DAY_MAX` as any),
      scoreBurst: await this.getNumber(`${prefix}_SCORE_BURST` as any),
      scoreSameTarget: await this.getNumber(`${prefix}_SCORE_SAME_TARGET` as any),
      scoreExactEndpoint: await this.getNumber(
        `${prefix}_SCORE_EXACT_ENDPOINT` as any,
      ),
      scoreDistinct: await this.getNumber(`${prefix}_SCORE_DISTINCT` as any),
    };
  }

  private async getBoolean(key: keyof typeof SECURITY_SETTINGS_DEFAULTS) {
    const fallback = SECURITY_SETTINGS_DEFAULTS[key];
    const value = await this.settingsService.getString(key, fallback);
    return String(value).toLowerCase() === "true";
  }

  private async getNumber(key: keyof typeof SECURITY_SETTINGS_DEFAULTS) {
    return this.settingsService.getNumber(
      key,
      Number(SECURITY_SETTINGS_DEFAULTS[key]),
    );
  }

  private async getSeverity(
    key: keyof typeof SECURITY_SETTINGS_DEFAULTS,
  ): Promise<SecuritySeverity> {
    const value = await this.settingsService.getString(
      key,
      SECURITY_SETTINGS_DEFAULTS[key],
    );
    if (value === "low" || value === "medium" || value === "high") {
      return value;
    }
    return "critical";
  }
}
