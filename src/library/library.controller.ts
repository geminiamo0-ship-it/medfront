import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  Query,
  Post,
  Put,
  Body,
  Delete,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LibraryService } from "./library.service";
import { AIService } from "./ai.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ArticleAiSummary } from "../entities/article-ai-summary.entity";
import { AiUsageLog } from "../entities/ai-usage-log.entity";
import { SubscriptionPlan } from "../entities/user.entity";
import { AI_BURST_THROTTLE, LIBRARY_VIEW_THROTTLE } from "../rate-limit/rate-limit.constants";
import { ActivityService } from "../activity/activity.service";
import { ContentSecurityGuard } from "../security/content-security.guard";
import { SecurityWatermarkService } from "../security/security-watermark.service";
import { SecurityQuotaService } from "../security/security-quota.service";
import { SettingsService } from "../settings/settings.service";
import { getClientIp } from "../rate-limit/rate-limit.utils";
import { TelegramService } from "../integrations/telegram.service";

const AI_ARTICLE_FEATURE_KEY = "article_explain";

@Controller("library")
@UseGuards(JwtAuthGuard, ContentSecurityGuard)
export class LibraryController {
  private readonly logger = new Logger(LibraryController.name);

  constructor(
    private readonly libraryService: LibraryService,
    private readonly aiService: AIService,
    @InjectRepository(ArticleAiSummary)
    private readonly summaryRepo: Repository<ArticleAiSummary>,
    @InjectRepository(AiUsageLog)
    private readonly usageRepo: Repository<AiUsageLog>,
    private readonly activityService: ActivityService,
    private readonly securityWatermarkService: SecurityWatermarkService,
    private readonly securityQuotaService: SecurityQuotaService,
    private readonly settingsService: SettingsService,
    private readonly telegramService: TelegramService,
  ) {}

  @Get("structure")
  @UseGuards(JwtAuthGuard)
  async getLibraryStructure(
    @Request() req,
    @Query("source") source?: string,
    @Query("force") force?: string,
  ) {
    const forceRefresh = String(force || "").toLowerCase() === "true" || force === "1";
    return this.libraryService.getStructure(req.user.id, source, forceRefresh);
  }

  @Get("resolve-external-caller")
  @UseGuards(JwtAuthGuard)
  async resolveExternalCaller(
    @Request() req,
    @Query("externalCaller") externalCaller: string,
    @Query("source") source?: string,
  ) {
    const article = await this.libraryService.getArticleByExternalCaller(
      externalCaller,
      req.user.id,
      source,
    );
    return { articleId: article.id };
  }

  @Get("article/:id")
  @UseGuards(JwtAuthGuard)
  @Throttle(LIBRARY_VIEW_THROTTLE)
  async getArticle(@Param("id") id: string, @Request() req) {
    const userId = req.user.id;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const article = await this.libraryService.getArticle(id, userId);
    await this.securityQuotaService.assertAndRecordLibraryArticleView({
      user: req.user,
      articleId: article.id,
      ip: ipAddress,
      userAgent: typeof userAgent === "string" ? userAgent : null,
      path: req.originalUrl || req.url || `/library/article/${id}`,
    });
    article.content = await this.securityWatermarkService.watermarkHtml(
      article.content,
      {
        userId,
        email: req.user?.email || null,
        contentId: `library:${article.id}`,
        kind: "library_article",
      },
    );

    if (userId) {
      this.activityService.bulkInsert(
        userId,
        [
          {
            feature: "Library",
            action: "FETCH_ARTICLE",
            entityType: "LibraryArticle",
            entityId: article.id,
            metadata: {
              qBankName: article.qbank || article.source || "usmle",
              articleTitle: article.title || article.name,
            },
          },
        ],
        { ipAddress, userAgent }
      ).catch((err) => console.error("Failed to log library article access", err));
    }

    return article;
  }

  @Post("article/:id/read")
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Param("id") id: string, @Request() req) {
    const userId = req.user.id;
    return this.libraryService.markAsRead(id, userId);
  }

  @Post("article/:id/bookmark")
  @UseGuards(JwtAuthGuard)
  async toggleBookmark(@Param("id") id: string, @Request() req) {
    return this.libraryService.toggleBookmark(id, req.user.id);
  }

  @Post("article/:id/highlight")
  @UseGuards(JwtAuthGuard)
  async createHighlight(
    @Param("id") id: string,
    @Request() req,
    @Body()
    body: {
      text: string;
      annotation?: string;
      color?: string;
      rangeIndex?: number;
    },
  ) {
    return this.libraryService.createHighlight(
      req.user.id,
      id,
      body.text,
      body.annotation,
      body.color,
      body.rangeIndex,
    );
  }

  @Delete("highlight/:id")
  @UseGuards(JwtAuthGuard)
  async deleteHighlight(@Param("id") id: string, @Request() req) {
    return this.libraryService.deleteHighlight(id, req.user.id);
  }

  @Get("article/:id/highlights")
  @UseGuards(JwtAuthGuard)
  async getHighlights(@Param("id") id: string, @Request() req) {
    return this.libraryService.getHighlights(req.user.id, id);
  }


  @Get("bookmarks/state")
  @UseGuards(JwtAuthGuard)
  async getBookmarkState(@Request() req) {
    return this.libraryService.getBookmarkState(req.user.id);
  }

  @Put("bookmarks/state")
  @UseGuards(JwtAuthGuard)
  async saveBookmarkState(
    @Request() req,
    @Body()
    body: { folders?: string[]; assignments?: Record<string, string[]> },
  ) {
    return this.libraryService.saveBookmarkState(
      req.user.id,
      body?.folders || [],
      body?.assignments || {},
    );
  }

  @Get("tooltips")
  @UseGuards(JwtAuthGuard)
  async getTooltips(
    @Query("eids") eids: string,
    @Query("source") source?: string,
  ) {
    const ids = (eids || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    return this.libraryService.getTooltips(ids, source);
  }


  @Get("search")
  @UseGuards(JwtAuthGuard)
  async searchArticles(
    @Request() req,
    @Query("q") q: string,
    @Query("source") source?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const safeLimit = Number(limit) || 50;
    const safeOffset = Number(offset) || 0;
    return this.libraryService.searchArticles(req.user.id, q, source, safeLimit, safeOffset);
  }

  // ——— AI Article Summary ————————————————————————————————————————

  /**
   * GET /library/article/:id/ai-summary
   * Returns the cached AI summary for this user+article, or null if none.
   */
  @Get("article/:id/ai-summary")
  @UseGuards(JwtAuthGuard)
  async getAiSummary(@Param("id") id: string, @Request() req) {
    const userId = req.user.id;
    const resolvedArticleId = await this.libraryService.resolveArticleId(id);
    const existing = await this.summaryRepo.findOne({
      where: { userId, articleId: resolvedArticleId },
    });
    return existing
      ? {
          exists: true,
          content: existing.content,
          updatedAt: existing.updatedAt,
        }
      : { exists: false, content: null };
  }

  /**
   * POST /library/article/:id/ai-summary
   * Generates (or returns cached) AI summary. Premium-only, rate-limited.
   */
  @Post("article/:id/ai-summary")
  @UseGuards(JwtAuthGuard)
  @Throttle(AI_BURST_THROTTLE)
  @HttpCode(HttpStatus.OK)
  async generateAiSummary(@Param("id") id: string, @Request() req) {
    const user = req.user;
    const resolvedArticleId = await this.libraryService.resolveArticleId(id);

    // —— 1. Determine plan ——————————————————————————————————————
    const isPremium =
      user.subscriptionPlan !== SubscriptionPlan.FREE &&
      user.subscriptionExpiry &&
      new Date(user.subscriptionExpiry) > new Date();
    const userPlan = isPremium ? 'premium' : 'free';

    // —— 2. Check cache first (cached hits are FREE — no rate limit cost) ———————
    const existing = await this.summaryRepo.findOne({
      where: { userId: user.id, articleId: resolvedArticleId },
    });
    if (existing) {
      return {
        exists: true,
        cached: true,
        content: existing.content,
        updatedAt: existing.updatedAt,
      };
    }

    // —— 3. Global + per-user quota check ————————————————————————————
    const todayUtc = new Date().toISOString().split("T")[0];

    const [freeLimit, premiumLimit, globalLimit, [globalRow]] = await Promise.all([
      this.settingsService.getNumber('AI_DAILY_PER_USER_FREE', 5),
      this.settingsService.getNumber('AI_DAILY_PER_USER_PREMIUM', 50),
      this.settingsService.getNumber('AI_DAILY_GLOBAL_LIMIT', 500),
      this.usageRepo.query(
        `SELECT COALESCE(SUM("callCount"), 0)::int AS total
         FROM ai_usage_logs
         WHERE "featureKey" IN ('ai_tutor', 'article_explain') AND "usageDate" = $1`,
        [todayUtc],
      ),
    ]);

    // Global cap
    const globalTotal = globalRow?.total ?? 0;
    if (globalTotal >= globalLimit) {
      throw new HttpException(
        {
          code: 'AI_GLOBAL_LIMIT_EXCEEDED',
          message: 'The AI model is currently exhausted due to high demand. Please try again later.',
          limit: globalLimit,
          userPlan: 'global',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Per-user cap
    const limit = isPremium ? premiumLimit : freeLimit;

    const [currentRow] = await this.usageRepo.query(
      `SELECT COALESCE(SUM("callCount"), 0)::int AS count
       FROM ai_usage_logs
       WHERE "userId" = $1 AND "featureKey" IN ('ai_tutor', 'article_explain') AND "usageDate" = $2`,
      [user.id, todayUtc],
    );
    const currentCount = currentRow ? currentRow.count : 0;

    if (currentCount >= limit) {
      throw new HttpException(
        {
          code: 'AI_LIMIT_EXCEEDED',
          message: isPremium
            ? 'You\'ve reached your usage limit. Your limit will reset tomorrow.'
            : 'You\'ve reached your usage limit. Upgrade to Premium for more daily explanations.',
          userPlan,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // —— 4. Increment (only after check passes) ————————————————————————
    await this.usageRepo.query(
      `INSERT INTO ai_usage_logs ("userId", "featureKey", "usageDate", "callCount")
       VALUES ($1, $2, $3, 1)
       ON CONFLICT ("userId", "featureKey", "usageDate")
       DO UPDATE SET "callCount" = ai_usage_logs."callCount" + 1`,
      [user.id, AI_ARTICLE_FEATURE_KEY, todayUtc],
    );

    // Fire-and-forget: check AI global usage thresholds for Telegram alerts
    this.checkGlobalAiThreshold(todayUtc);

    // —— 5. Fetch article and generate —————————————————————————————————
    const article = await this.libraryService.getArticle(resolvedArticleId, user.id);
    if (!article) {
      throw new ForbiddenException("Article not found.");
    }

    const content = await this.aiService.analyzeFullArticle(
      article.name,
      article.contentHtml || article.content || "",
    );

    // —— 6. Cache and return ———————————————————————————————————————
    const summary = this.summaryRepo.create({
      userId: user.id,
      articleId: resolvedArticleId,
      content,
    });
    await this.summaryRepo.save(summary);

    await this.usageRepo.query(
      `INSERT INTO ai_usage_logs ("userId", "featureKey", "usageDate", "callCount", "successCalls")
       VALUES ($1, $2, $3, 0, 1)
       ON CONFLICT ("userId", "featureKey", "usageDate")
       DO UPDATE SET "successCalls" = ai_usage_logs."successCalls" + 1`,
      [user.id, AI_ARTICLE_FEATURE_KEY, todayUtc],
    );

    return {
      exists: true,
      cached: false,
      content,
      updatedAt: summary.createdAt,
    };
  }

  /**
   * POST /library/article/:id/ai-summary/regenerate
   * Forces re-generation even if a cached summary exists (counts against rate limit).
   */
  @Post("article/:id/ai-summary/regenerate")
  @UseGuards(JwtAuthGuard)
  @Throttle(AI_BURST_THROTTLE)
  @HttpCode(HttpStatus.OK)
  async regenerateAiSummary(@Param("id") id: string, @Request() req) {
    const user = req.user;
    const resolvedArticleId = await this.libraryService.resolveArticleId(id);

    const isPremium =
      user.subscriptionPlan !== SubscriptionPlan.FREE &&
      user.subscriptionExpiry &&
      new Date(user.subscriptionExpiry) > new Date();
    const userPlan = isPremium ? 'premium' : 'free';

    // —— Global + per-user quota check ————————————————————————————
    const todayUtc = new Date().toISOString().split("T")[0];

    const [freeLimit, premiumLimit, globalLimit, [globalRow]] = await Promise.all([
      this.settingsService.getNumber('AI_DAILY_PER_USER_FREE', 5),
      this.settingsService.getNumber('AI_DAILY_PER_USER_PREMIUM', 50),
      this.settingsService.getNumber('AI_DAILY_GLOBAL_LIMIT', 500),
      this.usageRepo.query(
        `SELECT COALESCE(SUM("callCount"), 0)::int AS total
         FROM ai_usage_logs
         WHERE "featureKey" IN ('ai_tutor', 'article_explain') AND "usageDate" = $1`,
        [todayUtc],
      ),
    ]);

    // Global cap
    const globalTotal = globalRow?.total ?? 0;
    if (globalTotal >= globalLimit) {
      throw new HttpException(
        {
          code: 'AI_GLOBAL_LIMIT_EXCEEDED',
          message: 'The AI model is currently exhausted due to high demand. Please try again later.',
          limit: globalLimit,
          userPlan: 'global',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Per-user cap
    const limit = isPremium ? premiumLimit : freeLimit;

    const [currentRow] = await this.usageRepo.query(
      `SELECT COALESCE(SUM("callCount"), 0)::int AS count
       FROM ai_usage_logs
       WHERE "userId" = $1 AND "featureKey" IN ('ai_tutor', 'article_explain') AND "usageDate" = $2`,
      [user.id, todayUtc],
    );
    const currentCount = currentRow ? currentRow.count : 0;

    if (currentCount >= limit) {
      throw new HttpException(
        {
          code: 'AI_LIMIT_EXCEEDED',
          message: isPremium
            ? 'You\'ve reached your usage limit. Your limit will reset tomorrow.'
            : 'You\'ve reached your usage limit. Upgrade to Premium for more daily explanations.',
          userPlan,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment after check
    await this.usageRepo.query(
      `INSERT INTO ai_usage_logs ("userId", "featureKey", "usageDate", "callCount")
       VALUES ($1, $2, $3, 1)
       ON CONFLICT ("userId", "featureKey", "usageDate")
       DO UPDATE SET "callCount" = ai_usage_logs."callCount" + 1`,
      [user.id, AI_ARTICLE_FEATURE_KEY, todayUtc],
    );

    // Fire-and-forget: check AI global usage thresholds for Telegram alerts
    this.checkGlobalAiThreshold(todayUtc);

    // Generate fresh
    const article = await this.libraryService.getArticle(resolvedArticleId, user.id);
    const content = await this.aiService.analyzeFullArticle(
      article.name,
      article.contentHtml || article.content || "",
    );

    // Upsert (update existing or create)
    await this.summaryRepo.upsert(
      { userId: user.id, articleId: resolvedArticleId, content },
      ["userId", "articleId"],
    );

    await this.usageRepo.query(
      `INSERT INTO ai_usage_logs ("userId", "featureKey", "usageDate", "callCount", "successCalls")
       VALUES ($1, $2, $3, 0, 1)
       ON CONFLICT ("userId", "featureKey", "usageDate")
       DO UPDATE SET "successCalls" = ai_usage_logs."successCalls" + 1`,
      [user.id, AI_ARTICLE_FEATURE_KEY, todayUtc],
    );

    const updated = await this.summaryRepo.findOne({
      where: { userId: user.id, articleId: resolvedArticleId },
    });
    return {
      exists: true,
      cached: false,
      content,
      updatedAt: updated?.updatedAt,
    };
  }

  /**
   * Query the current global AI usage and fire a threshold alert if warranted.
   * Runs fire-and-forget so it never blocks the API response.
   */
  private checkGlobalAiThreshold(todayUtc: string): void {
    (async () => {
      try {
        const [globalLimit, [globalRow]] = await Promise.all([
          this.settingsService.getNumber('AI_DAILY_GLOBAL_LIMIT', 500),
          this.usageRepo.query(
            `SELECT COALESCE(SUM("callCount"), 0)::int AS total
             FROM ai_usage_logs
             WHERE "featureKey" IN ('ai_tutor', 'article_explain') AND "usageDate" = $1`,
            [todayUtc],
          ),
        ]);
        const total = globalRow?.total ?? 0;
        await this.telegramService.checkAndAlertAiUsageThreshold(total, globalLimit);
      } catch (err) {
        this.logger.warn('AI usage threshold check failed', err?.message);
      }
    })();
  }
}
