import { Injectable, Inject, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import axios from "axios";
import { SettingsService } from "../settings/settings.service";
import { safeCacheGet, safeCacheSet } from "../cache/safe-cache.util";

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private getBotToken(): string | null {
    return this.configService.get<string>("TELEGRAM_BOT_TOKEN") || null;
  }

  /** Monitor bot token — used for health checks, 500 errors, startup pings.
   *  Falls back to the main bot token if not set. */
  private getMonitorBotToken(): string | null {
    return this.configService.get<string>("TELEGRAM_MONITOR_BOT_TOKEN")
      || this.getBotToken();
  }

  private getAdminChatId(): string | null {
    return this.configService.get<string>("TELEGRAM_ADMIN_CHAT_ID") || null;
  }

  /** Monitor chat — health checks, 500 errors, startup pings.
   *  Falls back to admin chat if not configured. */
  private getMonitorChatId(): string | null {
    return this.configService.get<string>("TELEGRAM_MONITOR_CHAT_ID")
      || this.getAdminChatId();
  }

  private async getSecurityChatId(): Promise<string | null> {
    const appSettingChatId = await this.settingsService.getString(
      "SECURITY_TELEGRAM_CHAT_ID",
      "",
    );
    if (appSettingChatId.trim()) {
      return appSettingChatId.trim();
    }
    return this.configService.get<string>("TELEGRAM_SECURITY_CHAT_ID") || null;
  }

  /** Sends via the main bot (payments, security alerts). */
  private async sendMessage(chatId: string, text: string) {
    const token = this.getBotToken();
    if (!token) return;

    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }

  /** Sends via the monitor bot (health checks, 500 errors, startup). */
  private async sendMonitorMessage(chatId: string, text: string) {
    const token = this.getMonitorBotToken();
    if (!token) return;

    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }

  private getSecuritySeverityEmoji(severity: string) {
    switch (String(severity || "").toLowerCase()) {
      case "critical":
        return "🚨";
      case "high":
        return "⚠️";
      case "medium":
        return "🟠";
      case "low":
        return "🔎";
      default:
        return "🛡️";
    }
  }

  private getSecurityActionEmoji(actionTaken: string) {
    switch (String(actionTaken || "").toLowerCase()) {
      case "account_deactivated":
        return "⛔";
      case "ip_blocked":
        return "📵";
      case "content_lock":
      case "content_locked":
        return "🔒";
      case "content_cooldown":
        return "⏳";
      case "soft_throttle":
      case "quota_block":
        return "🚦";
      default:
        return "🧱";
    }
  }

  private getSecurityIncidentEmoji(incidentType: string) {
    switch (String(incidentType || "").toLowerCase()) {
      case "account_auto_deactivated":
        return "💀";
      case "ip_auto_blocked":
        return "🌐";
      case "distinct_target_crawl":
        return "🕷️";
      case "exact_endpoint_spam":
      case "same_target_spam":
      case "test_creation_spam":
        return "🤖";
      case "burst_hits":
        return "💥";
      case "daily_test_cap_reached":
      case "free_library_daily_cap_reached":
      case "free_lifetime_test_cap_reached":
        return "📏";
      default:
        return "🛡️";
    }
  }

  private describeSecurityIncident(payload: {
    endpointLabel: string;
    incidentType: string;
    actionTaken: string;
    hitCountInWindow: number;
    distinctTargetCountInWindow: number;
    targetValue?: string | null;
    lockDurationSeconds: number;
  }) {
    const incidentType = String(payload.incidentType || "").toLowerCase();
    const targetText = payload.targetValue
      ? ` target ${payload.targetValue}`
      : " content";

    switch (incidentType) {
      case "distinct_target_crawl":
        return `The user moved across many different ${payload.endpointLabel.toLowerCase()} targets too quickly (${payload.distinctTargetCountInWindow} distinct targets in the active window), which matches crawl-like scraping behavior.`;
      case "exact_endpoint_spam":
        return `The same endpoint was requested repeatedly (${payload.hitCountInWindow} hits in the active window), which looks like automated endpoint hammering.`;
      case "same_target_spam":
        return `The same${targetText} was requested repeatedly (${payload.hitCountInWindow} hits in the active window), which looks like automated spam.`;
      case "burst_hits":
        return `The request rate became unusually high (${payload.hitCountInWindow} hits in the active window), so the actor was rate-limited.`;
      case "test_creation_spam":
        return `Test creation was triggered too many times in a short period (${payload.hitCountInWindow} creation attempts in the active window).`;
      case "daily_test_cap_spam":
        return `The user kept trying to create tests after hitting the daily cap (${payload.hitCountInWindow} over-limit attempts in the active window).`;
      case "free_lifetime_test_cap_spam":
        return `The user kept trying to create tests after hitting the free lifetime cap (${payload.hitCountInWindow} blocked attempts in the active window).`;
      case "account_auto_deactivated":
        return "The account was automatically deactivated because the configured security escalation threshold was reached.";
      case "ip_auto_blocked":
        return "The IP address was automatically blocked because the security policy escalated to an IP block.";
      case "daily_test_cap_reached":
        return `The account reached the configured daily test-creation cap (${payload.hitCountInWindow} creations in the current day bucket).`;
      case "free_library_daily_cap_reached":
        return "The free user's daily library quota was fully consumed.";
      case "free_lifetime_test_cap_reached":
        return "The free user's lifetime test-creation quota was fully consumed.";
      default:
        return "The security system detected a policy violation and recorded a security incident.";
    }
  }

  private describeSecurityAction(
    actionTaken: string,
    lockDurationSeconds: number,
  ) {
    const action = String(actionTaken || "").toLowerCase();
    switch (action) {
      case "content_cooldown":
        return `The system applied a temporary cooldown for ${lockDurationSeconds}s to slow the actor down and prevent continued scraping.`;
      case "content_lock":
      case "content_locked":
        return `The system temporarily locked access to the protected content for ${lockDurationSeconds}s because the behavior crossed a stronger threshold.`;
      case "soft_throttle":
        return "The system throttled the actor instead of locking the account so requests must slow down.";
      case "quota_block":
        return "The system blocked the action because the configured quota or protection rule was reached.";
      case "account_deactivated":
        return "The system disabled the account automatically based on the configured abuse escalation policy.";
      case "ip_blocked":
        return "The system blocked the IP address so requests from this network are denied until it is unblocked.";
      default:
        return "The system recorded the event and applied the configured security response.";
    }
  }

  async sendAdminPaymentAlert(payload: {
    userEmail: string;
    telegramUsername?: string | null;
    planName: string;
    amount: number;
    currency?: string;
    paymentReference: string;
    paymentId: number;
    promoCodeValue?: string | null;
    promoCodeDiscountPercent?: number | null;
    promoCodeOwnerEmail?: string | null;
    referralCode?: string | null;
  }) {
    const rawEnabled = await this.settingsService.getString(
      "ENABLE_TELEGRAM_PAYMENT_ALERTS",
      "false",
    );
    if (rawEnabled.toLowerCase() !== "true") {
      return;
    }

    const chatId = this.getAdminChatId();
    if (!chatId) {
      return;
    }

    const amountStr = payload.currency && payload.currency !== "USD"
      ? `${payload.amount} ${payload.currency}`
      : `$${payload.amount} USD`;

    const message = [
      "🧾 <b>New payment request</b>",
      `User: <b>${payload.userEmail}</b>`,
      payload.telegramUsername
        ? `Telegram: <b>@${payload.telegramUsername.replace(/^@/, "")}</b>`
        : null,
      `Plan: <b>${payload.planName}</b>`,
      `Amount: <b>${amountStr}</b>`,
      payload.promoCodeValue
        ? `🎟 Coupon: <code>${payload.promoCodeValue}</code>${payload.promoCodeDiscountPercent ? ` (${payload.promoCodeDiscountPercent}% off)` : ""}`
        : null,
      payload.promoCodeValue && payload.promoCodeOwnerEmail
        ? `💰 Affiliate: <b>${payload.promoCodeOwnerEmail}</b> — commission required`
        : null,
      !payload.promoCodeValue && payload.referralCode
        ? `🔗 Referral: <code>${payload.referralCode}</code> — commission required`
        : null,
      `Reference: <code>${payload.paymentReference}</code>`,
    ]
      .filter(Boolean)
      .join("\n");

    await this.sendMessage(chatId, message);
  }

  async sendOtpLimitAlert(payload: {
    email: string;
    requestCount: number;
    limit: number;
    timeWindow: string;
  }) {
    const rawEnabled = await this.settingsService.getString(
      "ENABLE_TELEGRAM_SECURITY_ALERTS",
      "true",
    );
    if (rawEnabled.toLowerCase() !== "true") {
      return;
    }

    const chatId = await this.getSecurityChatId();
    if (!chatId) {
      return;
    }

    const message = [
      "🚨 <b>OTP Rate Limit Triggered</b>",
      `Email: <b>${payload.email}</b>`,
      `Requests: <b>${payload.requestCount}</b> (Limit: ${payload.limit})`,
      `Window: <b>${payload.timeWindow}</b>`,
      `Action: <b>Temporarily Blocked</b>`,
    ].join("\n");

    try {
      await this.sendMessage(chatId, message);
    } catch (err) {
      this.logger.error("Failed to send OTP telegram alert", err);
    }
  }

  async sendAdminSecurityAlert(payload: {
    severity: string;
    userId?: number | null;
    userEmail?: string | null;
    ip: string;
    endpointFamily: string;
    endpointLabel: string;
    exactEndpoint: string;
    normalizedRoute: string;
    targetValue?: string | null;
    incidentType: string;
    actionTaken: string;
    scoreDelta: number;
    cumulativeScore: number;
    hitCountInWindow: number;
    distinctTargetCountInWindow: number;
    lockDurationSeconds: number;
    incidentId: number;
  }) {
    const rawEnabled = await this.settingsService.getString(
      "ENABLE_TELEGRAM_SECURITY_ALERTS",
      "true",
    );
    if (rawEnabled.toLowerCase() !== "true") {
      return;
    }

    const chatId = await this.getSecurityChatId();
    if (!chatId) {
      return;
    }

    const severityEmoji = this.getSecuritySeverityEmoji(payload.severity);
    const actionEmoji = this.getSecurityActionEmoji(payload.actionTaken);
    const incidentEmoji = this.getSecurityIncidentEmoji(payload.incidentType);
    const incidentSummary = this.describeSecurityIncident(payload);
    const actionSummary = this.describeSecurityAction(
      payload.actionTaken,
      payload.lockDurationSeconds,
    );

    const message = [
      `${severityEmoji} <b>${payload.severity.toUpperCase()} Security Alert</b>`,
      payload.userEmail
        ? `User: <b>${payload.userEmail}</b>${payload.userId ? ` (ID ${payload.userId})` : ""}`
        : payload.userId
          ? `User ID: <b>${payload.userId}</b>`
          : null,
      `IP: <code>${payload.ip}</code>`,
      `Area: <b>${payload.endpointLabel}</b>`,
      `Detected: ${incidentEmoji} <code>${payload.incidentType}</code>`,
      `Response: ${actionEmoji} <code>${payload.actionTaken}</code>`,
      "",
      `<b>What happened</b>`,
      incidentSummary,
      "",
      `<b>What the system did</b>`,
      actionSummary,
      "",
      `<b>Technical details</b>`,
      `Endpoint: <code>${payload.exactEndpoint}</code>`,
      `Route: <code>${payload.normalizedRoute}</code>`,
      payload.targetValue
        ? `Target: <code>${payload.targetValue}</code>`
        : null,
      `Hits: <b>${payload.hitCountInWindow}</b>`,
      `Distinct targets: <b>${payload.distinctTargetCountInWindow}</b>`,
      `Score: <b>+${payload.scoreDelta}</b> (total ${payload.cumulativeScore})`,
      payload.lockDurationSeconds > 0
        ? `Lock/Cooldown: <b>${payload.lockDurationSeconds}s</b>`
        : null,
      `Incident ID: <code>${payload.incidentId}</code>`,
    ]
      .filter(Boolean)
      .join("\n");

    await this.sendMessage(chatId, message);
  }

  async sendAdminSecurityEscalationAlert(payload: {
    userId?: number | null;
    userEmail?: string | null;
    ip: string;
    sourceType: string;
    reason: string;
    accountIncidentId: number;
    ipBlocked: boolean;
    ipBlockIncidentId?: number | null;
  }) {
    const rawEnabled = await this.settingsService.getString(
      "ENABLE_TELEGRAM_SECURITY_ALERTS",
      "true",
    );
    if (rawEnabled.toLowerCase() !== "true") {
      return;
    }

    const chatId = await this.getSecurityChatId();
    if (!chatId) {
      return;
    }

    const sourceLabel =
      payload.sourceType === "test_creation_abuse"
        ? "Test Creation Abuse"
        : payload.sourceType === "daily_test_cap_spam"
          ? "Daily Test Cap Spam"
          : payload.sourceType === "daily_test_cap_reached"
            ? "Repeated Daily Test Cap Breach"
            : payload.sourceType === "library_abuse"
              ? "Library Abuse"
              : payload.sourceType;

    const message = [
      `🚨 <b>CRITICAL Security Escalation</b>`,
      payload.userEmail
        ? `User: <b>${payload.userEmail}</b>${payload.userId ? ` (ID ${payload.userId})` : ""}`
        : payload.userId
          ? `User ID: <b>${payload.userId}</b>`
          : null,
      `IP: <code>${payload.ip}</code>`,
      `Source: <b>${sourceLabel}</b>`,
      "",
      `<b>What happened</b>`,
      payload.reason,
      "",
      `<b>What the system did</b>`,
      `⛔ The account was auto-deactivated.`,
      payload.ipBlocked
        ? `📵 The IP address was auto-blocked.`
        : `🌐 No IP block was applied for this escalation.`,
      "",
      `<b>Technical details</b>`,
      `Account incident ID: <code>${payload.accountIncidentId}</code>`,
      payload.ipBlocked && payload.ipBlockIncidentId
        ? `IP block incident ID: <code>${payload.ipBlockIncidentId}</code>`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    await this.sendMessage(chatId, message);
  }

  /**
   * Check global AI usage against thresholds and send a Telegram alert
   * when 50% (medium), 75% (high), or 100% (critical) is reached.
   * Uses a cache-based cooldown so each threshold fires at most once per day.
   */
  async checkAndAlertAiUsageThreshold(currentUsage: number, globalLimit: number): Promise<void> {
    if (globalLimit <= 0) return;

    const percentage = (currentUsage / globalLimit) * 100;
    const todayUtc = new Date().toISOString().split("T")[0];

    // Determine which thresholds have been crossed (check highest first)
    const thresholds: { pct: number; severity: string; emoji: string }[] = [
      { pct: 100, severity: "critical", emoji: "🚨" },
      { pct: 75, severity: "high", emoji: "⚠️" },
      { pct: 50, severity: "medium", emoji: "🟠" },
    ];

    for (const threshold of thresholds) {
      if (percentage < threshold.pct) continue;

      // Check cooldown — only alert once per threshold per day
      const cooldownKey = `ai_usage_alert:${todayUtc}:${threshold.pct}`;
      const alreadySent = await this.cacheManager.get(cooldownKey);
      if (alreadySent) continue;

      // Mark as sent (24h TTL)
      await this.cacheManager.set(cooldownKey, true, 86400 * 1000);

      const chatId = await this.getSecurityChatId();
      if (!chatId) return;

      const remaining = Math.max(0, globalLimit - currentUsage);
      const message = [
        `${threshold.emoji} <b>${threshold.severity.toUpperCase()} — AI Usage Alert</b>`,
        "",
        `The global AI usage has reached <b>${threshold.pct}%</b> of the daily limit.`,
        "",
        `<b>Current usage:</b> ${currentUsage} / ${globalLimit} calls`,
        `<b>Remaining:</b> ${remaining} calls`,
        `<b>Percentage:</b> ${percentage.toFixed(1)}%`,
        "",
        threshold.pct >= 100
          ? "⛔ <b>The global AI limit is now exhausted.</b> All further AI requests will be rejected until the limit resets tomorrow."
          : threshold.pct >= 75
            ? "⚡ The limit is almost exhausted. Consider increasing the limit if usage is expected to continue."
            : "📊 Usage is climbing. This is an informational alert — no action is needed yet.",
      ].join("\n");

      try {
        await this.sendMessage(chatId, message);
        this.logger.log(`AI usage ${threshold.pct}% threshold alert sent (${currentUsage}/${globalLimit})`);
      } catch (error) {
        this.logger.warn(`Failed to send AI usage threshold Telegram alert: ${error}`);
      }

      // Only send the highest applicable threshold alert
      break;
    }
  }

  /**
   * Sends a Telegram alert when the global daily OTP send count crosses a threshold.
   */
  async sendOtpThresholdAlert(payload: {
    dailyCount: number;
    thresholdLevel: string;
    thresholdValue: number;
  }): Promise<void> {
    try {
      const chatId = await this.getSecurityChatId();
      if (!chatId) return;
      const emojiMap: Record<string, string> = { medium: '🟡', high: '🟠', highest: '🔴' };
      const emoji = emojiMap[payload.thresholdLevel] ?? '📊';
      const message = [
        `${emoji} <b>Global OTP Threshold — ${payload.thresholdLevel.toUpperCase()}</b>`,
        ``,
        `Platform has sent <b>${payload.dailyCount}</b> OTP emails today.`,
        `Crossed the <b>${payload.thresholdLevel}</b> threshold of ${payload.thresholdValue}.`,
        ``,
        payload.thresholdLevel === 'highest'
          ? `⛔ Near Resend daily limit. Consider disabling OTP from the admin dashboard.`
          : `⚡ Monitor closely. Disable OTP feature flag if needed.`,
      ].join('\n');
      await this.sendMessage(chatId, message);
    } catch (err) {
      this.logger.warn(`Failed to send global OTP threshold alert: ${err}`);
    }
  }

  async sendTestCreationAbuseAlert(payload: {
    userId: number;
    userEmail: string;
    questionCount: number;
    ip?: string;
  }): Promise<void> {
    try {
      const rawEnabled = await this.settingsService.getString(
        "ENABLE_TELEGRAM_SECURITY_ALERTS",
        "true",
      );
      if (rawEnabled.toLowerCase() !== "true") {
        return;
      }

      const chatId = await this.getSecurityChatId();
      if (!chatId) return;

      const message = [
        `🚨 <b>CRITICAL Security Alert — Test Creation Abuse</b>`,
        ``,
        `User: <b>${payload.userEmail}</b> (ID ${payload.userId})`,
        payload.ip ? `IP: <code>${payload.ip}</code>` : null,
        `Requested Questions: <b>${payload.questionCount}</b>`,
        ``,
        `Action: <b>Test creation capped</b>`,
      ].filter(Boolean).join("\n");

      await this.sendMessage(chatId, message);
    } catch (err) {
      this.logger.warn(`Failed to send test creation abuse alert: ${err}`);
    }
  }

  // ── Health monitoring ────────────────────────────────────────────────────

  async sendHealthAlert(result: {
    status: string;
    db:    { ok: boolean; latencyMs: number; error?: string };
    redis: { ok: boolean; latencyMs: number; error?: string };
    timestamp: string;
  }): Promise<void> {
    try {
      const chatId = this.getMonitorChatId();
      if (!chatId) return;

      const icon = result.status === 'down' ? '🔴' : '🟠';
      const dbLine    = result.db.ok
        ? `🗄 DB: ✅ ok (${result.db.latencyMs}ms)`
        : `🗄 DB: ❌ down${result.db.error ? ` — ${result.db.error}` : ''}`;
      const redisLine = result.redis.ok
        ? `⚡ Redis: ✅ ok (${result.redis.latencyMs}ms)`
        : `⚡ Redis: ❌ down${result.redis.error ? ` — ${result.redis.error}` : ''}`;

      const message = [
        `${icon} <b>MedPark Health Alert</b>`,
        ``,
        `Status: <b>${result.status}</b>`,
        dbLine,
        redisLine,
        `🕐 ${new Date(result.timestamp).toUTCString()}`,
      ].join('\n');

      await this.sendMonitorMessage(chatId, message);
    } catch (err) {
      this.logger.warn(`Failed to send health alert: ${err}`);
    }
  }

  // ── Server error (500) alerts ────────────────────────────────────────────

  async sendErrorAlert(payload: {
    errorId:    string;
    method:     string;
    url:        string;
    errorType?: string;   // e.g. "TypeError", "QueryFailedError"
    message:    string;
    stack?:     string;
    dbDetail?:  string;   // PostgreSQL detail: constraint name, offending key, error code
    userId?:    string | number;
    userName?:  string;
    userEmail?: string;
    ip?:        string;
    userAgent?: string;
  }): Promise<void> {
    try {
      const chatId = this.getMonitorChatId();
      if (!chatId) return;

      // Rate-limit: one alert per normalised route per 60 seconds
      // Normalise both numeric IDs (/42) and UUIDs (/abc-123-...) so bursts
      // on the same endpoint share one key regardless of the resource ID.
      const normUrl = payload.url
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
        .replace(/\/\d+/g, '/:id')
        .split('?')[0];
      const rateKey = `error:alert:${payload.method}:${normUrl}`;
      const limited = await this.cacheManager.get(rateKey);
      if (limited) return;
      await this.cacheManager.set(rateKey, '1', 60 * 1000);

      const esc = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const userLine = (() => {
        const parts: string[] = [];
        if (payload.userName)  parts.push(payload.userName);
        if (payload.userId)    parts.push(`ID: ${payload.userId}`);
        if (payload.userEmail) parts.push(payload.userEmail);
        return parts.length ? `👤 ${parts.join(' | ')}` : '👤 Anonymous';
      })();

      const lines = [
        `🔴 <b>Server Error — <code>${payload.errorId}</code></b>`,
        ``,
        userLine,
        `🌐 <code>${payload.method} ${esc(payload.url)}</code>`,
        payload.ip ? `🖥️ ${esc(payload.ip)}` : null,
        ``,
        `💥 <b>${esc(payload.errorType || 'Error')}</b>: <code>${esc(payload.message.slice(0, 300))}</code>`,
        // DB-specific detail (unique violation, FK error, etc.)
        payload.dbDetail ? `🗄 <code>${esc(payload.dbDetail.slice(0, 300))}</code>` : null,
      ].filter(Boolean).join('\n');

      const stackSection = payload.stack
        ? `\n\n<pre>${esc(payload.stack.slice(0, 900))}</pre>`
        : '';

      await this.sendMonitorMessage(chatId, lines + stackSection);
    } catch (err) {
      this.logger.warn(`Failed to send error alert: ${err}`);
    }
  }

  // ── Database health alerts (pool saturation, statement timeouts) ─────────

  async sendDatabaseAlert(payload: {
    // medium  → sustained-but-not-yet-concerning (e.g. half the pool used)
    // warning → getting close to capacity, watch it
    // critical → act now
    severity: 'medium' | 'warning' | 'critical';
    kind: 'pool_saturation' | 'pool_waiting' | 'statement_timeouts';
    title: string;
    summary: string;
    details?: Record<string, string | number>;
  }): Promise<void> {
    try {
      const chatId = this.getMonitorChatId();
      if (!chatId) return;

      // Rate-limit: at most one alert per (kind, severity) every 10 minutes.
      // Without this, a sustained saturation event would spam the channel
      // every 30s as the monitor cron re-checks.
      //
      // Using safeCacheGet/Set so a Redis outage degrades to "send the alert
      // anyway" (open) rather than throwing and skipping the alert. The DB
      // monitor's whole purpose is paging when things are wrong — silently
      // failing because the rate-limiter cache is down would be the worst
      // possible failure mode.
      const rateKey = `db:alert:${payload.kind}:${payload.severity}`;
      const limited = await safeCacheGet(this.cacheManager, rateKey);
      if (limited) return;
      await safeCacheSet(this.cacheManager, rateKey, '1', 10 * 60 * 1000);

      const icon =
        payload.severity === 'critical' ? '🚨'
        : payload.severity === 'warning' ? '⚠️'
        : '🟡'; // medium
      const label =
        payload.severity === 'critical' ? 'CRITICAL'
        : payload.severity === 'warning' ? 'WARNING'
        : 'MEDIUM';
      const esc = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const detailLines = payload.details
        ? Object.entries(payload.details).map(([k, v]) => `• ${esc(k)}: <b>${esc(String(v))}</b>`)
        : [];

      const message = [
        `${icon} <b>MedPark DB ${label} — ${esc(payload.title)}</b>`,
        ``,
        esc(payload.summary),
        ...(detailLines.length ? ['', ...detailLines] : []),
        ``,
        `🕐 ${new Date().toUTCString()}`,
      ].join('\n');

      await this.sendMonitorMessage(chatId, message);
    } catch (err) {
      this.logger.warn(`Failed to send DB alert: ${err}`);
    }
  }

  // ── App startup notification ─────────────────────────────────────────────

  async sendStartupAlert(): Promise<void> {
    try {
      const chatId = this.getMonitorChatId();
      if (!chatId) return;
      await this.sendMonitorMessage(
        chatId,
        `🟢 <b>MedPark API started</b>\n🕐 ${new Date().toUTCString()}`,
      );
    } catch (err) {
      this.logger.warn(`Failed to send startup alert: ${err}`);
    }
  }
}
