import { Injectable, NotFoundException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionAiExplanation } from '../../entities/question-ai-explanation.entity';
import { Question } from '../../entities/question.entity';
import { AiUsageLog } from '../../entities/ai-usage-log.entity';
import { AiUserAccessLog } from '../../entities/ai-user-access-log.entity';
import { User, SubscriptionPlan, UserRole } from '../../entities/user.entity';
import { AIService, QuestionContext } from '../../library/ai.service';
import { SettingsService } from '../../settings/settings.service';
import { TelegramService } from '../../integrations/telegram.service';

const AI_TUTOR_FEATURE_KEY = 'ai_tutor';
const AI_GLOBAL_FEATURE_KEY = 'ai_tutor_global';

@Injectable()
export class TestAiService {
  private readonly logger = new Logger(TestAiService.name);

  constructor(
    @InjectRepository(QuestionAiExplanation)
    private readonly explanationRepo: Repository<QuestionAiExplanation>,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    @InjectRepository(AiUsageLog)
    private readonly usageRepo: Repository<AiUsageLog>,
    @InjectRepository(AiUserAccessLog)
    private readonly accessRepo: Repository<AiUserAccessLog>,
    private readonly aiService: AIService,
    private readonly settingsService: SettingsService,
    private readonly telegramService: TelegramService,
  ) {}

  async getExplanation(
    user: User,
    questionId: string,
    type: 'question' | 'explanation',
    optionId?: string,
    language: 'en' | 'ar' = 'en',
  ): Promise<{ content: string; language: string }> {
    const qId = Number(questionId);
    if (isNaN(qId)) throw new NotFoundException('Invalid question ID');

    const todayUtc = new Date().toISOString().split('T')[0];
    const itemKey = `question:${questionId}:${type}:${optionId || 'none'}:${language}`;
    const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;

    // —— 1. Parallel: Check cache + quota + global cap simultaneously ——
    const [cachedExplanation, quotaResult] = await Promise.all([
      // Cache lookup
      this.explanationRepo.findOne({
        select: ['content', 'language'],
        where: {
          questionId,
          type,
          language,
          ...(type === 'explanation' && optionId ? { optionId } : {}),
        },
      }),
      // Quota check (skip for super admins)
      isSuperAdmin
        ? Promise.resolve({ allowed: true as const })
        : this.checkAndIncrementQuota(user, itemKey, todayUtc),
    ]);

    // Return cached immediately if available
    if (cachedExplanation) {
      return { content: cachedExplanation.content, language: cachedExplanation.language };
    }

    // Quota exceeded — per-user
    if (quotaResult.allowed === false) {
      throw new HttpException(
        {
          code: quotaResult.code || 'AI_LIMIT_EXCEEDED',
          message: quotaResult.message,
          limit: quotaResult.limit,
          userPlan: quotaResult.userPlan,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // —— 2. Fetch only required question data ——————————————————————————
    const question = await this.questionRepo
      .createQueryBuilder('q')
      .select([
        'q.id',
        'q.textHtml',
        'q.explanationHtml',
        'q.timesAnswered',
        'q.timesCorrect',
      ])
      .leftJoin('q.options', 'opt')
      .addSelect([
        'opt.id',
        'opt.displayOrder',
        'opt.textHtml',
        'opt.isCorrect',
        'opt.uworldChosenBy',
        'opt.explanationHtml',
      ])
      .leftJoin('q.subject', 'subject')
      .addSelect(['subject.name'])
      .leftJoin('q.system', 'system')
      .addSelect(['system.name'])
      .leftJoin('q.topic', 'topic')
      .addSelect(['topic.name'])
      .where('q.id = :qId', { qId })
      .addOrderBy('opt.displayOrder', 'ASC')
      .getOne();

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    // —— 3. Build context & generate ——————————————————————————————————
    const questionContext: QuestionContext = {
      questionText: question.textHtml || '',
      options: (question.options || []).map((o) => ({
        letter: o.displayOrder || '?',
        text: o.textHtml || '',
        isCorrect: o.isCorrect,
        chosenByPercent: o.uworldChosenBy ?? null,
        optionExplanation: o.explanationHtml ?? null,
      })),
      subject: question.subject?.name ?? undefined,
      system: question.system?.name ?? undefined,
      topic: question.topic?.name ?? undefined,
      globalAccuracyRate:
        question.timesAnswered > 0
          ? (question.timesCorrect / question.timesAnswered) * 100
          : undefined,
    };

    let generatedContent = '';

    if (type === 'explanation' && optionId) {
      // User answered — use their selected option for personalized analysis
      const optionIdNum = Number(optionId);
      const selectedOption = question.options.find((o) => Number(o.id) === optionIdNum);

      if (!selectedOption) {
        throw new NotFoundException('Option not found');
      }

      generatedContent = await this.aiService.generateSubmissionAnalysis(
        questionContext,
        question.explanationHtml || '',
        selectedOption.displayOrder || '?',
        selectedOption.textHtml || '',
        selectedOption.isCorrect,
        language,
      );
    } else {
      // No option selected (or type is 'question') — general question analysis
      generatedContent = await this.aiService.generateQuestionAnalysis(questionContext, language);
    }

    // —— 4. Save cache + log success in parallel ——————————————————————
    this.persistResults(questionId, type, optionId, language, generatedContent, user.id, todayUtc);

    return { content: generatedContent, language };
  }

  /**
   * Returns any cached AI explanations for a question (no generation, no quota impact).
   * Used by the frontend to instantly restore previously generated responses.
   */
  async getCachedExplanations(questionId: string): Promise<Record<string, string>> {
    const cached = await this.explanationRepo.find({
      select: ['content', 'language'],
      where: { questionId },
    });

    const result: Record<string, string> = {};
    for (const entry of cached) {
      // Use the first cached entry per language (most relevant)
      if (!result[entry.language]) {
        result[entry.language] = entry.content;
      }
    }
    return result;
  }

  /**
   * Checks quota and increments usage atomically.
   * Returns { allowed: true } if under limit, or { allowed: false, message, limit } if exceeded.
   */
  private async checkAndIncrementQuota(
    user: User,
    itemKey: string,
    todayUtc: string,
  ): Promise<{ allowed: true } | { allowed: false; message: string; limit: number; code: string; userPlan: string }> {
    // —— Global daily cap check ————————————————————————————————————
    const globalLimit = await this.settingsService.getNumber('AI_DAILY_GLOBAL_LIMIT', 500);
    const [globalRow] = await this.usageRepo.query(
      `SELECT COALESCE(SUM("callCount"), 0)::int AS total
       FROM ai_usage_logs
       WHERE "featureKey" IN ('ai_tutor', 'article_explain') AND "usageDate" = $1`,
      [todayUtc],
    );
    if (globalRow && globalRow.total >= globalLimit) {
      return {
        allowed: false,
        code: 'AI_GLOBAL_LIMIT_EXCEEDED',
        message: 'The AI model is currently exhausted due to high demand. Please try again later.',
        limit: globalLimit,
        userPlan: 'global',
      };
    }

    // Check if user already accessed this exact item today (free refresh)
    const existingAccess = await this.accessRepo.findOne({
      select: ['id'],
      where: {
        userId: user.id,
        featureKey: AI_TUTOR_FEATURE_KEY,
        itemKey,
        accessDate: todayUtc,
      },
    });

    if (existingAccess) {
      return { allowed: true }; // Free refresh
    }

    const isPremium =
      user.subscriptionPlan !== SubscriptionPlan.FREE &&
      user.subscriptionExpiry &&
      new Date(user.subscriptionExpiry) > new Date();

    // Read limits from admin settings
    const [freeLimit, premiumLimit] = await Promise.all([
      this.settingsService.getNumber('AI_DAILY_PER_USER_FREE', 5),
      this.settingsService.getNumber('AI_DAILY_PER_USER_PREMIUM', 50),
    ]);

    const limit = isPremium ? premiumLimit : freeLimit;
    const userPlan = isPremium ? 'premium' : 'free';

    // Check current count BEFORE incrementing (sum both ai_tutor + article_explain)
    const [currentRow] = await this.usageRepo.query(
      `SELECT COALESCE(SUM("callCount"), 0)::int AS count
       FROM ai_usage_logs
       WHERE "userId" = $1 AND "featureKey" IN ('ai_tutor', 'article_explain') AND "usageDate" = $2`,
      [user.id, todayUtc],
    );

    const currentCount = currentRow ? currentRow.count : 0;

    if (currentCount >= limit) {
      return {
        allowed: false,
        code: 'AI_LIMIT_EXCEEDED',
        message: isPremium
          ? 'You\'ve reached your usage limit. Your limit will reset tomorrow.'
          : 'You\'ve reached your usage limit. Upgrade to Premium for more daily explanations.',
        limit,
        userPlan,
      };
    }

    // Only increment now that we know the request is allowed
    await this.usageRepo.query(
      `INSERT INTO ai_usage_logs ("userId", "featureKey", "usageDate", "callCount")
       VALUES ($1, $2, $3, 1)
       ON CONFLICT ("userId", "featureKey", "usageDate")
       DO UPDATE SET "callCount" = ai_usage_logs."callCount" + 1`,
      [user.id, AI_TUTOR_FEATURE_KEY, todayUtc],
    );

    // Fire-and-forget: check AI global usage thresholds for Telegram alerts
    const newGlobalTotal = (globalRow?.total ?? 0) + 1;
    this.telegramService
      .checkAndAlertAiUsageThreshold(newGlobalTotal, globalLimit)
      .catch((err) => this.logger.warn('AI usage threshold alert failed', err?.message));

    // Record access (fire-and-forget)
    this.accessRepo
      .save(
        this.accessRepo.create({
          userId: user.id,
          featureKey: AI_TUTOR_FEATURE_KEY,
          itemKey,
          accessDate: todayUtc,
        }),
      )
      .catch((err) => this.logger.warn('Could not save access log', err.message));

    return { allowed: true };
  }

  /**
   * Persist the generated explanation and success log.
   * Fire-and-forget — the response is already sent to the client.
   */
  private persistResults(
    questionId: string,
    type: string,
    optionId: string | undefined,
    language: string,
    content: string,
    userId: number,
    todayUtc: string,
  ): void {
    const saveCache = this.explanationRepo
      .save(
        this.explanationRepo.create({
          questionId,
          type,
          optionId: type === 'explanation' ? optionId : null,
          language,
          content,
        }),
      )
      .catch((err) => this.logger.warn('Could not save AI explanation cache', err.message));

    const logSuccess = this.usageRepo
      .query(
        `UPDATE ai_usage_logs SET "successCalls" = "successCalls" + 1
         WHERE "userId" = $1 AND "featureKey" = $2 AND "usageDate" = $3`,
        [userId, AI_TUTOR_FEATURE_KEY, todayUtc],
      )
      .catch((err) => this.logger.warn('Could not log success', err.message));

    // Don't await — runs in background
    Promise.all([saveCache, logSuccess]);
  }
}
