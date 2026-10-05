import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, SelectQueryBuilder, LessThan, Not } from 'typeorm';
import { Test, TestStatus, TestMode, TestType } from '../../entities/test.entity';
import { TestQuestion } from '../../entities/test-question.entity';
import { Question, QuestionDifficultyTier } from '../../entities/question.entity';
import {
  QuestionBank,
  resolveViewerThemeProfileSnapshot,
  ViewerThemeProfile,
} from '../../entities/question-bank.entity';
import { QuestionSubmission } from '../../entities/question-submission.entity';
import { User } from '../../entities/user.entity';
import { CreateTestDto } from '../dto/test.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SubscriptionService } from '../../subscriptions/subscription.service';
import { createHash } from 'crypto';
import { QuestionGrouping } from '../../entities/question-grouping.entity';
import { SecurityQuotaService } from '../../security/security-quota.service';
import {
  hasPartialBlockGroups,
  normalizeBlockQuestionIds,
} from '../utils/block-group-integrity.util';
import { LibrarySource } from '../../library/library-source.constants';
import { TelegramService } from '../../integrations/telegram.service';
import {
  FILTER_COUNTS_TTL_MS,
  USER_COUNTS_EPOCH_TTL_MS,
  userCountsEpochCacheKey,
  userFilterCountsCacheKey,
} from '../../cache/cache-keys.util';
import { safeCacheGet, safeCacheSet } from '../../cache/safe-cache.util';

@Injectable()
export class TestCreationService {
  private readonly defaultBlockSize = 20;
  private readonly blockSecondsPerQuestion = 90;
  private readonly groupedSampleMax = 5000;

  constructor(
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
    @InjectRepository(TestQuestion)
    private testQuestionRepository: Repository<TestQuestion>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(QuestionBank)
    private questionBankRepository: Repository<QuestionBank>,
    @InjectRepository(QuestionGrouping)
    private questionGroupingRepository: Repository<QuestionGrouping>,
    @InjectRepository(QuestionSubmission)
    private submissionRepository: Repository<QuestionSubmission>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    private subscriptionService: SubscriptionService,
    private securityQuotaService: SecurityQuotaService,
    private telegramService: TelegramService,
  ) {}

  async createTest(
    user: User,
    createTestDto: CreateTestDto,
    requestMeta?: { ip?: string | null; userAgent?: string | null; path?: string },
  ): Promise<Test> {
    await this.securityQuotaService.assertCanCreateTest({
      user,
      ip: requestMeta?.ip || 'unknown',
      userAgent: requestMeta?.userAgent || null,
      path: requestMeta?.path || '/tests',
    });

    const userId = user.id;
    const { 
      title, 
      type, 
      mode, 
      step, 
      totalQuestions, 
      filters, 
      timeLimitSeconds, 
      customQuestionIds,
      isBlock,
      blockNumber,
    } = createTestDto;
    const hasCustomIds = Array.isArray(customQuestionIds) && customQuestionIds.length > 0;
    const requestedTotalQuestions = Math.max(1, Math.min(200, Number(totalQuestions || 0)));

    if (Number(totalQuestions || 0) > 100) {
      void this.telegramService.sendTestCreationAbuseAlert({
        userId: user.id,
        userEmail: user.email,
        questionCount: Number(totalQuestions),
        ip: requestMeta?.ip || 'unknown',
      });
    }

    // 🔒 SECURITY: Enforce question bank access
    const allowedBankIds = await this.subscriptionService.getAllowedQuestionBankIds(user, step);
    
    // If user provided bank filters, intersect them with allowed banks
    // If they provided NONE (e.g. they want all for that step), force them to only see allowed banks
    let enforcedBankIds = allowedBankIds;
    if (filters?.questionBankIds && filters.questionBankIds.length > 0) {
      enforcedBankIds = filters.questionBankIds.filter(id => allowedBankIds.includes(Number(id)));
    }

    if (hasCustomIds && (!filters?.questionBankIds || filters.questionBankIds.length === 0)) {
      throw new BadRequestException('Custom tests require selecting a question bank.');
    }

    if (enforcedBankIds.length === 0 && !hasCustomIds) {
       throw new BadRequestException('You do not have access to any question banks for this step. Please subscribe.');
    }

    const isTimedLikeType = type === TestType.TIMED || type === TestType.MIXED;
    if (isTimedLikeType && !timeLimitSeconds && !isBlock) {
      throw new BadRequestException('Time limit is required for timed and mixed tests');
    }

    const normalizedTimeLimitSeconds = isTimedLikeType ? timeLimitSeconds : undefined;
    const resolveTestViewerThemeProfile = async (
      bankIds: number[],
    ): Promise<ViewerThemeProfile> => {
      if (bankIds.length === 0) {
        return ViewerThemeProfile.STANDARD_EXAM;
      }

      const banks = await this.questionBankRepository.find({
        where: { id: In(bankIds) },
        select: ['id', 'viewerThemeProfile'],
      });

      return resolveViewerThemeProfileSnapshot(
        banks.map((bank) => bank.viewerThemeProfile),
      );
    };

    const resolveTestLibrarySourceSnapshot = async (
      bankIds: number[],
    ): Promise<LibrarySource> => {
      if (bankIds.length === 0) {
        return LibrarySource.ALL;
      }

      const banks = await this.questionBankRepository.find({
        where: { id: In(bankIds) },
        relations: ['mainBank'],
      });

      const sources = Array.from(new Set(banks.map(b => b.mainBank?.librarySource).filter(Boolean)));
      if (sources.length === 1) {
        return sources[0] as LibrarySource;
      }
      return LibrarySource.ALL;
    };

    if (isBlock) {
      if (!filters?.questionBankIds || filters.questionBankIds.length !== 1) {
        throw new BadRequestException('Block tests require a single question bank.');
      }
      if (!blockNumber || blockNumber < 1) {
        throw new BadRequestException('Block number is required for block tests.');
      }

      const blockBankId = Number(filters.questionBankIds[0]);
      if (!enforcedBankIds.includes(blockBankId)) {
        throw new BadRequestException('You do not have access to the selected question bank.');
      }

      const bank = await this.questionBankRepository.findOne({
        where: { id: blockBankId, isActive: true },
      });
      if (!bank || !bank.isBlockBank) {
        throw new BadRequestException('This question bank does not support blocks.');
      }

      const existing = await this.testRepository.findOne({
        where: {
          userId,
          isBlock: true,
          blockBankId,
          blockNumber,
        },
      });
      if (existing) {
        return existing;
      }

      const incompletePrevious = await this.testRepository.findOne({
        where: {
          userId,
          isBlock: true,
          blockBankId,
          blockNumber: LessThan(blockNumber),
          status: Not(TestStatus.COMPLETED),
        },
      });
      if (incompletePrevious) {
        throw new BadRequestException('Complete previous blocks before starting this one.');
      }

      const allQuestionRows = await this.questionRepository
        .createQueryBuilder('question')
        .select(['question.id AS "id"', 'question.externalId AS "externalId"'])
        .where('question.questionBankId = :blockBankId', { blockBankId })
        .andWhere('question.isActive = :isActive', { isActive: true })
        .andWhere('question.step = :step', { step: bank.step })
        .getRawMany<{ id: number; externalId: string | null }>();

      const allQuestions = allQuestionRows
        .map((row) => ({
          id: Number(row.id),
          externalId: row.externalId ? String(row.externalId).trim() : null,
        }))
        .filter((row) => Number.isFinite(row.id));

      const allQuestionIds = allQuestions.map((q) => q.id);
      if (allQuestions.length === 0) {
        throw new BadRequestException('No questions available for this question bank.');
      }

      const existingBlockTests = await this.testRepository.find({
        where: { userId, isBlock: true, blockBankId },
        select: ['id'],
      });
      const existingBlockIds = existingBlockTests.map((test) => test.id);

      let usedQuestionIds = new Set<number>();
      if (existingBlockIds.length > 0) {
        const usedMappings = await this.testQuestionRepository.find({
          where: { testId: In(existingBlockIds) },
          select: ['questionId'],
        });
        usedQuestionIds = new Set(usedMappings.map((mapping) => Number(mapping.questionId)));
      }

      const remainingQuestions = allQuestions.filter((q) => !usedQuestionIds.has(q.id));
      if (remainingQuestions.length === 0) {
        throw new BadRequestException('No remaining questions available for this block.');
      }

      const effectiveBlockSize = bank.blockSize || this.defaultBlockSize;
      const totalBlocks = Math.ceil(allQuestionIds.length / effectiveBlockSize);
      if (blockNumber > totalBlocks) {
        throw new BadRequestException('Invalid block number for this question bank.');
      }
      const expectedCount =
        blockNumber === totalBlocks
          ? Math.max(1, allQuestionIds.length - (totalBlocks - 1) * effectiveBlockSize)
          : effectiveBlockSize;

      const candidateQuestionIds = await this.selectBlockQuestionIdsGrouped({
        questionBankId: blockBankId,
        remainingQuestions,
        usedQuestionIds,
        targetCount: Math.min(expectedCount, remainingQuestions.length),
      });

      const selectedQuestionIds = await normalizeBlockQuestionIds({
        questionRepository: this.questionRepository,
        questionGroupingRepository: this.questionGroupingRepository,
        questionBankId: blockBankId,
        orderedQuestionIds: candidateQuestionIds,
        targetCount: Math.min(expectedCount, remainingQuestions.length),
        blockSize: effectiveBlockSize,
      });

      if (selectedQuestionIds.length === 0) {
        throw new BadRequestException('No remaining questions available for this block.');
      }

      const hasPartialGroups = await hasPartialBlockGroups({
        questionRepository: this.questionRepository,
        questionGroupingRepository: this.questionGroupingRepository,
        questionBankId: blockBankId,
        orderedQuestionIds: selectedQuestionIds,
      });
      if (hasPartialGroups) {
        throw new BadRequestException('Failed to build a valid block with complete grouped questions.');
      }

      const normalizedBlockTimeLimitSeconds = selectedQuestionIds.length * this.blockSecondsPerQuestion;
      const viewerThemeProfileSnapshot = resolveViewerThemeProfileSnapshot([
        bank.viewerThemeProfile,
      ]);
      const librarySourceSnapshot = await resolveTestLibrarySourceSnapshot([bank.id]);

      const test = this.testRepository.create({
        userId,
        title: title || `${bank.name} Block #${blockNumber}`,
        type: TestType.TIMED,
        mode: TestMode.ALL,
        step: bank.step,
        totalQuestions: selectedQuestionIds.length,
        filters,
        timeLimitSeconds: normalizedBlockTimeLimitSeconds,
        blueprintSignature: this.buildBlueprintSignature({
          step: bank.step,
          type: TestType.TIMED,
          mode: TestMode.ALL,
          totalQuestions: selectedQuestionIds.length,
          filters,
          timeLimitSeconds: normalizedBlockTimeLimitSeconds,
        }),
        status: TestStatus.IN_PROGRESS,
        startedAt: new Date(),
        isBlock: true,
        blockNumber,
        blockBankId,
        viewerThemeProfileSnapshot,
        librarySourceSnapshot,
      });

      const savedTest = await this.testRepository.save(test);

      const testQuestions = selectedQuestionIds.map((questionId, index) =>
        this.testQuestionRepository.create({
          testId: savedTest.id,
          questionId,
          displayOrder: index + 1,
        }),
      );
      await this.testQuestionRepository.save(testQuestions);

      await Promise.all([
        this.preCacheQuestionAnswers(selectedQuestionIds),
        this.preHeatStaticQuestionContent(selectedQuestionIds),
      ]);

      (savedTest as any).requestedTotalQuestions = expectedCount;
      (savedTest as any).actualTotalQuestions = selectedQuestionIds.length;
      (savedTest as any).groupedAddedCount = Math.max(0, selectedQuestionIds.length - expectedCount);
      await this.securityQuotaService.recordCreatedTest(user.id);
      return savedTest as any;
    }

    let selectedQuestions: Question[] = [];

    if (hasCustomIds) {
      if (enforcedBankIds.length === 0) {
        throw new BadRequestException('You do not have access to the selected question bank.');
      }

      const uniqueExternalIds = [
        ...new Set(
          customQuestionIds
            .map((value) => String(value).trim())
            .filter((value) => value.length > 0),
        ),
      ];
      const customQuestions = await this.questionRepository.find({
        where: {
          externalId: In(uniqueExternalIds),
          isActive: true,
          step,
          questionBankId: In(enforcedBankIds),
        },
      });

      const questionByExternalId = new Map(
        customQuestions
          .filter((q) => q.externalId)
          .map((q) => [String(q.externalId), q]),
      );
      const missingExternalIds = uniqueExternalIds.filter((id) => !questionByExternalId.has(id));

      if (customQuestions.length === 0) {
        // Surface the actual IDs the user submitted so they can see what was rejected.
        // Without this, when nothing matches the user gets a generic message and has
        // no way to tell which IDs to fix — they'd have to bisect manually.
        const previewCount = 50;
        const preview = uniqueExternalIds.slice(0, previewCount);
        const more = uniqueExternalIds.length - preview.length;
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message:
            `None of the ${uniqueExternalIds.length} UWorld ID${uniqueExternalIds.length === 1 ? '' : 's'} you entered ` +
            `${uniqueExternalIds.length === 1 ? 'was' : 'were'} found in the selected question bank: ` +
            preview.join(', ') +
            (more > 0 ? ` …and ${more} more` : ''),
          invalidExternalIds: uniqueExternalIds,
        });
      }

      if (missingExternalIds.length > 0) {
        // Same idea — when SOME IDs are invalid (the partial-match case), list them
        // explicitly so the user can copy them out, fix them, and try again instead
        // of having to bisect their list by hand. We cap the preview at 50 to keep
        // the toast/error from being absurdly long; the full array is still in the
        // structured `invalidExternalIds` field if the frontend wants to render it.
        const previewCount = 50;
        const preview = missingExternalIds.slice(0, previewCount);
        const more = missingExternalIds.length - preview.length;
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message:
            `The following ${missingExternalIds.length} UWorld ID${missingExternalIds.length === 1 ? '' : 's'} ` +
            `${missingExternalIds.length === 1 ? 'is' : 'are'} invalid or not in the selected question bank: ` +
            preview.join(', ') +
            (more > 0 ? ` …and ${more} more` : ''),
          invalidExternalIds: missingExternalIds,
        });
      }

      selectedQuestions = await this.expandCustomQuestionsWithGroupings(
        uniqueExternalIds,
        customQuestions,
      );

      (createTestDto as any).__groupingMeta = {
        requestedTotalQuestions,
        actualTotalQuestions: selectedQuestions.length,
        groupedAddedCount: Math.max(0, selectedQuestions.length - requestedTotalQuestions),
      };
    } else {
      const queryBuilder = this.questionRepository
        .createQueryBuilder('question')
        .where('question.step = :step', { step })
        .andWhere('question.isActive = :isActive', { isActive: true });

      if (filters) {
        if (filters.subjectIds && filters.subjectIds.length > 0) {
          queryBuilder.andWhere('question.subjectId IN (:...subjectIds)', { subjectIds: filters.subjectIds });
        }
        if (filters.systemIds && filters.systemIds.length > 0) {
          queryBuilder.andWhere('question.systemId IN (:...systemIds)', { systemIds: filters.systemIds });
        }
        if (filters.topicIds && filters.topicIds.length > 0) {
          queryBuilder.andWhere('question.topicId IN (:...topicIds)', { topicIds: filters.topicIds });
        }
        if (enforcedBankIds && enforcedBankIds.length > 0) {
          queryBuilder.andWhere('question.questionBankId IN (:...questionBankIds)', { questionBankIds: enforcedBankIds });
        }
        if (filters.difficulty && filters.difficulty.length > 0) {
          this.applyDifficultyFilter(queryBuilder, filters.difficulty);
        }
      }

      if (mode === TestMode.MIXED) {
        await this.applyMultiModeFilter(queryBuilder, userId, filters?.modes ?? []);
      } else if (mode !== TestMode.ALL) {
        await this.applyQuestionModeFilter(queryBuilder, userId, mode);
      }

      const { questionIds, actualTotalQuestions, groupedAddedCount } =
        await this.selectQuestionIdsWithGroupings(queryBuilder, requestedTotalQuestions);

      if (questionIds.length === 0) {
        if (mode === TestMode.INCORRECT) {
          throw new BadRequestException('No incorrect questions found for this user');
        }
        if (mode === TestMode.CORRECT) {
          throw new BadRequestException('No correct questions found for this user');
        }
        if (mode === TestMode.MARKED) {
          throw new BadRequestException('No marked questions found for this user');
        }
        if (mode === TestMode.MARKED_CORRECT) {
          throw new BadRequestException('No marked correct questions found for this user');
        }
        if (mode === TestMode.MARKED_INCORRECT) {
          throw new BadRequestException('No marked incorrect questions found for this user');
        }
        if (mode === TestMode.USED) {
          throw new BadRequestException('No used questions found for this user');
        }
        if (mode === TestMode.OMITTED) {
          throw new BadRequestException('No omitted questions found for this user');
        }
        if (mode === TestMode.SUSPENDED) {
          throw new BadRequestException('No suspended questions found for this user');
        }
        throw new BadRequestException('No questions found matching your criteria');
      }

      const lightweight = await this.questionRepository.find({
        where: { id: In(questionIds), isActive: true },
        select: ['id', 'questionBankId', 'externalId'],
      });
      const byId = new Map(lightweight.map((q) => [Number(q.id), q]));
      selectedQuestions = questionIds.map((id) => byId.get(id)).filter(Boolean) as Question[];

      (createTestDto as any).__groupingMeta = {
        requestedTotalQuestions,
        actualTotalQuestions,
        groupedAddedCount,
      };
    }

    if (selectedQuestions.length === 0) {
      throw new BadRequestException('No questions found matching your criteria');
    }

    // Grouping is enforced via QuestionGrouping before persistence.
    const viewerThemeProfileSnapshot = await resolveTestViewerThemeProfile(
      Array.from(
        new Set(selectedQuestions.map((question) => Number(question.questionBankId))),
      ),
    );
    const librarySourceSnapshot = await resolveTestLibrarySourceSnapshot(
      Array.from(
        new Set(selectedQuestions.map((question) => Number(question.questionBankId))),
      ),
    );

    let finalTitle = title;
    if (!finalTitle) {
      const userTestCount = await this.testRepository.count({ where: { userId } });
      finalTitle = `Test ${userTestCount + 1}`;
    }

    const test = this.testRepository.create({
      userId,
      title: finalTitle,
      type,
      mode,
      step,
      totalQuestions: selectedQuestions.length,
      filters,
      timeLimitSeconds: normalizedTimeLimitSeconds,
      // Mixed uses active-time semantics (v=2); everything else stays on the legacy
      // wall-clock default (v=1). Branching downstream timer logic must key off this
      // field — not `!!timeLimitSeconds` — to avoid the v=1 in-flight rewrite trap.
      timeAccountingVersion: type === TestType.MIXED ? 2 : 1,
      blueprintSignature: this.buildBlueprintSignature({
        step,
        type,
        mode,
        totalQuestions: selectedQuestions.length,
        filters,
        timeLimitSeconds: normalizedTimeLimitSeconds,
        customQuestionIds,
      }),
      status: TestStatus.IN_PROGRESS,
      startedAt: new Date(),
      viewerThemeProfileSnapshot,
      librarySourceSnapshot,
    });

    const savedTest = await this.testRepository.save(test);

    const testQuestions = selectedQuestions.map((q, index) =>
      this.testQuestionRepository.create({
        testId: savedTest.id,
        questionId: q.id,
        displayOrder: index + 1,
      }),
    );

    await this.testQuestionRepository.save(testQuestions);

    // 🚀 CACHE OPTIMIZATION: Extreme Pre-heating
    // We pre-load both answers AND full question content into Redis
    // This makes the initial redirect to TestPage nearly instantaneous (Cache HIT)
    await Promise.all([
      this.preCacheQuestionAnswers(selectedQuestions.map(q => q.id)),
      this.preHeatStaticQuestionContent(selectedQuestions.map(q => q.id))
    ]);

    console.log(`✅ Test created with ${selectedQuestions.length} questions - FULL CACHE PRE-HEATED!`);

    const groupingMeta = (createTestDto as any).__groupingMeta;
    if (groupingMeta) {
      (savedTest as any).requestedTotalQuestions = groupingMeta.requestedTotalQuestions;
      (savedTest as any).actualTotalQuestions = groupingMeta.actualTotalQuestions;
      (savedTest as any).groupedAddedCount = groupingMeta.groupedAddedCount;
    }

    await this.securityQuotaService.recordCreatedTest(user.id);

    // Fix #1: a freshly-created test puts its questions into the IN_PROGRESS
    // bucket. Future filter views must reflect that, so evict the no-filter
    // counts cache for this step.
    await this.invalidateUserCountsCache(user.id, Number(step));

    return savedTest as any;
  }

  /**
   * Pre-cache all question answers for a test
   * Fetches all correct answers in ONE query and caches them
   * Makes all subsequent answer submissions instant (1ms)
   */
  private async preCacheQuestionAnswers(questionIds: number[]): Promise<void> {
    console.log(`🔄 Pre-caching answers for ${questionIds.length} questions...`);
    
    // Fetch ALL question answers in ONE efficient query
    const questions = await this.questionRepository
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.options', 'opt')
      .where('q.id IN (:...questionIds)', { questionIds })
      .select(['q.id', 'opt.id', 'opt.isCorrect'])
      .getMany();

    // Cache each answer
    let cachedCount = 0;
    for (const question of questions) {
      const correctOption = question.options?.find(o => o.isCorrect);
      if (correctOption) {
        const cacheKey = `question_keys:${question.id}:answer`;
        await this.cacheManager.set(cacheKey, correctOption.id, 3600000); // 1 hour
        cachedCount++;
      }
    }

    console.log(`💾 Successfully cached ${cachedCount}/${questionIds.length} answers!`);
  }

  /**
   * Pre-heat the static global question content in Redis (24H TTL)
   * Mirroring TestRetrievalService logic to ensure Cache HIT on load
   */
  private async preHeatStaticQuestionContent(questionIds: number[]): Promise<void> {
    if (questionIds.length === 0) return;
    
    console.log(`🔥 Pre-heating static content for ${questionIds.length} questions...`);

    // Fetch full data with allJoins (Options, Subject, System, Topic, QBank)
    const fullQuestions = await this.questionRepository
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.options', 'options')
      .leftJoinAndSelect('q.subject', 'subject')
      .leftJoinAndSelect('q.system', 'system')
      .leftJoinAndSelect('q.topic', 'topic')
      .leftJoinAndSelect('q.questionBank', 'questionBank')
      .where('q.id IN (:...questionIds)', { questionIds })
      .getMany();

    // Store in Redis (24 hour TTL to match TestRetrievalService)
    for (const question of fullQuestions) {
      const cacheKey = `static_questions:${question.id}:content`;
      await this.cacheManager.set(
        cacheKey,
        {
          ...question,
          difficulty: question.difficulty,
        },
        86400 * 1000,
      );
    }

    console.log(`⚡ Finished pre-heating static content cache.`);
  }

  // Read (or initialize) the user's filter-counts epoch. The epoch is spliced
  // into every filter-counts cache key so a single epoch bump invalidates every
  // (step, filter-hash) variant the user might have cached. Without this, a
  // cache key keyed by `:filters:bank:19` survives a `:filters:none` del.
  private async getUserCountsEpoch(userId: number): Promise<string> {
    const key = userCountsEpochCacheKey(userId);
    const cached = await safeCacheGet<string>(this.cacheManager, key);
    if (cached) return cached;

    const fresh = String(Date.now());
    await safeCacheSet(this.cacheManager, key, fresh, USER_COUNTS_EPOCH_TTL_MS);
    return fresh;
  }

  async getQuestionCounts(user: User, filters: any, step: number) {
    const userId = user.id;
    const filterHash = this.extractFilterHashDetailed(filters);
    const epoch = await this.getUserCountsEpoch(userId);
    // Audit follow-up: split cached counts by subscription state. Without
    // this, a user whose subscription expires within the 60s TTL window
    // would keep seeing counts for premium banks they no longer access —
    // then get blocked when they actually click "Create Test".
    const hasActiveSub = this.subscriptionService.hasActiveSubscription(user);
    const cacheKey = userFilterCountsCacheKey(userId, epoch, step, filterHash, hasActiveSub);

    // 🚀 CACHE CHECK
    const cached = await safeCacheGet(this.cacheManager, cacheKey);
    if (cached) {
      console.log(`[TestCreation] ⚡ Cache HIT for ${cacheKey}`);
      return cached;
    }

    // 🔒 SECURITY: Enforce question bank access
    const allowedBankIds = await this.subscriptionService.getAllowedQuestionBankIds(user, step);
    let enforcedBankIds = allowedBankIds;
    if (filters?.questionBankIds && filters.questionBankIds.length > 0) {
      enforcedBankIds = filters.questionBankIds.filter(id => allowedBankIds.includes(Number(id)));
    }

    const queryBuilder = this.questionRepository
      .createQueryBuilder('question')
      .leftJoin(
        'question_submissions',
        'submission',
        'submission.questionId = question.id AND submission.userId = :userId',
        { userId }
      )
      .where('question.step = :step', { step })
      .andWhere('question.isActive = :isActive', { isActive: true });

    if (filters) {
      if (filters.subjectIds?.length > 0) {
        queryBuilder.andWhere('question.subjectId IN (:...subjectIds)', { subjectIds: filters.subjectIds });
      }
      if (filters.systemIds?.length > 0) {
        queryBuilder.andWhere('question.systemId IN (:...systemIds)', { systemIds: filters.systemIds });
      }
      if (filters.topicIds?.length > 0) {
        queryBuilder.andWhere('question.topicId IN (:...topicIds)', { topicIds: filters.topicIds });
      }
      if (enforcedBankIds && enforcedBankIds.length > 0) {
        queryBuilder.andWhere('question.questionBankId IN (:...questionBankIds)', { questionBankIds: enforcedBankIds });
      } else {
        // No accessible banks for this request — either none are allowed at all,
        // OR the specifically requested bank(s) aren't allowed for this user.
        // Return zeroed counts instead of falling through to an UNFILTERED,
        // step-wide query (which would leak inflated cross-bank totals, e.g. on
        // the Welcome snapshot for a non-subscriber who landed on a premium bank).
        return { all: 0, unused: 0, used: 0, incorrect: 0, correct: 0, marked: 0, marked_correct: 0, marked_incorrect: 0, omitted: 0, suspended: 0 };
      }
      if (filters.difficulty?.length > 0) {
        this.applyDifficultyFilter(queryBuilder, filters.difficulty);
      }
    }

    const omittedIds = await this.getOmittedQuestionIds(userId);
    const { incorrectIds: latestIncorrectIds, correctIds: latestCorrectIds } =
      await this.getLatestAnsweredStatusIds(userId);
    let omitted = 0;
    if (omittedIds.length > 0) {
      const omittedResult = await queryBuilder
        .clone()
        .select('COUNT(DISTINCT question.id)', 'count')
        .andWhere('question.id IN (:...omittedIds)', { omittedIds })
        .getRawOne();
      omitted = parseInt(omittedResult.count, 10) || 0;
    }

    const suspendedResult = await queryBuilder
      .clone()
      .select('COUNT(DISTINCT question.id)', 'count')
      .andWhere((qb) => this.buildSuspendedUntouchedPredicate(qb, 'question.id'))
      .getRawOne();
    const suspended = parseInt((suspendedResult as any)?.count, 10) || 0;

    const unusedResult = await queryBuilder
      .clone()
      .select('COUNT(DISTINCT question.id)', 'count')
      .andWhere((qb) => {
        const answeredGlobalSub = this.buildAnsweredGlobalExistsSubquery(qb, 'question.id');
        const omittedPredicate = this.buildOmittedPredicate(qb, 'question.id');
        const suspendedPredicate = this.buildSuspendedUntouchedPredicate(qb, 'question.id');
        return `(
          NOT EXISTS ${answeredGlobalSub}
          AND NOT (${omittedPredicate})
          AND NOT (${suspendedPredicate})
        )`;
      })
      .getRawOne();
    const unused = parseInt((unusedResult as any)?.count, 10) || 0;

    // Optimization: Single query with conditional aggregation to get all counts at once.
    // Marks are NOT aggregated here anymore — they live in user_question_marks and are
    // counted separately via a PK-driven EXISTS subquery (see markedResult below).
    // incorrect/correct are counted by LATEST-attempt status (precomputed id
    // sets), so a wrong-then-right question lands ONLY in correct — the buckets
    // no longer overlap and `correct + incorrect === answered`.
    const results = await queryBuilder
      .select('COUNT(DISTINCT question.id)', 'all')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN submission.selectedOptionId IS NOT NULL THEN question.id END)',
        'answered',
      )
      .addSelect(
        'COUNT(DISTINCT CASE WHEN question.id = ANY(:latestIncorrectIds::int[]) THEN question.id END)',
        'incorrect',
      )
      .addSelect(
        'COUNT(DISTINCT CASE WHEN question.id = ANY(:latestCorrectIds::int[]) THEN question.id END)',
        'correct',
      )
      .setParameter('latestIncorrectIds', latestIncorrectIds)
      .setParameter('latestCorrectIds', latestCorrectIds)
      .getRawOne();

    // Marked count — separate, lightweight query keyed by the PK of user_question_marks.
    // Drives from the marks side: Postgres scans only the user's mark rows (small set)
    // and joins to the filtered question set, instead of scanning every question.
    // marked_correct / marked_incorrect piggyback on the same query as CASE
    // aggregates over the already-fetched latest-status id arrays — zero extra
    // round-trips. A marked question with no answered attempt is in neither
    // id set, so it counts under `marked` only.
    const markedResult = await queryBuilder
      .clone()
      .select('COUNT(DISTINCT question.id)', 'count')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN question.id = ANY(:latestCorrectIds::int[]) THEN question.id END)',
        'markedCorrect',
      )
      .addSelect(
        'COUNT(DISTINCT CASE WHEN question.id = ANY(:latestIncorrectIds::int[]) THEN question.id END)',
        'markedIncorrect',
      )
      .andWhere((qb) => `EXISTS ${this.buildMarkedExistsSubquery(qb, 'question.id')}`)
      .setParameter('userId', userId)
      .setParameter('latestCorrectIds', latestCorrectIds)
      .setParameter('latestIncorrectIds', latestIncorrectIds)
      .getRawOne();

    const all = parseInt(results.all, 10) || 0;
    const answered = parseInt(results.answered, 10) || 0;
    const incorrect = parseInt(results.incorrect, 10) || 0;
    const correct = parseInt(results.correct, 10) || 0;
    const marked = parseInt((markedResult as any)?.count, 10) || 0;
    const marked_correct = parseInt((markedResult as any)?.markedCorrect, 10) || 0;
    const marked_incorrect = parseInt((markedResult as any)?.markedIncorrect, 10) || 0;
    const used = Math.min(all, answered + omitted);

    // Key names double as mode strings AND key order drives the checkbox
    // order on the Create Test page (frontend renders Object.keys()).
    const response = {
      all,
      unused,
      used,
      incorrect,
      correct,
      marked,
      marked_correct,
      marked_incorrect,
      omitted,
      suspended,
    };

    // 🚀 CACHE STORAGE
    // Fix #1: TTL extended from 10s → 60s. Invalidation is now wired into
    // every test state-change event (complete / suspend / resume / delete /
    // create / timed-expiry / mark-toggle), so the 60s window only matters
    // when a stale entry survives between state changes. Display lag on
    // mid-test answer submits is intentional — counts self-correct on the
    // next state change, and actual test creation always queries fresh.
    await safeCacheSet(this.cacheManager, cacheKey, response, FILTER_COUNTS_TTL_MS);
    console.log(`[TestCreation] 💾 Cached user question counts for ${cacheKey}`);

    return response;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Fix #1: invalidator for filter-availability counts.
  //
  // Cache keys include a per-user epoch:
  //   user_performance:{userId}:question_counts:v{epoch}:step:{step}:filters:{hash}
  //
  // Bumping the epoch (one Redis write) orphans every cached variant for
  // this user in a single shot — no need to enumerate which filter
  // combinations might exist. Old cached entries become unreachable and
  // self-expire via FILTER_COUNTS_TTL_MS.
  //
  // The `step` parameter is preserved for call-site clarity but is
  // intentionally ignored: the epoch is per-user, so bumping it covers
  // every step variant atomically.
  // ─────────────────────────────────────────────────────────────────────────
  async invalidateUserCountsCache(userId: number, _step?: number | null): Promise<void> {
    const newEpoch = String(Date.now());
    // safeCacheSet swallows Redis errors. A failed epoch write means stale
    // counts until existing entries naturally expire via the 60s TTL.
    await safeCacheSet(
      this.cacheManager,
      userCountsEpochCacheKey(userId),
      newEpoch,
      USER_COUNTS_EPOCH_TTL_MS,
    );
  }

  private extractFilterHashDetailed(filters: any): string {
    if (!filters) return 'none';
    const parts = [];
    if (filters.subjectIds?.length) parts.push(`sub:${filters.subjectIds.sort().join(',')}`);
    if (filters.systemIds?.length) parts.push(`sys:${filters.systemIds.sort().join(',')}`);
    if (filters.topicIds?.length) parts.push(`top:${filters.topicIds.sort().join(',')}`);
    if (filters.questionBankIds?.length) parts.push(`bank:${filters.questionBankIds.sort().join(',')}`);
    if (filters.difficulty?.length) parts.push(`diff:${filters.difficulty.sort().join(',')}`);

    return parts.length > 0 ? parts.join('|') : 'none';
  }

  private buildAnsweredGlobalExistsSubquery(qb: SelectQueryBuilder<any>, questionIdExpr: string): string {
    return qb
      .subQuery()
      .select('1')
      .from(QuestionSubmission, 'sub_ans')
      .where('sub_ans.userId = :userId')
      .andWhere(`sub_ans.questionId = ${questionIdExpr}`)
      .andWhere('sub_ans.selectedOptionId IS NOT NULL')
      .getQuery();
  }

  private buildBlankSubmissionExistsSubquery(qb: SelectQueryBuilder<any>, questionIdExpr: string): string {
    return qb
      .subQuery()
      .select('1')
      .from(QuestionSubmission, 'sub_blank')
      .where('sub_blank.userId = :userId')
      .andWhere(`sub_blank.questionId = ${questionIdExpr}`)
      .andWhere('sub_blank.selectedOptionId IS NULL')
      .getQuery();
  }

  private buildMarkedExistsSubquery(qb: SelectQueryBuilder<any>, questionIdExpr: string): string {
    // Marks live in their own per-user/question table — existence of a row
    // IS the mark. Lookup is a direct PK probe on (user_id, question_id),
    // the fastest possible check.
    //
    // NOTE: we pass the table name as a string (not the UserQuestionMark
    // entity class). TypeORM's `.subQuery().from(EntityClass, alias)` path
    // breaks for composite-PK entities — it tries to invoke the class
    // without `new`. The raw table name avoids that codepath entirely;
    // we lose property→column mapping here but the subquery only uses raw
    // column names anyway.
    return qb
      .subQuery()
      .select('1')
      .from('user_question_marks', 'uqm_mark')
      .where('uqm_mark.user_id = :userId')
      .andWhere(`uqm_mark.question_id = ${questionIdExpr}`)
      .getQuery();
  }

  private buildOmittedPredicate(qb: SelectQueryBuilder<any>, questionIdExpr: string): string {
    const answeredGlobalSub = this.buildAnsweredGlobalExistsSubquery(qb, questionIdExpr);
    const blankAnySub = this.buildBlankSubmissionExistsSubquery(qb, questionIdExpr);

    const completedSeenSub = qb
      .subQuery()
      .select('1')
      .from(TestQuestion, 'tq_om_c')
      .innerJoin(Test, 'test_om_c', 'test_om_c.id = tq_om_c.testId')
      .where('test_om_c.userId = :userId')
      .andWhere(`test_om_c.status = '${TestStatus.COMPLETED}'`)
      .andWhere(`tq_om_c.questionId = ${questionIdExpr}`)
      .getQuery();

    // Omitted = "seen in a completed test and never answered" OR "explicitly submitted blank (any test)",
    // and never answered globally.
    return `(
      NOT EXISTS ${answeredGlobalSub}
      AND
      (EXISTS ${completedSeenSub} OR EXISTS ${blankAnySub})
    )`;
  }

  private buildSuspendedUntouchedPredicate(qb: SelectQueryBuilder<any>, questionIdExpr: string): string {
    const suspendedUntouchedSub = qb
      .subQuery()
      .select('1')
      .from(TestQuestion, 'tq_sus')
      .innerJoin(Test, 'test_sus', 'test_sus.id = tq_sus.testId')
      .where('test_sus.userId = :userId')
      .andWhere(`test_sus.status = '${TestStatus.SUSPENDED}'`)
      .andWhere(`tq_sus.questionId = ${questionIdExpr}`)
      .andWhere((qb2) => {
        const touchedInThisTest = qb2
          .subQuery()
          .select('1')
          .from(QuestionSubmission, 'sub_sus_touched')
          .where('sub_sus_touched.userId = :userId')
          .andWhere('sub_sus_touched.testId = test_sus.id')
          .andWhere(`sub_sus_touched.questionId = ${questionIdExpr}`)
          .getQuery();

        // If the user attempted this question in ANY test after this suspended test was created,
        // we consider it no longer "suspended" (it has been dealt with since that suspension).
        const attemptedAfterAssigned = qb2
          .subQuery()
          .select('1')
          .from(QuestionSubmission, 'sub_sus_after')
          .where('sub_sus_after.userId = :userId')
          .andWhere(`sub_sus_after.questionId = ${questionIdExpr}`)
          .andWhere('sub_sus_after.submittedAt >= test_sus.createdAt')
          .getQuery();

        return `NOT EXISTS ${touchedInThisTest} AND NOT EXISTS ${attemptedAfterAssigned}`;
      })
      .getQuery();

    // Suspended (new mode) = assigned in a suspended test but never touched/submitted in that test,
    // and not attempted anywhere since that suspended test was created.
    return `(EXISTS ${suspendedUntouchedSub})`;
  }

  private async applyQuestionModeFilter(
    queryBuilder: SelectQueryBuilder<Question>,
    userId: number,
    mode: TestMode,
  ): Promise<void> {
    queryBuilder.setParameter('userId', userId);
    const questionIdExpr = 'question.id';

    // Incorrect/Correct resolve by the user's LATEST answered attempt per
    // question (see getLatestAnsweredStatusIds). Apply the precomputed id set
    // as a primary-key IN; an empty set must match nothing (1 = 0) so callers
    // surface the "no questions found" path instead of selecting everything.
    // Marked Correct / Marked Incorrect are the same id sets additionally
    // intersected with the user's marks (marked-but-never-answered questions
    // are in neither set — they stay under plain MARKED only).
    if (
      mode === TestMode.INCORRECT ||
      mode === TestMode.CORRECT ||
      mode === TestMode.MARKED_INCORRECT ||
      mode === TestMode.MARKED_CORRECT
    ) {
      const { incorrectIds, correctIds } =
        await this.getLatestAnsweredStatusIds(userId);
      const ids =
        mode === TestMode.INCORRECT || mode === TestMode.MARKED_INCORRECT
          ? incorrectIds
          : correctIds;
      if (ids.length > 0) {
        queryBuilder.andWhere('question.id IN (:...latestStatusIds)', {
          latestStatusIds: ids,
        });
        if (mode === TestMode.MARKED_CORRECT || mode === TestMode.MARKED_INCORRECT) {
          queryBuilder.andWhere(
            (qb) => `EXISTS ${this.buildMarkedExistsSubquery(qb, questionIdExpr)}`,
          );
        }
      } else {
        queryBuilder.andWhere('1 = 0');
      }
      return;
    }

    queryBuilder.andWhere((qb) => {
      const answeredGlobalSub = this.buildAnsweredGlobalExistsSubquery(qb, questionIdExpr);
      const omittedPredicate = this.buildOmittedPredicate(qb, questionIdExpr);
      const suspendedPredicate = this.buildSuspendedUntouchedPredicate(qb, questionIdExpr);

      switch (mode) {
        case TestMode.UNUSED:
          return `(
            NOT EXISTS ${answeredGlobalSub}
            AND NOT (${omittedPredicate})
            AND NOT (${suspendedPredicate})
          )`;
        case TestMode.USED:
          return `(EXISTS ${answeredGlobalSub} OR (${omittedPredicate}))`;
        case TestMode.MARKED: {
          const markedSub = this.buildMarkedExistsSubquery(qb, questionIdExpr);
          return `(EXISTS ${markedSub})`;
        }
        case TestMode.OMITTED:
          return `(${omittedPredicate})`;
        case TestMode.SUSPENDED:
          return `(${suspendedPredicate})`;
        default:
          return '1=1';
      }
    });
  }

  /**
   * Optimized multi-mode filter.
   * Groups modes into two low-cost categories to minimise DB scans:
   *   Category A (submission-table modes): incorrect, correct, marked, used
   *     → merged into a SINGLE EXISTS subquery with OR conditions on question_submissions
   *   Category B (pre-computed ID pools): omitted, suspended, unused
   *     → IDs fetched into memory first, then applied via IN (:...ids) — primary-key lookup only
   * The final WHERE clause is a single top-level OR combining both categories.
   */
  private async applyMultiModeFilter(
    queryBuilder: SelectQueryBuilder<Question>,
    userId: number,
    modes: string[],
  ): Promise<void> {
    if (!modes || modes.length === 0) return; // nothing selected → no filter (treat as ALL)

    queryBuilder.setParameter('userId', userId);

    // USED stays an "any answered submission" EXISTS. INCORRECT/CORRECT are now
    // LATEST-attempt buckets, so they can't be OR'd into the same per-row EXISTS
    // — each is applied as a precomputed primary-key id set (Category B).
    const submissionModes = modes.filter((m) =>
      [TestMode.USED].includes(m as TestMode),
    );
    const idPoolModes = modes.filter((m) =>
      [TestMode.OMITTED, TestMode.SUSPENDED, TestMode.UNUSED].includes(m as TestMode),
    );
    const incorrectSelected = modes.includes(TestMode.INCORRECT);
    const correctSelected = modes.includes(TestMode.CORRECT);
    // MARKED is handled separately — it now lives in user_question_marks, not
    // question_submissions, so it can't be merged into the submission-table EXISTS.
    const markedSelected = modes.includes(TestMode.MARKED);
    // Intersection modes: marked AND latest-attempt status. Overlap with
    // marked / incorrect / correct dedups for free — the top-level OR feeds
    // COUNT(DISTINCT question.id) / DISTINCT id sampling.
    const markedCorrectSelected = modes.includes(TestMode.MARKED_CORRECT);
    const markedIncorrectSelected = modes.includes(TestMode.MARKED_INCORRECT);

    // CRITICAL MATH FIX: In MedPark, "Used" = "Answered" + "Omitted"
    // Since 'used' in submissionModes only captures 'Answered', we must dynamically
    // append 'omitted' to idPoolModes so it gets OR'd into the final query.
    if (modes.includes(TestMode.USED) && !idPoolModes.includes(TestMode.OMITTED)) {
      idPoolModes.push(TestMode.OMITTED);
    }

    const orParts: string[] = [];

    // ── Category A: single EXISTS scan on question_submissions (USED only) ──
    if (submissionModes.length > 0) {
      const conditions: string[] = [];
      if (submissionModes.includes(TestMode.USED))
        conditions.push('sub_m."selectedOptionId" IS NOT NULL');

      const combinedConditions = conditions.map((c) => `(${c})`).join(' OR ');
      orParts.push(
        `EXISTS (SELECT 1 FROM question_submissions sub_m WHERE sub_m."userId" = :userId AND sub_m."questionId" = question.id AND (${combinedConditions}))`,
      );
    }

    // ── Latest-attempt buckets: precomputed id sets (mutually exclusive) ────
    if (incorrectSelected || correctSelected || markedCorrectSelected || markedIncorrectSelected) {
      const { incorrectIds, correctIds } =
        await this.getLatestAnsweredStatusIds(userId);
      if (incorrectSelected && incorrectIds.length > 0) {
        queryBuilder.setParameter('multiIncorrectIds', incorrectIds);
        orParts.push('question.id IN (:...multiIncorrectIds)');
      }
      if (correctSelected && correctIds.length > 0) {
        queryBuilder.setParameter('multiCorrectIds', correctIds);
        orParts.push('question.id IN (:...multiCorrectIds)');
      }
      // Marked ∩ latest-status: id-set IN intersected with a marks EXISTS.
      // Distinct aliases/params so they never collide with the plain
      // incorrect/correct parts above or the plain-marked EXISTS below.
      if (markedIncorrectSelected && incorrectIds.length > 0) {
        queryBuilder.setParameter('multiMarkedIncorrectIds', incorrectIds);
        orParts.push(
          `(question.id IN (:...multiMarkedIncorrectIds) AND EXISTS (SELECT 1 FROM user_question_marks uqm_mi WHERE uqm_mi."user_id" = :userId AND uqm_mi."question_id" = question.id))`,
        );
      }
      if (markedCorrectSelected && correctIds.length > 0) {
        queryBuilder.setParameter('multiMarkedCorrectIds', correctIds);
        orParts.push(
          `(question.id IN (:...multiMarkedCorrectIds) AND EXISTS (SELECT 1 FROM user_question_marks uqm_mc WHERE uqm_mc."user_id" = :userId AND uqm_mc."question_id" = question.id))`,
        );
      }
    }

    // ── Marked: PK-keyed EXISTS on user_question_marks ──────────────────────
    if (markedSelected) {
      orParts.push(
        `EXISTS (SELECT 1 FROM user_question_marks uqm_m WHERE uqm_m."user_id" = :userId AND uqm_m."question_id" = question.id)`,
      );
    }

    // ── Category B: pre-computed ID pools ───────────────────────────────────
    if (idPoolModes.includes(TestMode.OMITTED)) {
      const omittedIds = await this.getOmittedQuestionIds(userId);
      if (omittedIds.length > 0) {
        queryBuilder.setParameter('multiOmittedIds', omittedIds);
        orParts.push('question.id IN (:...multiOmittedIds)');
      }
    }

    if (idPoolModes.includes(TestMode.SUSPENDED)) {
      // Re-use the existing predicate builder (correlated subquery, but cheap on indexed columns)
      const suspendedClause = queryBuilder.expressionMap.wheres.length
        ? this.buildSuspendedUntouchedPredicate(queryBuilder, 'question.id')
        : null;
      if (suspendedClause) orParts.push(`(${suspendedClause})`);
    }

    if (idPoolModes.includes(TestMode.UNUSED)) {
      // Unused = never answered globally AND not omitted AND not suspended
      const answeredGlobalSub = this.buildAnsweredGlobalExistsSubquery(queryBuilder, 'question.id');
      const omittedIds = await this.getOmittedQuestionIds(userId);
      const suspendedClause = this.buildSuspendedUntouchedPredicate(queryBuilder, 'question.id');
      
      const unusedConditions = [`NOT EXISTS ${answeredGlobalSub}`];
      
      if (omittedIds.length > 0) {
        queryBuilder.setParameter('multiUnusedOmittedIds', omittedIds);
        unusedConditions.push('question.id NOT IN (:...multiUnusedOmittedIds)');
      }
      
      if (suspendedClause) {
        unusedConditions.push(`NOT (${suspendedClause})`);
      }
      
      orParts.push(`(${unusedConditions.join(' AND ')})`);
    }

    if (orParts.length > 0) {
      queryBuilder.andWhere(`(${orParts.join(' OR ')})`);
    } else {
      // Modes were selected but none contributed a predicate (all id sets
      // empty) — match nothing. Without this, an empty orParts would apply
      // NO filter and silently degrade to ALL questions.
      queryBuilder.andWhere('1 = 0');
    }
  }

  /**
   * Returns the exact deduplicated count of questions matching a combined set of modes.
   * Uses the same two-category optimisation as applyMultiModeFilter — one round-trip to the DB.
   * Results are cached for 5 seconds to handle rapid checkbox toggling without hammering the DB.
   */
  async getMixedModeCount(
    user: User,
    filters: any,
    step: number,
  ): Promise<{ count: number }> {
    const userId = user.id;
    const modesKey = [...(filters?.modes ?? [])].sort().join(',');
    const filterHash = this.extractFilterHashDetailed(filters);
    const cacheKey = `mixed_count:${userId}:${step}:modes:${modesKey}:f:${filterHash}`;

    const cached = await this.cacheManager.get<{ count: number }>(cacheKey);
    if (cached) return cached;

    if (!filters?.modes || filters.modes.length === 0) {
      return { count: 0 };
    }

    // ── Enforce bank access ──────────────────────────────────────────────────
    const allowedBankIds = await this.subscriptionService.getAllowedQuestionBankIds(user, step);
    let enforcedBankIds = allowedBankIds;
    if (filters?.questionBankIds?.length > 0) {
      enforcedBankIds = filters.questionBankIds.filter((id: number) =>
        allowedBankIds.includes(Number(id)),
      );
    }

    // ── Base query ───────────────────────────────────────────────────────────
    const queryBuilder = this.questionRepository
      .createQueryBuilder('question')
      .select('COUNT(DISTINCT question.id)', 'count')
      .where('question.step = :step', { step })
      .andWhere('question.isActive = :isActive', { isActive: true });

    if (enforcedBankIds.length > 0) {
      queryBuilder.andWhere('question.questionBankId IN (:...bankIds)', {
        bankIds: enforcedBankIds,
      });
    }
    if (filters?.subjectIds?.length > 0) {
      queryBuilder.andWhere('question.subjectId IN (:...subjectIds)', {
        subjectIds: filters.subjectIds,
      });
    }
    if (filters?.systemIds?.length > 0) {
      queryBuilder.andWhere('question.systemId IN (:...systemIds)', {
        systemIds: filters.systemIds,
      });
    }
    if (filters?.topicIds?.length > 0) {
      queryBuilder.andWhere('question.topicId IN (:...topicIds)', {
        topicIds: filters.topicIds,
      });
    }

    // Difficulty must scope the combined count too — the cache key already
    // hashes filters.difficulty, so skipping it here silently returned
    // difficulty-blind counts (dormant until the Create Test page grew a
    // difficulty UI).
    if (filters?.difficulty?.length > 0) {
      this.applyDifficultyFilter(queryBuilder, filters.difficulty);
    }

    // ── Apply optimised multi-mode filter ────────────────────────────────────
    await this.applyMultiModeFilter(queryBuilder, userId, filters.modes);

    const result = await queryBuilder.getRawOne<{ count: string }>();
    const count = parseInt(result?.count ?? '0', 10) || 0;

    await this.cacheManager.set(cacheKey, { count }, 5000); // 5s TTL
    return { count };
  }

  private async getOmittedQuestionIds(userId: number): Promise<number[]> {
    // Omitted = never answered globally, and either:
    // - explicitly submitted blank (any test status), OR
    // - included in a completed test (even if never submitted).

    const blankRows = await this.submissionRepository
      .createQueryBuilder('sub')
      .select('DISTINCT sub.questionId', 'questionId')
      .where('sub.userId = :userId', { userId })
      .andWhere('sub.selectedOptionId IS NULL')
      .andWhere((qb) => {
        const answeredGlobalSub = qb
          .subQuery()
          .select('1')
          .from(QuestionSubmission, 'sub_ans')
          .where('sub_ans.userId = :userId')
          .andWhere('sub_ans.questionId = sub.questionId')
          .andWhere('sub_ans.selectedOptionId IS NOT NULL')
          .getQuery();
        return `NOT EXISTS ${answeredGlobalSub}`;
      })
      .getRawMany();

    const completedSeenRows = await this.testQuestionRepository
      .createQueryBuilder('tq')
      .innerJoin(Test, 'test', 'test.id = tq.testId')
      .where('test.userId = :userId', { userId })
      .andWhere(`test.status = '${TestStatus.COMPLETED}'`)
      .andWhere((qb) => {
        const answeredGlobalSub = qb
          .subQuery()
          .select('1')
          .from(QuestionSubmission, 'sub_ans')
          .where('sub_ans.userId = :userId')
          .andWhere('sub_ans.questionId = tq.questionId')
          .andWhere('sub_ans.selectedOptionId IS NOT NULL')
          .getQuery();
        return `NOT EXISTS ${answeredGlobalSub}`;
      })
      .select('DISTINCT tq.questionId', 'questionId')
      .getRawMany();

    const ids = new Set<number>();
    for (const row of [...blankRows, ...completedSeenRows]) {
      const id = Number((row as any).questionId);
      if (Number.isFinite(id)) ids.add(id);
    }

    return Array.from(ids);
  }

  /**
   * Resolves correct/incorrect status by the user's LATEST answered attempt per
   * question — not "any attempt ever". This is what makes a question that was
   * answered wrong and later answered correctly move OUT of the incorrect pool
   * and INTO the correct pool (UWorld parity), and keeps the two buckets
   * mutually exclusive (correct + incorrect === answered).
   *
   * One indexed pass: DISTINCT ON keeps only the newest answered submission per
   * question (tie-broken by id for determinism), then we split the question ids
   * into incorrect/correct sets that callers apply as a primary-key IN / ANY.
   */
  private async getLatestAnsweredStatusIds(
    userId: number,
  ): Promise<{ incorrectIds: number[]; correctIds: number[] }> {
    const rows: Array<{ questionId: number; isCorrect: boolean }> =
      await this.submissionRepository.query(
        `SELECT DISTINCT ON ("questionId") "questionId", "isCorrect"
           FROM question_submissions
          WHERE "userId" = $1 AND "selectedOptionId" IS NOT NULL
          ORDER BY "questionId", "submittedAt" DESC, "id" DESC`,
        [userId],
      );

    const incorrectIds: number[] = [];
    const correctIds: number[] = [];
    for (const row of rows) {
      const id = Number(row.questionId);
      if (!Number.isFinite(id)) continue;
      if (row.isCorrect) correctIds.push(id);
      else incorrectIds.push(id);
    }

    return { incorrectIds, correctIds };
  }

  private async selectQuestionIdsWithGroupings(
    baseQuery: SelectQueryBuilder<Question>,
    requestedTotal: number,
    options?: { strictGroupEligibility?: boolean },
  ): Promise<{ questionIds: number[]; actualTotalQuestions: number; groupedAddedCount: number }> {
    const pickRaw = (row: any, keys: string[]): any => {
      for (const k of keys) {
        if (row && Object.prototype.hasOwnProperty.call(row, k) && row[k] !== undefined) return row[k];
      }
      return undefined;
    };

    const desired = Math.max(1, Math.min(200, Number(requestedTotal || 0)));
    const hardCap = 200;
    const sampleSize = Math.min(
      this.groupedSampleMax,
      Math.max(desired, desired * 25),
    );

    const sampleRows = await baseQuery
      .clone()
      // Use TypeORM aliasing to ensure stable raw keys across drivers.
      .select('question.id', 'id')
      .addSelect('question.externalId', 'externalId')
      .addSelect('question.questionBankId', 'questionBankId')
      .orderBy('RANDOM()')
      .limit(sampleSize)
      .getRawMany<any>();

    const normalizedSample = sampleRows
      .map((row) => ({
        id: Number(
          pickRaw(row, [
            'id',
            'question_id',
            'questionId',
            'question.id',
          ]),
        ),
        externalId: (() => {
          const value = pickRaw(row, [
            'externalId',
            'question_externalId',
            'question_externalid',
            'externalid',
          ]);
          return value ? String(value).trim() : null;
        })(),
        questionBankId: Number(
          pickRaw(row, [
            'questionBankId',
            'question_questionBankId',
            'question_questionbankid',
            'questionBankID',
            'questionbankid',
            'question_bank_id',
          ]),
        ),
      }))
      .filter((row) => Number.isFinite(row.id) && Number.isFinite(row.questionBankId));

    if (normalizedSample.length === 0) {
      return { questionIds: [], actualTotalQuestions: 0, groupedAddedCount: 0 };
    }

    const bankIds = Array.from(new Set(normalizedSample.map((r) => r.questionBankId)));
    const externalIds = Array.from(
      new Set(
        normalizedSample
          .map((r) => r.externalId)
          .filter((v): v is string => Boolean(v)),
      ),
    );

    const groupLookup = new Map<string, string>(); // `${bankId}:${externalId}` -> groupKey
    if (externalIds.length > 0) {
      const lookupRows = await this.questionGroupingRepository.find({
        where: { questionBankId: In(bankIds), externalId: In(externalIds) },
        select: ['externalId', 'questionBankId', 'groupKey'],
      });
      for (const row of lookupRows) {
        groupLookup.set(
          `${Number(row.questionBankId)}:${String(row.externalId).trim()}`,
          String(row.groupKey).trim(),
        );
      }
    }

    const groupUnitKeys = new Set<string>(); // `${bankId}:${groupKey}`
    for (const row of normalizedSample) {
      if (!row.externalId) continue;
      const groupKey = groupLookup.get(`${row.questionBankId}:${row.externalId}`);
      if (groupKey) {
        groupUnitKeys.add(`${row.questionBankId}:${groupKey}`);
      }
    }

    const groupMembersByUnitKey = new Map<string, number[]>();
    if (groupUnitKeys.size > 0) {
      const groupKeys = Array.from(
        new Set(Array.from(groupUnitKeys).map((k) => k.split(':')[1])),
      );

      const groupingRows = await this.questionGroupingRepository
        .createQueryBuilder('g')
        .where('g.questionBankId IN (:...bankIds)', { bankIds })
        .andWhere('g.groupKey IN (:...groupKeys)', { groupKeys })
        .orderBy('g.questionBankId', 'ASC')
        .addOrderBy('g.groupKey', 'ASC')
        .addOrderBy('g.position', 'ASC')
        .getMany();

      const expectedCountByUnitKey = new Map<string, number>();
      for (const g of groupingRows) {
        const unitKey = `${Number(g.questionBankId)}:${String(g.groupKey).trim()}`;
        expectedCountByUnitKey.set(unitKey, (expectedCountByUnitKey.get(unitKey) || 0) + 1);
      }

      const allGroupedExternalIds = Array.from(
        new Set(groupingRows.map((g) => String(g.externalId).trim())),
      );

      const groupedQuestions = await this.questionRepository.find({
        where: {
          questionBankId: In(bankIds),
          externalId: In(allGroupedExternalIds),
          isActive: true,
        },
        select: ['id', 'externalId', 'questionBankId'],
      });

      const questionIdByBankExternalId = new Map<string, number>();
      for (const q of groupedQuestions) {
        const ext = q.externalId ? String(q.externalId).trim() : '';
        if (!ext) continue;
        questionIdByBankExternalId.set(`${Number(q.questionBankId)}:${ext}`, Number(q.id));
      }

      for (const g of groupingRows) {
        const unitKey = `${Number(g.questionBankId)}:${String(g.groupKey).trim()}`;
        const qid = questionIdByBankExternalId.get(
          `${Number(g.questionBankId)}:${String(g.externalId).trim()}`,
        );
        if (!qid) continue;
        const existing = groupMembersByUnitKey.get(unitKey) || [];
        existing.push(qid);
        groupMembersByUnitKey.set(unitKey, existing);
      }

      for (const [key, ids] of groupMembersByUnitKey.entries()) {
        const seen = new Set<number>();
        const ordered = ids.filter((id) => {
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        const expected = expectedCountByUnitKey.get(key) || 0;
        if (expected > 0 && ordered.length === expected) {
          groupMembersByUnitKey.set(key, ordered);
        } else {
          // Incomplete group in DB; don't include a partial set in tests.
          groupMembersByUnitKey.delete(key);
        }
      }
    }

    if (options?.strictGroupEligibility && groupMembersByUnitKey.size > 0) {
      // Suspended mode should never expand into siblings that do not satisfy the same base query filters
      // (e.g., already-used questions). We do this once for all group member IDs to avoid N+1 queries.
      const allMemberIds = Array.from(
        new Set(Array.from(groupMembersByUnitKey.values()).flat()),
      ).filter(Number.isFinite);

      if (allMemberIds.length > 0) {
        const eligibleRows = await baseQuery
          .clone()
          .select('question.id', 'id')
          .andWhere('question.id IN (:...ids)', { ids: allMemberIds })
          .getRawMany<{ id: number }>();

        const eligible = new Set(eligibleRows.map((r) => Number((r as any).id)).filter(Number.isFinite));

        for (const [unitKey, memberIds] of groupMembersByUnitKey.entries()) {
          if (memberIds.some((id) => !eligible.has(id))) {
            groupMembersByUnitKey.delete(unitKey);
          }
        }
      }
    }

    const units: Array<{ key: string; questionIds: number[] }> = [];
    const seenUnits = new Set<string>();
    for (const row of normalizedSample) {
      if (row.externalId) {
        const groupKey = groupLookup.get(`${row.questionBankId}:${row.externalId}`);
        if (groupKey) {
          const unitKey = `${row.questionBankId}:${groupKey}`;
          if (seenUnits.has(unitKey)) continue;
          seenUnits.add(unitKey);
          const members = groupMembersByUnitKey.get(unitKey) || [];
          if (members.length > 0) {
            units.push({ key: unitKey, questionIds: members });
            continue;
          }
          // If the grouping table is incomplete / missing members in DB, fall back to the sampled question
          // instead of silently dropping it from selection.
        }
      }
      const unitKey = `q:${row.id}`;
      if (seenUnits.has(unitKey)) continue;
      seenUnits.add(unitKey);
      units.push({ key: unitKey, questionIds: [row.id] });
    }

    const selectedIds: number[] = [];
    const selectedSet = new Set<number>();
    for (const unit of units) {
      if (selectedIds.length >= desired) break;
      const newIds = unit.questionIds.filter((qid) => !selectedSet.has(qid));
      if (newIds.length === 0) continue;
      if (selectedIds.length + newIds.length > hardCap) {
        // Avoid exceeding the system max even when rounding up for a full group.
        continue;
      }
      for (const qid of newIds) {
        selectedSet.add(qid);
        selectedIds.push(qid);
      }
    }

    const actualTotalQuestions = selectedIds.length;
    const groupedAddedCount = Math.max(0, actualTotalQuestions - desired);
    return { questionIds: selectedIds, actualTotalQuestions, groupedAddedCount };
  }

  private async expandCustomQuestionsWithGroupings(
    externalIdsInOrder: string[],
    customQuestions: Question[],
  ): Promise<Question[]> {
    const questionByExternalId = new Map<string, Question>();
    for (const q of customQuestions) {
      if (!q.externalId) continue;
      questionByExternalId.set(String(q.externalId).trim(), q);
    }

    const orderedExternalIds = externalIdsInOrder
      .map((value) => String(value).trim())
      .filter(Boolean);

    const bankIds = Array.from(
      new Set(customQuestions.map((q) => Number(q.questionBankId)).filter(Number.isFinite)),
    );

    const lookupRows = await this.questionGroupingRepository.find({
      where: { questionBankId: In(bankIds), externalId: In(orderedExternalIds) },
      select: ['externalId', 'questionBankId', 'groupKey'],
    });

    const groupKeyByBankExternal = new Map<string, string>();
    for (const row of lookupRows) {
      groupKeyByBankExternal.set(
        `${Number(row.questionBankId)}:${String(row.externalId).trim()}`,
        String(row.groupKey).trim(),
      );
    }

    const unitKeysInOrder: string[] = [];
    const seenUnitKeys = new Set<string>();

    for (const extId of orderedExternalIds) {
      const q = questionByExternalId.get(extId);
      if (!q) continue;
      const bankId = Number(q.questionBankId);
      const groupKey = groupKeyByBankExternal.get(`${bankId}:${extId}`);
      const unitKey = groupKey ? `${bankId}:${groupKey}` : `q:${bankId}:${extId}`;
      if (seenUnitKeys.has(unitKey)) continue;
      seenUnitKeys.add(unitKey);
      unitKeysInOrder.push(unitKey);
    }

    const groupKeys = unitKeysInOrder
      .filter((k) => !k.startsWith('q:'))
      .map((k) => k.split(':')[1]);

    const groupMembersByUnitKey = new Map<string, string[]>();
    if (groupKeys.length > 0) {
      const groupingRows = await this.questionGroupingRepository
        .createQueryBuilder('g')
        .where('g.questionBankId IN (:...bankIds)', { bankIds })
        .andWhere('g.groupKey IN (:...groupKeys)', { groupKeys: Array.from(new Set(groupKeys)) })
        .orderBy('g.questionBankId', 'ASC')
        .addOrderBy('g.groupKey', 'ASC')
        .addOrderBy('g.position', 'ASC')
        .getMany();

      const expectedCountByUnitKey = new Map<string, number>();
      for (const g of groupingRows) {
        const unitKey = `${Number(g.questionBankId)}:${String(g.groupKey).trim()}`;
        expectedCountByUnitKey.set(unitKey, (expectedCountByUnitKey.get(unitKey) || 0) + 1);
      }

      for (const g of groupingRows) {
        const unitKey = `${Number(g.questionBankId)}:${String(g.groupKey).trim()}`;
        const existing = groupMembersByUnitKey.get(unitKey) || [];
        existing.push(String(g.externalId).trim());
        groupMembersByUnitKey.set(unitKey, existing);
      }

      for (const [key, ids] of groupMembersByUnitKey.entries()) {
        const seen = new Set<string>();
        const ordered = ids.filter((id) => {
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        const expected = expectedCountByUnitKey.get(key) || 0;
        if (expected > 0 && ordered.length === expected) {
          groupMembersByUnitKey.set(key, ordered);
        } else {
          groupMembersByUnitKey.delete(key);
        }
      }
    }

    const expandedExternalIds: string[] = [];
    const expandedSeen = new Set<string>();

    for (const unitKey of unitKeysInOrder) {
      if (unitKey.startsWith('q:')) {
        const extId = unitKey.split(':').slice(2).join(':'); // q:bankId:extId
        if (!expandedSeen.has(extId)) {
          expandedSeen.add(extId);
          expandedExternalIds.push(extId);
        }
        continue;
      }
      const members = groupMembersByUnitKey.get(unitKey) || [];
      for (const extId of members) {
        if (expandedSeen.has(extId)) continue;
        expandedSeen.add(extId);
        expandedExternalIds.push(extId);
      }
    }

    const expandedQuestions = await this.questionRepository.find({
      where: {
        questionBankId: In(bankIds),
        externalId: In(expandedExternalIds),
        isActive: true,
      },
    });

    const expandedByExternalId = new Map<string, Question>();
    for (const q of expandedQuestions) {
      if (!q.externalId) continue;
      expandedByExternalId.set(String(q.externalId).trim(), q);
    }

    return expandedExternalIds
      .map((id) => expandedByExternalId.get(id))
      .filter(Boolean) as Question[];
  }

  private async selectBlockQuestionIdsGrouped(input: {
    questionBankId: number;
    remainingQuestions: Array<{ id: number; externalId: string | null }>;
    usedQuestionIds: Set<number>;
    targetCount: number;
  }): Promise<number[]> {
    const target = Math.max(1, Number(input.targetCount || 0));

    const remainingById = new Set(input.remainingQuestions.map((q) => q.id));
    // For group integrity we must resolve against ALL questions in the bank,
    // not just remaining ones; otherwise groups can be accidentally split across blocks.
    const allQuestionRows = await this.questionRepository
      .createQueryBuilder('question')
      .select(['question.id AS "id"', 'question.externalId AS "externalId"'])
      .where('question.questionBankId = :bankId', { bankId: input.questionBankId })
      .andWhere('question.isActive = :isActive', { isActive: true })
      .getRawMany<{ id: number; externalId: string | null }>();

    const questionIdByExternalId = new Map<string, number>();
    for (const row of allQuestionRows) {
      const id = Number(row.id);
      if (!Number.isFinite(id)) continue;
      const ext = row.externalId ? String(row.externalId).trim() : '';
      if (!ext) continue;
      // If a bank somehow has duplicate externalIds, keep the first occurrence.
      if (!questionIdByExternalId.has(ext)) {
        questionIdByExternalId.set(ext, id);
      }
    }

    const groupingRows = await this.questionGroupingRepository
      .createQueryBuilder('g')
      .where('g.questionBankId = :bankId', { bankId: input.questionBankId })
      .orderBy('g.groupKey', 'ASC')
      .addOrderBy('g.position', 'ASC')
      .getMany();

    // Build full group membership (in JSON/position order).
    const groupMembersByKey = new Map<string, number[]>();
    const groupExternalIdsByKey = new Map<string, string[]>();
    for (const g of groupingRows) {
      const groupKey = String(g.groupKey).trim();
      const extId = String(g.externalId).trim();
      if (!groupKey || !extId) continue;
      const existingExt = groupExternalIdsByKey.get(groupKey) || [];
      existingExt.push(extId);
      groupExternalIdsByKey.set(groupKey, existingExt);
    }

    for (const [groupKey, externalIds] of groupExternalIdsByKey.entries()) {
      const members: number[] = [];
      const seen = new Set<number>();
      for (const extId of externalIds) {
        const qid = questionIdByExternalId.get(extId);
        if (!qid) {
          // Incomplete group in DB: skip enforcing grouping for this set to avoid blocking blocks.
          members.length = 0;
          break;
        }
        if (seen.has(qid)) continue;
        seen.add(qid);
        members.push(qid);
      }
      if (members.length >= 2) {
        groupMembersByKey.set(groupKey, members);
      }
    }

    const units: Array<{ key: string; questionIds: number[] }> = [];
    const groupedQuestionIds = new Set<number>();
    const blockedGroupedIds = new Set<number>();

    for (const [groupKey, ids] of groupMembersByKey.entries()) {
      const uniqueIds = ids;
      for (const id of uniqueIds) groupedQuestionIds.add(id);

      const anyUsed = uniqueIds.some((id) => input.usedQuestionIds.has(id));
      const allRemaining = uniqueIds.every((id) => remainingById.has(id));

      if (!anyUsed && allRemaining) {
        // Whole group is available in this block: select as an atomic unit.
        units.push({ key: `g:${groupKey}`, questionIds: uniqueIds });
      } else {
        // Group cannot be taken whole (because some members already used or not remaining).
        // Never allow the remaining parts to appear as singles in later blocks.
        for (const id of uniqueIds) blockedGroupedIds.add(id);
      }
    }

    for (const q of input.remainingQuestions) {
      if (groupedQuestionIds.has(q.id)) continue;
      if (blockedGroupedIds.has(q.id)) continue;
      units.push({ key: `q:${q.id}`, questionIds: [q.id] });
    }

    this.shuffleArray(units);

    const selected: number[] = [];
    const selectedSingles: number[] = [];
    for (const unit of units) {
      if (selected.length >= target) break;
      const remainingSlots = target - selected.length;
      const size = unit.questionIds.length;

      if (size <= remainingSlots) {
        selected.push(...unit.questionIds);
        if (size === 1) selectedSingles.push(unit.questionIds[0]);
        continue;
      }

      // If a group doesn't fit, we can still include it by dropping already-selected singles
      // to keep the block count exactly `target` (normally 20).
      if (size > 1) {
        const overflow = size - remainingSlots;
        if (selectedSingles.length < overflow) continue;

        selected.push(...unit.questionIds);

        for (let i = 0; i < overflow; i++) {
          const removeId = selectedSingles.pop();
          if (!removeId) break;
          const idx = selected.indexOf(removeId);
          if (idx >= 0) selected.splice(idx, 1);
        }
      }
    }

    return selected;
  }

  async validateQuestionSets(questions: Question[]): Promise<void> {
    const questionsByBank = questions.reduce((acc, q) => {
      if (!acc[q.questionBankId]) acc[q.questionBankId] = [];
      acc[q.questionBankId].push(q);
      return acc;
    }, {} as Record<number, Question[]>);

    for (const bankId of Object.keys(questionsByBank)) {
      const bankQuestions = questionsByBank[Number(bankId)];
      const questionSetIds = Array.from(new Set(
        bankQuestions
          .filter(q => q.parentSetId)
          .map(q => q.parentSetId!)
      ));

      if (questionSetIds.length > 0) {
        const allSetQuestions = await this.questionRepository.find({
          where: { parentSetId: In(questionSetIds), isActive: true },
        });

        for (const setId of questionSetIds) {
          const requiredIds = allSetQuestions
            .filter(q => q.parentSetId === setId)
            .map(q => q.id);
          
          const includedIds = bankQuestions
            .filter(q => q.parentSetId === setId)
            .map(q => q.id);

          const missingIds = requiredIds.filter(id => !includedIds.includes(id));
          
          if (missingIds.length > 0) {
            const missingQuestions = allSetQuestions.filter(q => missingIds.includes(q.id));
            questions.push(...missingQuestions);
          }
        }
      }
    }
  }

  private buildBlueprintSignature(input: {
    step: number;
    type: string;
    mode: string;
    totalQuestions: number;
    filters?: any;
    timeLimitSeconds?: number;
    customQuestionIds?: number[];
  }): string {
    const normalizeNumberArray = (values?: number[]) =>
      [...new Set((values || []).map((value) => Number(value)).filter((value) => !Number.isNaN(value)))].sort(
        (left, right) => left - right,
      );
    const normalizeStringArray = (values?: string[]) =>
      [...new Set((values || []).map((value) => String(value).trim().toLowerCase()).filter(Boolean))].sort();

    const normalized = {
      step: Number(input.step),
      type: String(input.type || '').toLowerCase(),
      mode: String(input.mode || '').toLowerCase(),
      totalQuestions: Number(input.totalQuestions || 0),
      timeLimitSeconds: input.timeLimitSeconds ? Number(input.timeLimitSeconds) : null,
      filters: {
        subjectIds: normalizeNumberArray(input.filters?.subjectIds),
        systemIds: normalizeNumberArray(input.filters?.systemIds),
        topicIds: normalizeNumberArray(input.filters?.topicIds),
        questionBankIds: normalizeNumberArray(input.filters?.questionBankIds),
        difficulty: normalizeStringArray(input.filters?.difficulty),
      },
      customQuestionIds: normalizeNumberArray(input.customQuestionIds),
    };

    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  private applyDifficultyFilter(
    queryBuilder: SelectQueryBuilder<Question>,
    difficultyValues: Array<QuestionDifficultyTier | string>,
  ) {
    if (!difficultyValues?.length) {
      return;
    }

    // 5-tier Create-Test difficulty. Reads the stored questions.difficulty
    // column — backfilled and kept in sync by the DB trigger
    // trg_question_options_difficulty (migration 1803000000014), so no join
    // to question_options is needed. NULL (no UWorld data) never matches
    // the IN list → excluded while a difficulty filter is active, included
    // when it isn't.
    //
    // The DTO already enforces QuestionDifficultyTier membership; this
    // re-normalization is defense-in-depth for internal callers passing
    // loosely-typed filter objects. All-invalid input matches nothing
    // rather than silently disabling the filter.
    const allowed = new Set<string>(Object.values(QuestionDifficultyTier));
    const tiers = difficultyValues
      .map((value) => String(value).toLowerCase())
      .filter((value) => allowed.has(value));

    if (tiers.length === 0) {
      queryBuilder.andWhere('1 = 0');
      return;
    }

    queryBuilder.andWhere('question.difficultyTier IN (:...difficulty)', {
      difficulty: tiers,
    });
  }

  private shuffleArray<T>(values: T[]) {
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
  }
}
