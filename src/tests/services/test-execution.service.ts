import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException, Inject, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not, In } from 'typeorm';
import { Test, TestStatus, TestType } from '../../entities/test.entity';
import { TestQuestion } from '../../entities/test-question.entity';
import { Question } from '../../entities/question.entity';
import { QuestionBank } from '../../entities/question-bank.entity';
import {
  AnswerTransitionPattern,
  QuestionSubmission,
} from '../../entities/question-submission.entity';
import { UserQuestionHighlight } from '../../entities/user-question-highlight.entity';
import { UserQuestionMark } from '../../entities/user-question-mark.entity';
import { QuestionInteraction, InteractionType } from '../../entities/question-interaction.entity';
import { QuestionFeedback, FeedbackType } from '../../entities/question-feedback.entity';
import { TestAnalyticsSnapshot } from '../../entities/test-analytics-snapshot.entity';
import { SubmitAnswerDto, CompleteTestDto, QuestionFeedbackDto, UpdateHighlightsDto, ToggleMarkDto, SubmitAnswersBatchDto } from '../dto/test.dto';
import { v4 as uuidv4 } from 'uuid';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AnalyticsAggregationService } from './analytics-aggregation.service';
import {
  questionExplanationCacheKey,
  QUESTION_EXPLANATION_TTL_MS,
  userCountsEpochCacheKey,
  USER_COUNTS_EPOCH_TTL_MS,
} from '../../cache/cache-keys.util';
import { safeCacheGet, safeCacheSet } from '../../cache/safe-cache.util';
import { AdminHistory } from '../../entities/admin-history.entity';
import { UserDailyStats } from '../../entities/user-daily-stats.entity';
import { User } from '../../entities/user.entity';

@Injectable()
export class TestExecutionService {
  private readonly logger = new Logger(TestExecutionService.name);
  private readonly defaultBlockSize = 20;

  constructor(
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
    @InjectRepository(TestQuestion)
    private testQuestionRepository: Repository<TestQuestion>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(QuestionBank)
    private questionBankRepository: Repository<QuestionBank>,
    @InjectRepository(QuestionSubmission)
    private submissionRepository: Repository<QuestionSubmission>,
    @InjectRepository(QuestionInteraction)
    private interactionRepository: Repository<QuestionInteraction>,
    @InjectRepository(QuestionFeedback)
    private feedbackRepository: Repository<QuestionFeedback>,
    @InjectRepository(AdminHistory)
    private historyRepo: Repository<AdminHistory>,
    @InjectRepository(UserDailyStats)
    private dailyStatsRepository: Repository<UserDailyStats>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserQuestionHighlight)
    private highlightRepository: Repository<UserQuestionHighlight>,
    @InjectRepository(UserQuestionMark)
    private markRepository: Repository<UserQuestionMark>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    private analyticsAggregationService: AnalyticsAggregationService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Fix #1: invalidate the filter-availability counts cache for a user.
  //
  // Called on every test state transition (complete / suspend / resume /
  // delete / create / timed-expiry) and on mark-toggle.
  //
  // Implementation: bump the user's per-user epoch. Cache keys are shaped
  //   user_performance:{userId}:question_counts:v{epoch}:step:{step}:filters:{hash}
  // so writing a fresh epoch orphans every (step, filter) variant the user
  // had cached. The old entries become unreachable and self-expire via the
  // 60s FILTER_COUNTS_TTL_MS. One Redis write covers everything — no need
  // to enumerate filter hashes like `bank:19`, `sub:1,2`, etc.
  //
  // The `step` parameter is kept for call-site readability but is unused —
  // the epoch is per-user and covers every step variant.
  //
  // NOTE: by design we do NOT invalidate on every answer submit — that would
  // mean a Redis write per question click in tutor mode. The display can be
  // off by 1 mid-test; actual test creation always runs a fresh query, so
  // users never get a broken test.
  // ─────────────────────────────────────────────────────────────────────────
  private async invalidateFilterCountsCache(userId: number, _step?: number | null): Promise<void> {
    // safeCacheSet swallows Redis errors. A missed bump just means a 60s
    // stale window before the existing entries naturally expire.
    await safeCacheSet(
      this.cacheManager,
      userCountsEpochCacheKey(userId),
      String(Date.now()),
      USER_COUNTS_EPOCH_TTL_MS,
    );
  }

  async submitAnswer(id: any, userId: number, submitAnswerDto: SubmitAnswerDto): Promise<any> {
    const testId = this.parseAndValidateId(id);
    const {
      questionId,
      selectedOptionId,
      timeSpentSeconds,
      answerSequence,
      selectionHistory,
      highlights,
      isMarked,
      notes,
    } = submitAnswerDto;

    // CACHE-FIRST OPTIMIZATION: Check cache before database
    const cacheKey = `question_keys:${questionId}:answer`;
    let correctOptionId: number | null = await this.cacheManager.get(cacheKey);
    
    const cacheHit = correctOptionId !== null && correctOptionId !== undefined;
    console.log(`🔍 Question ${questionId}: ${cacheHit ? '✅ CACHE HIT (1ms)' : '❌ CACHE MISS - Querying DB (20ms)'}`);
    
    // Parallel fetch: test + question (only if not in cache)
    const [test, question] = await Promise.all([
      this.testRepository.findOne({ where: { id: testId } }),
      // Only fetch from DB if not in cache
      !cacheHit
        ? this.questionRepository
            .createQueryBuilder('q')
            .leftJoinAndSelect('q.options', 'opt')
            .where('q.id = :questionId', { questionId })
            .select(['q.id', 'opt.id', 'opt.isCorrect'])
            .getOne()
        : Promise.resolve(null) // Skip DB query if cached
    ]);

    if (!test) throw new NotFoundException('No results found for this id');
    if (test.userId !== userId) throw new ForbiddenException('You do not have access to this test');

    if (test.type === TestType.TIMED) {
      throw new BadRequestException('Use /submit-batch for timed tests');
    }

    // Check for expiration. Two paths:
    //   v=1 (legacy + Timed): wall-clock elapsed vs limit — original behaviour.
    //   v=2 (Mixed): server's active-time accumulator (timeSpentSeconds + this
    //   submit's delta) vs limit. Matches the frontend's pause-on-explanation
    //   visual; no wall-clock involvement. On boundary we save-then-complete
    //   and return autoCompleted=true (caller navigates to results) instead
    //   of throwing 400.
    const isV2Mixed = Number(test.timeAccountingVersion) === 2;
    if (test.status === TestStatus.IN_PROGRESS && test.timeLimitSeconds) {
      if (isV2Mixed) {
        const persisted = Number(test.timeSpentSeconds || 0);
        // Active-time semantics — trust client's per-submit delta. Honest
        // user may sit hours on a hard vignette before answering; the
        // frontend's pause-on-answered behaviour means review time isn't in
        // this number. Only guard against NaN/negative (Number(null) → 0,
        // Number(undefined/'') → NaN).
        const rawDelta = Number(timeSpentSeconds);
        const delta = Number.isFinite(rawDelta) && rawDelta > 0 ? rawDelta : 0;
        if (persisted + delta >= Number(test.timeLimitSeconds)) {
          return this.saveThenAutoCompleteMixed(
            test,
            userId,
            submitAnswerDto,
            correctOptionId,
            cacheHit,
            question,
          );
        }
      } else {
        const elapsedTimeSeconds = this.getElapsedTimeSeconds(test);
        if (elapsedTimeSeconds >= Number(test.timeLimitSeconds)) {
          test.status = TestStatus.COMPLETED;
          test.completedAt = new Date();
          test.timeSpentSeconds = Number(test.timeLimitSeconds);
          test.percentageScore = test.totalQuestions > 0 ? (Number(test.correctAnswers) / Number(test.totalQuestions)) * 100 : 0;
          await this.testRepository.save(test);
          throw new BadRequestException('Test time limit has expired. Test has been automatically submitted.');
        }
      }
    }

    if (test.status === TestStatus.SUSPENDED) {
      throw new BadRequestException('Test is suspended. Resume the test before submitting answers.');
    }
    if (test.status !== TestStatus.IN_PROGRESS) throw new BadRequestException('Test is not in progress');

    // Timed tests (v=1): checkpoint wall-clock elapsed so the countdown stays accurate.
    // v=2 Mixed: no-op — active-time accumulator owns the clock, no wall-clock involvement.
    // Tutor/untimed: skip — their time is accumulated per-question at save time.
    if (test.timeLimitSeconds && !isV2Mixed) {
      this.checkpointElapsedTime(test);
    }

    // Get correct answer from cache or DB result
    if (!cacheHit) {
      // Not in cache - get from DB and cache it
      const correctOption = question?.options.find(o => o.isCorrect);
      correctOptionId = correctOption?.id || null;
      
      // Cache for 1 hour (answers don't change)
      if (correctOptionId) {
        await this.cacheManager.set(cacheKey, correctOptionId, 3600000); // 1 hour in ms
        console.log(`💾 Cached answer for Question ${questionId}: Option ${correctOptionId}`);
      }
    }

    // INSTANT RESPONSE: Calculate correctness immediately
    const isCorrect = selectedOptionId === correctOptionId;
    const normalizedInput = this.normalizeAnswerInput(selectionHistory, answerSequence);
    const normalizedSequence = normalizedInput.answerSequence;
    const normalizedSelectionHistory = normalizedInput.selectionHistory;
    const firstSelectedOptionId =
      normalizedSequence.length > 0 ? Number(normalizedSequence[0]) : null;
    const answerTransitionPattern = this.classifyAnswerTransition(
      firstSelectedOptionId,
      selectedOptionId,
      correctOptionId,
    );
    const rightToWrongChanges = this.countRightToWrongTransitions(
      normalizedSequence,
      correctOptionId,
    );

    // Build the response payload before persistence so the shape stays stable.
    const instantResponse = {
      submission: {
        selectedOptionId: selectedOptionId ? Number(selectedOptionId) : null,
        isCorrect: isCorrect,
        correctOptionId: correctOptionId ? Number(correctOptionId) : null,
        isMarked: isMarked ?? false, // Use ?? to preserve false values
        timeSpentSeconds: timeSpentSeconds ?? 0,
        answerChanges: Math.max(0, normalizedSequence.length - 1),
        rightToWrongChanges,
        firstSelectedOptionId,
        answerTransitionPattern,
      },
      testStats: {
        // Optimistic stats (will be corrected in background if needed)
        answeredQuestions: selectedOptionId !== null && selectedOptionId !== undefined 
          ? Number(test.answeredQuestions || 0) + 1 
          : Number(test.answeredQuestions || 0),
        correctAnswers: isCorrect ? Number(test.correctAnswers || 0) + 1 : Number(test.correctAnswers || 0),
        timeSpentSeconds: Number(test.timeSpentSeconds || 0),
        percentageScore: null, // Will be calculated
      },
    };

    const totalQuestions = Number(test.totalQuestions);
    const newCorrect = instantResponse.testStats.correctAnswers;
    instantResponse.testStats.percentageScore = totalQuestions > 0 ? (newCorrect / totalQuestions) * 100 : 0;

    // Fire-and-forget: update daily stats and question streak (does not affect response time).
    // Errors are logged with user/test correlation so silent failures show up in ops dashboards.
    this.updateDailyStatsAndStreak(userId, isCorrect).catch((err) => {
      this.logger.warn(
        `updateDailyStatsAndStreak failed (userId=${userId}, testId=${testId}): ${err?.message || err}`,
      );
    });

    // Transition-mode mirror: marks now live in user_question_marks, but
    // older client builds still pass `isMarked` alongside a regular submit.
    // Echo that into the new table so the dedicated source of truth stays
    // accurate even before all clients adopt PATCH /mark. Fire-and-forget —
    // mark persistence shouldn't gate the answer response.
    if (isMarked !== undefined) {
      this.mirrorMarkFromSubmit(userId, questionId, !!isMarked).catch(() => {});
    }

    await this.saveSubmissionInBackground(
      userId,
      testId,
      questionId,
      selectedOptionId,
      isCorrect,
      correctOptionId,
      timeSpentSeconds,
      normalizedSequence,
      normalizedSelectionHistory,
      firstSelectedOptionId,
      answerTransitionPattern,
      rightToWrongChanges,
      highlights,
      isMarked,
      notes,
      test
    );

    return instantResponse;
  }

  /**
   * Update highlights for a question.
   * Highlights are stored in user_question_highlights — completely isolated from
   * question_submissions. No draft rows are created here; this means the answer/
   * grading/status flow is never affected by highlight activity alone.
   * Works for unanswered, answered, and completed-test review questions.
   */
  async updateHighlights(
    id: any,
    userId: number,
    dto: UpdateHighlightsDto,
  ): Promise<{ ok: boolean }> {
    const testId = this.parseAndValidateId(id);
    const { questionId, highlights } = dto;
    // NOTE: dto.questionHtml / dto.explanationHtml are deprecated and
    // intentionally ignored. The frontend rebuilds highlighted HTML from
    // the `highlights` descriptors on read, so we no longer persist
    // question_html_cache / explanation_html_cache. The DTO fields remain
    // for backward compatibility with older clients; the entity columns
    // remain for backward compatibility with existing rows.

    const test = await this.testRepository.findOne({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');
    if (test.userId !== userId) throw new ForbiddenException('Access denied');
    // Allow highlights on active AND completed tests (review-mode annotations).
    const editableStatuses: TestStatus[] = [
      TestStatus.IN_PROGRESS,
      TestStatus.SUSPENDED,
      TestStatus.COMPLETED,
    ];
    if (!editableStatuses.includes(test.status)) {
      throw new BadRequestException('Test is not editable');
    }

    // Atomic upsert — avoids the TOCTOU race where two concurrent PATCHes
    // both see findOne()=null and both INSERT, crashing on IDX_uqh_user_test_question.
    // TypeORM's repository.upsert() auto-appends `"updated_at" = DEFAULT`
    // to the DO UPDATE SET clause for @UpdateDateColumn on Postgres, which
    // resolves to now() via the column's DEFAULT — matching the previous
    // `"updated_at" = NOW()` behavior. Conflict paths are entity property
    // names; TypeORM maps them to the underlying "user_id"/"test_id"/
    // "question_id" columns for the ON CONFLICT (...) target.
    await this.highlightRepository.upsert(
      { userId, testId, questionId, highlights },
      ['userId', 'testId', 'questionId'],
    );

    return { ok: true };
  }

  /**
   * Toggle the "marked for review" flag on a question for the current user.
   *
   * Stored in the dedicated user_question_marks table — independent of
   * QuestionSubmission. Marking an unanswered question therefore does NOT
   * create a fake omitted-submission row, so the omitted/unanswered counts
   * stay accurate.
   *
   * Both branches are PK-keyed single-row operations:
   *   - mark   → INSERT … ON CONFLICT DO NOTHING
   *   - unmark → DELETE
   */
  async toggleMark(
    id: any,
    userId: number,
    dto: ToggleMarkDto,
  ): Promise<{ ok: boolean; isMarked: boolean }> {
    const testId = this.parseAndValidateId(id);
    const { questionId, isMarked } = dto;

    // Authorisation: user must own the test, and the test must be in an
    // editable state. The TestAccessGuard on the route already enforces
    // ownership, but we double-check here for defence in depth.
    const test = await this.testRepository.findOne({
      where: { id: testId },
      select: ['id', 'userId', 'status'],
    });
    if (!test) throw new NotFoundException('Test not found');
    if (test.userId !== userId) throw new ForbiddenException('Access denied');

    const editableStatuses: TestStatus[] = [
      TestStatus.IN_PROGRESS,
      TestStatus.SUSPENDED,
      TestStatus.COMPLETED, // allow flagging during review
    ];
    if (!editableStatuses.includes(test.status)) {
      throw new BadRequestException('Test is not editable');
    }

    await this.writeMarkRow(userId, questionId, isMarked);

    // Fix #1: marked count comes from user_question_marks — invalidate so the
    // "Marked" filter bucket reflects the new state. Step is unknown without
    // an extra read, so we invalidate every step variant (cheap: 5 Redis dels).
    await this.invalidateFilterCountsCache(userId);

    return { ok: true, isMarked };
  }

  /**
   * Internal helper: mirror a mark flip into user_question_marks when an old
   * client still sends `isMarked` as part of submitAnswer. Idempotent — uses
   * the same PK upsert/delete primitives as toggleMark.
   */
  private async mirrorMarkFromSubmit(
    userId: number,
    questionId: number,
    isMarked: boolean,
  ): Promise<void> {
    await this.writeMarkRow(userId, questionId, isMarked);
  }

  /**
   * Single-row mark/unmark primitive.
   *
   * Implemented as a raw SQL query rather than via the QueryBuilder.into()
   * path because TypeORM's QueryBuilder breaks for composite-PK entities
   * ("Class constructor X cannot be invoked without 'new'"). Raw SQL is
   * also the fastest path: one parameterised statement, PK-keyed, no
   * entity hydration or metadata lookup.
   */
  private async writeMarkRow(
    userId: number,
    questionId: number,
    isMarked: boolean,
  ): Promise<void> {
    if (isMarked) {
      await this.markRepository.query(
        `INSERT INTO user_question_marks (user_id, question_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, questionId],
      );
    } else {
      await this.markRepository.query(
        `DELETE FROM user_question_marks WHERE user_id = $1 AND question_id = $2`,
        [userId, questionId],
      );
    }
  }

  // Persist a submission and keep test counters/cache in sync before returning.
  private async saveSubmissionInBackground(
    userId: number,
    testId: number,
    questionId: number,
    selectedOptionId: number,
    isCorrect: boolean,
    correctOptionId: number | null,
    timeSpentSeconds: number,
    normalizedSequence: number[],
    normalizedSelectionHistory: { optionId: number; timestampMs: number }[],
    firstSelectedOptionId: number | null,
    answerTransitionPattern: AnswerTransitionPattern,
    rightToWrongChanges: number,
    highlights: any[],
    isMarked: boolean,
    notes: string | null,
    test: any
  ): Promise<void> {
    const queryRunner = this.submissionRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let submission = await queryRunner.manager.findOne(QuestionSubmission, {
        where: { userId, testId, questionId },
      });
      let isFirstSubmission = false;

      if (!submission) {
        const sessionId = uuidv4();

        const insertResult = await queryRunner.manager
          .createQueryBuilder()
          .insert()
          .into(QuestionSubmission)
          .values({
            userId,
            questionId,
            testId,
            sessionId,
            selectedOptionId,
            firstSelectedOptionId,
            isCorrect,
            timeSpentSeconds: timeSpentSeconds ?? 0,
            answerChanges: Math.max(0, normalizedSequence.length - 1),
            answerSequence: normalizedSequence || [],
            selectionHistory: normalizedSelectionHistory || [],
            answerTransitionPattern,
            highlights: highlights || [],
            isMarked: isMarked ?? false,
            notes: notes || null,
            submittedAt: new Date(),
            rightToWrongChanges,
          })
          .orIgnore()
          .execute();

        if (insertResult.identifiers.length > 0) {
          isFirstSubmission = true;
          const hasSelectedAnswer = selectedOptionId !== null && selectedOptionId !== undefined;
          if (hasSelectedAnswer) {
            test.answeredQuestions = (Number(test.answeredQuestions) || 0) + 1;
          }
          if (isCorrect) {
            test.correctAnswers = (Number(test.correctAnswers) || 0) + 1;
          }
        } else {
          submission = await queryRunner.manager.findOne(QuestionSubmission, {
            where: { userId, testId, questionId },
          });
        }
      }

      if (!isFirstSubmission && submission) {
        const wasCorrect = submission.isCorrect;
        const wasOmitted = submission.selectedOptionId === null || submission.selectedOptionId === undefined;
        const isAnsweredNow = selectedOptionId !== null && selectedOptionId !== undefined;
        
        if (wasOmitted && isAnsweredNow) {
          test.answeredQuestions = (Number(test.answeredQuestions) || 0) + 1;
        } else if (!wasOmitted && !isAnsweredNow) {
          test.answeredQuestions = Math.max(0, (Number(test.answeredQuestions) || 0) - 1);
        }

        if (selectedOptionId !== undefined) submission.selectedOptionId = selectedOptionId;
        if (timeSpentSeconds !== undefined && timeSpentSeconds !== null && Number(timeSpentSeconds) > 0) {
          submission.timeSpentSeconds = (Number(submission.timeSpentSeconds) || 0) + Number(timeSpentSeconds);
        }
        if (normalizedSequence && normalizedSequence.length > 0) {
          submission.answerSequence = normalizedSequence;
          submission.answerChanges = Math.max(0, normalizedSequence.length - 1);
        }
        if (normalizedSelectionHistory && normalizedSelectionHistory.length > 0) {
          submission.selectionHistory = normalizedSelectionHistory;
        }
        if (firstSelectedOptionId != null && submission.firstSelectedOptionId == null) {
          submission.firstSelectedOptionId = firstSelectedOptionId;
        }
        submission.answerTransitionPattern = this.classifyAnswerTransition(
          submission.firstSelectedOptionId ?? firstSelectedOptionId,
          submission.selectedOptionId,
          correctOptionId,
        );
        submission.rightToWrongChanges = this.countRightToWrongTransitions(
          submission.answerSequence || [],
          correctOptionId,
        );
        if (highlights !== undefined && highlights !== null) {
          submission.highlights = highlights;
        }
        if (isMarked !== undefined) submission.isMarked = isMarked;
        if (notes !== undefined) submission.notes = notes;
        submission.submittedAt = new Date();

        if (wasCorrect !== isCorrect) {
          if (isCorrect) {
            test.correctAnswers = (Number(test.correctAnswers) || 0) + 1;
          } else if (wasCorrect === true) {
            test.correctAnswers = Math.max(0, (Number(test.correctAnswers) || 0) - 1);
          }
        }
        submission.isCorrect = isCorrect;

        await queryRunner.manager.save(submission);
      }

      test.percentageScore =
        test.totalQuestions > 0
          ? (Number(test.correctAnswers) / Number(test.totalQuestions)) * 100
          : 0;

      // For tutor/untimed AND Mixed v=2: accumulate active reading time per
      // submit. test.timeSpentSeconds is the authoritative sum of real study
      // time and (for v=2) the canonical "elapsed" the expiry check reads.
      // Timed v=1 skips this — wall-clock from startedAt is its source of truth.
      const accumulateActiveTime =
        !test.timeLimitSeconds || Number(test.timeAccountingVersion) === 2;
      if (accumulateActiveTime) {
        const additionalTime = Number(timeSpentSeconds || 0);
        if (additionalTime > 0) {
          test.timeSpentSeconds = (Number(test.timeSpentSeconds) || 0) + additionalTime;
        }
      }

      await queryRunner.manager.save(test);
      await queryRunner.commitTransaction();

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Timed-mode End-Block bulk submit.
   *
   * Persists every answer in `dto.answers` and flips the test to COMPLETED in
   * ONE transaction with a pessimistic lock on the test row. The lock
   * serialises this call against any concurrent `/submit` (or a double-clicked
   * End Block) so counters and status transitions can't interleave.
   *
   * Items with `selectedOptionId == null` (omitted) are still written as
   * submission rows so `evaluateTestState`'s omitted-bucket math picks them
   * up. Items whose `selectedOptionId` does not belong to the question's
   * option set are dropped (logged + reported in `droppedItemIds`).
   *
   * Highlights / isMarked / notes are deliberately NOT in the payload — they
   * have their own live endpoints (PATCH /:id/highlights, /:id/mark). The
   * batch only owns answer-state.
   *
   * Idempotent: a second call to a COMPLETED test returns
   * `{ alreadyCompleted: true, ... }` with no extra writes. Only Timed-type
   * tests are accepted (Tutor / Mixed reject at the service layer).
   */
  async submitAnswersBatch(id: any, userId: number, dto: SubmitAnswersBatchDto): Promise<any> {
    const testId = this.parseAndValidateId(id);

    if (dto.complete !== true) {
      throw new BadRequestException('Bulk submit currently requires complete=true');
    }
    if (!Array.isArray(dto.answers) || dto.answers.length === 0) {
      throw new BadRequestException('At least one answer is required');
    }

    const queryRunner = this.submissionRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let committedTest: Test | null = null;
    const droppedItemIds: number[] = [];

    try {
      // Pessimistic write-lock on the test row. Serialises against /submit,
      // /suspend, /resume, /complete, and a second /submit-batch from a
      // double-clicked End Block.
      const lockedTest = await queryRunner.manager
        .createQueryBuilder(Test, 't')
        .setLock('pessimistic_write')
        .where('t.id = :testId', { testId })
        .getOne();

      if (!lockedTest) throw new NotFoundException('No results found for this id');
      if (lockedTest.userId !== userId) {
        throw new ForbiddenException('You do not have access to this test');
      }
      if (lockedTest.type !== TestType.TIMED) {
        throw new BadRequestException('Bulk submit only supported in timed mode');
      }

      // Idempotent reply on a test that's already COMPLETED.
      if (lockedTest.status === TestStatus.COMPLETED) {
        await queryRunner.commitTransaction();
        return {
          status: lockedTest.status,
          completedAt: lockedTest.completedAt,
          answeredQuestions: Number(lockedTest.answeredQuestions || 0),
          correctAnswers: Number(lockedTest.correctAnswers || 0),
          omittedQuestions: Number(lockedTest.omittedQuestions || 0),
          percentageScore: lockedTest.percentageScore ? Number(lockedTest.percentageScore) : 0,
          timeSpentSeconds: Number(lockedTest.timeSpentSeconds || 0),
          alreadyCompleted: true,
        };
      }
      if (lockedTest.status === TestStatus.SUSPENDED) {
        throw new BadRequestException('Resume the test before ending it.');
      }
      if (lockedTest.status !== TestStatus.IN_PROGRESS) {
        throw new BadRequestException('Test is not in progress');
      }

      // Bulk prefetch question+options for every questionId in the batch.
      // One DB round-trip instead of N. Used for both correct-option lookup
      // and "does this selectedOptionId belong to this question?" validation.
      const questionIds = Array.from(new Set(dto.answers.map((a) => Number(a.questionId))));
      // dto.answers.length === 0 was already rejected at the top of this
      // method (see ~line 613); questionIds will always be non-empty here.
      const questions = await queryRunner.manager
        .createQueryBuilder(Question, 'q')
        .innerJoin(TestQuestion, 'tq', 'tq.questionId = q.id AND tq.testId = :testId', { testId })
        .leftJoinAndSelect('q.options', 'opt')
        .where('q.id IN (:...ids)', { ids: questionIds })
        .select(['q.id', 'opt.id', 'opt.isCorrect'])
        .getMany();
      const questionMap = new Map<number, { correctOptionId: number | null; optionIds: Set<number> }>();
      for (const q of questions) {
        const correct = q.options?.find((o) => o.isCorrect);
        questionMap.set(Number(q.id), {
          correctOptionId: correct ? Number(correct.id) : null,
          optionIds: new Set((q.options || []).map((o) => Number(o.id))),
        });
      }

      // Bulk prefetch existing submissions to decide INSERT vs UPDATE per item.
      const existingSubs = await queryRunner.manager.find(QuestionSubmission, {
        where: { userId, testId, questionId: In(questionIds) },
      });
      const existingMap = new Map<number, QuestionSubmission>(
        existingSubs.map((s) => [Number(s.questionId), s]),
      );

      // Counters accumulated locally; applied to the test row in one write.
      let answeredDelta = 0;
      let correctDelta = 0;

      const toInsert: any[] = [];
      const toSave: QuestionSubmission[] = [];
      const processed = new Set<number>();

      for (const item of dto.answers) {
        const qInfo = questionMap.get(Number(item.questionId));
        if (!qInfo) {
          // Question doesn't exist or isn't visible — skip.
          droppedItemIds.push(Number(item.questionId));
          this.logger.warn(
            `[submitAnswersBatch] dropped item: unknown question ${item.questionId} (testId=${testId}, userId=${userId})`,
          );
          continue;
        }

        // Guard against duplicate questionId in dto.answers — second iteration
        // would re-increment answeredDelta/correctDelta even though the bulk
        // INSERT's orIgnore silently swallows the duplicate row.
        if (processed.has(Number(item.questionId))) {
          droppedItemIds.push(Number(item.questionId));
          this.logger.warn(
            `[submitAnswersBatch] dropped item: duplicate question ${item.questionId} (testId=${testId}, userId=${userId})`,
          );
          continue;
        }
        processed.add(Number(item.questionId));

        const hasPick = item.selectedOptionId !== null && item.selectedOptionId !== undefined;
        if (hasPick && !qInfo.optionIds.has(Number(item.selectedOptionId))) {
          // Pick points to an option that doesn't belong to this question.
          // Per product decision: skip the item silently (logged).
          droppedItemIds.push(Number(item.questionId));
          this.logger.warn(
            `[submitAnswersBatch] dropped item: option ${item.selectedOptionId} ` +
              `not in question ${item.questionId} (testId=${testId}, userId=${userId})`,
          );
          continue;
        }

        const selectedOptionId = hasPick ? Number(item.selectedOptionId) : null;
        const correctOptionId = qInfo.correctOptionId;
        const isCorrect = selectedOptionId !== null && selectedOptionId === correctOptionId;
        const normalizedInput = this.normalizeAnswerInput(
          item.selectionHistory,
          item.answerSequence,
        );
        const normalizedSequence = normalizedInput.answerSequence;
        const normalizedSelectionHistory = normalizedInput.selectionHistory;
        const firstSelectedOptionId =
          normalizedSequence.length > 0 ? Number(normalizedSequence[0]) : null;
        const answerTransitionPattern = this.classifyAnswerTransition(
          firstSelectedOptionId,
          selectedOptionId,
          correctOptionId,
        );
        const rightToWrongChanges = this.countRightToWrongTransitions(
          normalizedSequence,
          correctOptionId,
        );
        const safeDelta =
          Number.isFinite(Number(item.timeSpentSeconds)) && Number(item.timeSpentSeconds) > 0
            ? Number(item.timeSpentSeconds)
            : 0;

        const existing = existingMap.get(Number(item.questionId));

        if (!existing) {
          // INSERT path. Counter deltas applied here; evaluateTestState will
          // recompute from canonical rows post-commit, so any drift converges.
          toInsert.push({
            userId,
            questionId: Number(item.questionId),
            testId,
            sessionId: uuidv4(),
            selectedOptionId,
            firstSelectedOptionId,
            isCorrect,
            timeSpentSeconds: safeDelta,
            answerChanges: Math.max(0, normalizedSequence.length - 1),
            answerSequence: normalizedSequence || [],
            selectionHistory: normalizedSelectionHistory || [],
            answerTransitionPattern,
            highlights: [],
            isMarked: false,
            notes: null,
            submittedAt: new Date(),
            rightToWrongChanges,
          });
          if (hasPick) answeredDelta += 1;
          if (isCorrect) correctDelta += 1;
        } else {
          // UPDATE path — mirrors saveSubmissionInBackground's update branch
          // but excludes highlights / isMarked / notes (owned by separate
          // endpoints).
          const wasCorrect = !!existing.isCorrect;
          const wasOmitted =
            existing.selectedOptionId === null || existing.selectedOptionId === undefined;

          if (wasOmitted && hasPick) answeredDelta += 1;
          else if (!wasOmitted && !hasPick) answeredDelta -= 1;

          existing.selectedOptionId = selectedOptionId;
          if (safeDelta > 0) {
            existing.timeSpentSeconds = (Number(existing.timeSpentSeconds) || 0) + safeDelta;
          }
          if (normalizedSequence.length > 0) {
            existing.answerSequence = normalizedSequence;
            existing.answerChanges = Math.max(0, normalizedSequence.length - 1);
          }
          if (normalizedSelectionHistory.length > 0) {
            existing.selectionHistory = normalizedSelectionHistory;
          }
          if (firstSelectedOptionId != null && existing.firstSelectedOptionId == null) {
            existing.firstSelectedOptionId = firstSelectedOptionId;
          }
          existing.answerTransitionPattern = this.classifyAnswerTransition(
            existing.firstSelectedOptionId ?? firstSelectedOptionId,
            existing.selectedOptionId,
            correctOptionId,
          );
          existing.rightToWrongChanges = this.countRightToWrongTransitions(
            existing.answerSequence || [],
            correctOptionId,
          );
          if (wasCorrect !== isCorrect) {
            if (isCorrect) correctDelta += 1;
            else if (wasCorrect) correctDelta -= 1;
          }
          existing.isCorrect = isCorrect;
          existing.submittedAt = new Date();
          toSave.push(existing);
        }
      }

      // Bulk INSERT (orIgnore guards against concurrent /submit racing in
      // before we acquired the lock — orIgnore makes that a no-op).
      if (toInsert.length > 0) {
        await queryRunner.manager
          .createQueryBuilder()
          .insert()
          .into(QuestionSubmission)
          .values(toInsert)
          .orIgnore()
          .execute();
      }
      if (toSave.length > 0) {
        await queryRunner.manager.save(QuestionSubmission, toSave);
      }

      // Apply counter deltas to the locked test row. evaluateTestState will
      // recompute from canonical rows post-commit so this is essentially a
      // best-effort optimistic write.
      lockedTest.answeredQuestions = Math.max(
        0,
        (Number(lockedTest.answeredQuestions) || 0) + answeredDelta,
      );
      lockedTest.correctAnswers = Math.max(
        0,
        (Number(lockedTest.correctAnswers) || 0) + correctDelta,
      );
      lockedTest.percentageScore =
        lockedTest.totalQuestions > 0
          ? (Number(lockedTest.correctAnswers) / Number(lockedTest.totalQuestions)) * 100
          : 0;

      // Time accounting: for v=1 Timed take min(limit, max(currentElapsed,
      // dto.totalTimeSpentSeconds)). Mirrors the existing completeTest path.
      this.checkpointElapsedTime(lockedTest);
      const limit = Number(lockedTest.timeLimitSeconds || 0);
      const currentElapsed = this.getElapsedTimeSeconds(lockedTest);
      const incomingTime = Number.isFinite(Number(dto.totalTimeSpentSeconds))
        ? Number(dto.totalTimeSpentSeconds)
        : 0;
      lockedTest.timeSpentSeconds = limit
        ? Math.min(limit, Math.max(currentElapsed, incomingTime))
        : Math.max(currentElapsed, incomingTime);

      lockedTest.status = TestStatus.COMPLETED;
      lockedTest.completedAt = new Date();
      committedTest = await queryRunner.manager.save(lockedTest);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    // Post-commit: canonical recompute + analytics. Same path completeTest
    // uses, so analytics + counter parity matches. The test row is already
    // COMPLETED — if these throw we still return success (using committedTest)
    // so the frontend doesn't see "Failed to complete" on a finished test.
    try {
      const evaluated = await this.evaluateTestState(testId, userId, committedTest!);
      await this.invalidateFilterCountsCache(userId, evaluated.step);

      return {
        status: evaluated.status,
        completedAt: evaluated.completedAt,
        answeredQuestions: Number(evaluated.answeredQuestions || 0),
        correctAnswers: Number(evaluated.correctAnswers || 0),
        omittedQuestions: Number(evaluated.omittedQuestions || 0),
        percentageScore: evaluated.percentageScore ? Number(evaluated.percentageScore) : 0,
        timeSpentSeconds: Number(evaluated.timeSpentSeconds || 0),
        droppedItemIds: droppedItemIds.length > 0 ? droppedItemIds : undefined,
      };
    } catch (postCommitErr) {
      this.logger.error(
        `[submitAnswersBatch] post-commit recompute failed (testId=${testId}, userId=${userId}); returning committed snapshot`,
        postCommitErr instanceof Error ? postCommitErr.stack : String(postCommitErr),
      );
      return {
        status: committedTest!.status,
        completedAt: committedTest!.completedAt,
        answeredQuestions: Number(committedTest!.answeredQuestions || 0),
        correctAnswers: Number(committedTest!.correctAnswers || 0),
        omittedQuestions: Number(committedTest!.omittedQuestions || 0),
        percentageScore: committedTest!.percentageScore ? Number(committedTest!.percentageScore) : 0,
        timeSpentSeconds: Number(committedTest!.timeSpentSeconds || 0),
        droppedItemIds: droppedItemIds.length > 0 ? droppedItemIds : undefined,
      };
    }
  }

  private async updateDailyStatsAndStreak(userId: number, isCorrect: boolean): Promise<void> {
    // Wrap the whole body so an internal exception can't surface as an
    // unhandled promise rejection — this is called fire-and-forget from
    // submitAnswer, and we never want to crash the worker over stats.
    try {
      const todayUTC = new Date().toISOString().slice(0, 10);

      // Upsert daily stats for today
      await this.dailyStatsRepository
        .createQueryBuilder()
        .insert()
        .into(UserDailyStats)
        .values({
          userId,
          date: todayUTC,
          questionsAttempted: 1,
          correctCount: isCorrect ? 1 : 0,
        })
        .orUpdate(
          ['questions_attempted', 'correct_count', 'updated_at'],
          ['user_id', 'date'],
          {
            skipUpdateIfNoValuesChanged: false,
            upsertType: 'on-conflict-do-update',
          },
        )
        .execute()
        .catch(() => {
          // Fallback: raw SQL upsert
          return this.dailyStatsRepository.manager.query(
            `INSERT INTO user_daily_stats (user_id, date, questions_attempted, correct_count, created_at, updated_at)
             VALUES ($1, $2, 1, $3, now(), now())
             ON CONFLICT (user_id, date)
             DO UPDATE SET
               questions_attempted = user_daily_stats.questions_attempted + 1,
               correct_count = user_daily_stats.correct_count + $3,
               updated_at = now()`,
            [userId, todayUTC, isCorrect ? 1 : 0],
          );
        });

      // Update question streak on user
      const user = await this.userRepository.findOne({ where: { id: userId }, select: ['id', 'questionStreak', 'longestQuestionStreak', 'lastQuestionDate'] });
      if (!user) return;

      const lastDate = user.lastQuestionDate;
      if (lastDate === todayUTC) return; // already counted today

      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayUTC = yesterday.toISOString().slice(0, 10);

      if (lastDate === yesterdayUTC) {
        user.questionStreak = (user.questionStreak || 0) + 1;
      } else {
        user.questionStreak = 1;
      }

      if (user.questionStreak > (user.longestQuestionStreak || 0)) {
        user.longestQuestionStreak = user.questionStreak;
      }
      user.lastQuestionDate = todayUTC;

      await this.userRepository.save(user);
    } catch (err) {
      this.logger.warn(
        `updateDailyStatsAndStreak internal error (userId=${userId}): ${(err as Error)?.message || err}`,
      );
    }
  }

  async getQuestionExplanation(id: any, questionId: string, userId: number): Promise<any> {
    const testId = this.parseAndValidateId(id);
    const qId = parseInt(questionId, 10);
    
    if (isNaN(qId)) {
      throw new NotFoundException('Invalid question ID');
    }

    // 1. Verify user has access to this test
    const test = await this.testRepository.findOne({ where: { id: testId, userId } });
    if (!test) throw new NotFoundException('Test not found');

    if (test.isBlock && test.blockBankId) {
      const progress = await this.getBlockBankProgress(userId, test.blockBankId);
      if (progress.bank?.isBlockBank && !progress.unlocked) {
        throw this.buildBlockLockedError({
          bankId: progress.bank.id,
          completedBlocks: progress.completedBlocks,
          totalBlocks: progress.totalBlocks,
          step: progress.bank.step,
        });
      }
    }

    // 2. RELAXED: Allow explanation fetch for tutor mode (race condition tolerance)
    // Only block if test is not in progress (completed/abandoned)
    if (
      test.status !== TestStatus.IN_PROGRESS &&
      test.status !== TestStatus.SUSPENDED &&
      test.status !== TestStatus.COMPLETED
    ) {
      throw new ForbiddenException('Test is not accessible');
    }

    // 3. Fix #5: explanation payload is static per question. Authorization
    //    has already passed above — we only cache the formatted response, not
    //    the access decision. Tutor-mode auto-fetch was driving 21k+ DB hits
    //    in the last billing period for explanations that never change unless
    //    an admin edits the question.
    //
    // NOTE: `updatedAt` is typed as `string` (not `Date`) — Redis round-trips
    // values through JSON, so any Date instance comes back as its ISO string.
    // The controller passes the response straight through to the client, and
    // the frontend wraps it in `new Date(...)`, which accepts either form.
    //
    // The controller also watermarks `explanationHtml` per-user AFTER this
    // cache lookup. That's safe because cache-manager's GET returns a freshly
    // deserialized object on every call (no shared reference between requests),
    // so the per-request mutation in the controller never leaks across users.
    const cacheKey = questionExplanationCacheKey(qId);
    const cached = await safeCacheGet<{
      explanationHtml: string;
      updatedAt: string;
      options: Array<{
        id: number;
        isCorrect: boolean;
        explanationHtml: string | null;
        uworldChosenBy: number | null;
      }>;
    }>(this.cacheManager, cacheKey);
    if (cached) {
      // Defensive deep clone: the controller mutates this response to inject
      // a per-user watermark. In production (Redis) every GET round-trips
      // through JSON so the returned object is already fresh, but the dev
      // in-memory fallback can share references — without this clone, one
      // user's watermark would overwrite the cached payload and leak into
      // the next user's response.
      return JSON.parse(JSON.stringify(cached));
    }

    const question = await this.questionRepository
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.options', 'opt')
      .where('q.id = :qId', { qId })
      .select([
        'q.id',
        'q.explanationHtml',
        'q.updatedAt',
        'opt.id',
        'opt.isCorrect',
        'opt.explanationHtml',
        'opt.uworldChosenBy'
      ])
      .getOne();

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    // 4. Return explanation data
    const sortedOptions = [...(question.options || [])].sort((a: any, b: any) =>
      String(a.displayOrder || '').localeCompare(String(b.displayOrder || '')),
    );

    const payload = {
      explanationHtml: question.explanationHtml,
      updatedAt: question.updatedAt,
      options: sortedOptions.map(o => ({
        id: Number(o.id),
        isCorrect: o.isCorrect,
        explanationHtml: o.explanationHtml,
        uworldChosenBy: o.uworldChosenBy,
      })),
    };

    await safeCacheSet(this.cacheManager, cacheKey, payload, QUESTION_EXPLANATION_TTL_MS);

    return payload;
  }

  private buildBlockLockedError(details: {
    bankId: number;
    completedBlocks: number;
    totalBlocks: number;
    step?: number;
  }) {
    return new HttpException(
      {
        message: 'Results are locked until all blocks are completed.',
        code: 'BLOCK_RESULTS_LOCKED',
        details,
      },
      423,
    );
  }

  private async getBlockBankProgress(userId: number, bankId: number) {
    const bank = await this.questionBankRepository.findOne({
      where: { id: bankId, isActive: true },
      select: ['id', 'totalQuestions', 'isBlockBank', 'blockSize', 'step'],
    });

    if (!bank || !bank.isBlockBank) {
      return { bank, totalBlocks: 0, completedBlocks: 0, unlocked: true };
    }

    const effectiveBlockSize = bank.blockSize || this.defaultBlockSize;
    const totalBlocks = Math.ceil((bank.totalQuestions || 0) / effectiveBlockSize);
    if (totalBlocks <= 0) {
      return { bank, totalBlocks, completedBlocks: 0, unlocked: true };
    }

    const completedBlocks = await this.testRepository.count({
      where: {
        userId,
        isBlock: true,
        blockBankId: bankId,
        status: TestStatus.COMPLETED,
      },
    });

    return {
      bank,
      totalBlocks,
      completedBlocks,
      unlocked: completedBlocks >= totalBlocks,
    };
  }

  async submitFeedback(userId: number, feedbackDto: QuestionFeedbackDto): Promise<QuestionFeedback> {
    const feedback = this.feedbackRepository.create({
      userId,
      questionId: feedbackDto.questionId,
      type: feedbackDto.type as FeedbackType,
      comment: feedbackDto.comment,
    });
    return this.feedbackRepository.save(feedback);
  }

  async suspendTest(id: any, userId: number): Promise<Test> {
    const testId = this.parseAndValidateId(id);

    // Pessimistic write-lock on the test row — must match the lock used by
    // /submit-batch. Without it, a queued suspend can fire between the batch's
    // status flip and the lock release, clobbering COMPLETED back to SUSPENDED.
    const queryRunner = this.submissionRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let saveTest: Test;
    try {
      const test = await queryRunner.manager
        .createQueryBuilder(Test, 't')
        .setLock('pessimistic_write')
        .where('t.id = :testId', { testId })
        .getOne();
      if (!test) throw new NotFoundException('No results found for this id');
      if (test.userId !== userId) throw new ForbiddenException('You do not have access to this test');

      if (test.status === TestStatus.COMPLETED || test.status === TestStatus.ABANDONED) {
        throw new BadRequestException('Only active tests can be suspended');
      }

      if (test.status === TestStatus.SUSPENDED) {
        await queryRunner.commitTransaction();
        return test;
      }

      // v=2 Mixed: active-time accumulator is the source of truth. Skip every
      // wall-clock path — getElapsedTimeSeconds would add (now - startedAt)
      // which has no meaning for active-time semantics and would falsely
      // expire a test that still has active time left.
      const isV2Mixed = Number(test.timeAccountingVersion) === 2;
      const elapsedTimeSeconds = isV2Mixed
        ? Number(test.timeSpentSeconds || 0)
        : this.getElapsedTimeSeconds(test);

      if (
        (test.type === TestType.TIMED || test.type === TestType.MIXED) &&
        test.timeLimitSeconds &&
        elapsedTimeSeconds >= Number(test.timeLimitSeconds)
      ) {
        // Release the lock before delegating to completeTest, which acquires
        // its own connection.
        await queryRunner.commitTransaction();
        await queryRunner.release();
        await this.completeTest(testId, userId, { totalTimeSpentSeconds: Number(test.timeLimitSeconds) });
        throw new BadRequestException('Test time limit has expired. Test has been automatically submitted.');
      }

      // For timed/mixed v=1: snapshot wall-clock elapsed so the countdown is accurate on resume.
      // For v=2 Mixed: do NOT overwrite — timeSpentSeconds already IS the active-time accumulator.
      // For tutor/untimed: do NOT overwrite — timeSpentSeconds is the accumulated per-question reading time.
      if (test.timeLimitSeconds && !isV2Mixed) {
        test.timeSpentSeconds = Math.max(0, Number(elapsedTimeSeconds));
      }
      test.status = TestStatus.SUSPENDED;
      saveTest = await queryRunner.manager.save(test);

      await queryRunner.commitTransaction();
    } catch (err) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw err;
    } finally {
      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
    }

    // Fix #1: suspending changes the "suspended" filter bucket counts.
    await this.invalidateFilterCountsCache(userId, saveTest.step);

    return this.evaluateTestState(testId, userId, saveTest);
  }

  async resumeTest(id: any, userId: number): Promise<Test> {
    const testId = this.parseAndValidateId(id);

    // Pessimistic write-lock on the test row — symmetric with /submit-batch
    // and /suspend so a queued resume cannot flip a just-completed test back
    // to IN_PROGRESS after the batch lock releases.
    const queryRunner = this.submissionRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let saved: Test;
    let stepForCache: number | null | undefined;
    try {
      const test = await queryRunner.manager
        .createQueryBuilder(Test, 't')
        .setLock('pessimistic_write')
        .where('t.id = :testId', { testId })
        .getOne();
      if (!test) throw new NotFoundException('No results found for this id');
      if (test.userId !== userId) throw new ForbiddenException('You do not have access to this test');

      if (test.status === TestStatus.COMPLETED || test.status === TestStatus.ABANDONED) {
        throw new BadRequestException('Completed or abandoned tests cannot be resumed');
      }

      if (test.isBlock && test.blockBankId && test.blockNumber && test.blockNumber > 1) {
        const incompletePrevious = await queryRunner.manager.findOne(Test, {
          where: {
            userId,
            isBlock: true,
            blockBankId: test.blockBankId,
            blockNumber: LessThan(test.blockNumber),
            status: Not(TestStatus.COMPLETED),
          },
        });
        if (incompletePrevious) {
          throw new BadRequestException('Complete previous blocks before starting this one.');
        }
      }

      const isV2Mixed = Number(test.timeAccountingVersion) === 2;

      if (test.status === TestStatus.IN_PROGRESS) {
        if (
          (test.type === TestType.TIMED || test.type === TestType.MIXED) &&
          test.timeLimitSeconds &&
          !isV2Mixed
        ) {
          // v=1 Timed/Mixed: snapshot wall-clock elapsed so countdown remains accurate.
          this.checkpointElapsedTime(test);

          if (Number(test.timeSpentSeconds) >= Number(test.timeLimitSeconds)) {
            await queryRunner.commitTransaction();
            await queryRunner.release();
            await this.completeTest(testId, userId, { totalTimeSpentSeconds: Number(test.timeLimitSeconds) });
            throw new BadRequestException('Test time limit has expired. Test has been automatically submitted.');
          }
        } else if (!isV2Mixed) {
          // Tutor/untimed: ONLY reset startedAt — do NOT checkpoint wall-clock.
          test.startedAt = new Date();
        }
        // v=2 Mixed: no startedAt mutation, no wall-clock snapshot. Active-time
        // accumulator is authoritative; resume is a status no-op for in-progress.
        await queryRunner.manager.save(test);
        await queryRunner.commitTransaction();
        return test;
      }

      // status === SUSPENDED — for v=1 limited tests, auto-complete if already past limit.
      // For v=2: timeSpentSeconds is active-time; same check works correctly.
      if (
        (test.type === TestType.TIMED || test.type === TestType.MIXED) &&
        test.timeLimitSeconds &&
        Number(test.timeSpentSeconds) >= Number(test.timeLimitSeconds)
      ) {
        await queryRunner.commitTransaction();
        await queryRunner.release();
        await this.completeTest(testId, userId, { totalTimeSpentSeconds: Number(test.timeLimitSeconds) });
        throw new BadRequestException('Test time limit has expired. Test has been automatically submitted.');
      }

      test.status = TestStatus.IN_PROGRESS;
      // v=2 must NOT re-anchor startedAt — startedAt is irrelevant for active-time
      // and resetting it leaves the column inconsistent with the test's real start.
      if (!isV2Mixed) {
        test.startedAt = new Date();
      }
      saved = await queryRunner.manager.save(test);
      stepForCache = test.step;

      await queryRunner.commitTransaction();
    } catch (err) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw err;
    } finally {
      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
    }

    // Fix #1: resuming flips the test out of the SUSPENDED bucket, which
    // changes the suspended/unused counts for filters.
    await this.invalidateFilterCountsCache(userId, stepForCache);

    return saved;
  }

  async completeTest(id: any, userId: number, completeTestDto: CompleteTestDto): Promise<Test> {
    const testId = this.parseAndValidateId(id);
    const test = await this.testRepository.findOne({ where: { id: testId, userId } });
    if (!test) throw new NotFoundException('No results found for this id');
    if (test.status !== TestStatus.IN_PROGRESS && test.status !== TestStatus.SUSPENDED) {
      throw new BadRequestException('Test is not active');
    }

    const incomingTime = Number(completeTestDto.totalTimeSpentSeconds);
    const isV2Mixed = Number(test.timeAccountingVersion) === 2;
    let effectiveTimeSpent: number;
    if (isV2Mixed) {
      // v=2 Mixed: server's active-time accumulator is authoritative. Ignore
      // client incomingTime entirely (it would otherwise inflate the recorded
      // study time — frontend sends limit-(remaining) which for active-time
      // tests reflects displayed-clock, not real active seconds). Cap at limit
      // as a defensive ceiling.
      effectiveTimeSpent = test.timeLimitSeconds
        ? Math.min(Number(test.timeLimitSeconds), Number(test.timeSpentSeconds || 0))
        : Number(test.timeSpentSeconds || 0);
    } else if (test.timeLimitSeconds) {
      // v=1 Timed: use wall-clock elapsed to ensure the countdown was respected.
      const currentElapsed = test.status === TestStatus.IN_PROGRESS
        ? this.getElapsedTimeSeconds(test)
        : Number(test.timeSpentSeconds || 0);
      effectiveTimeSpent = Math.min(Number(test.timeLimitSeconds), Math.max(currentElapsed, incomingTime));
    } else {
      // Tutor/untimed: use the accumulated per-question reading time from the DB.
      // The frontend's incomingTime is the displayed timer value; take the max of both
      // so neither cross-device sync (DB) nor in-session progress (frontend) is lost.
      const dbAccumulated = Number(test.timeSpentSeconds || 0);
      effectiveTimeSpent = Math.max(dbAccumulated, incomingTime);
    }
    test.status = TestStatus.COMPLETED;
    test.timeSpentSeconds = effectiveTimeSpent;
    test.completedAt = new Date();
    const updatedTest = await this.testRepository.save(test);

    // Fix #1: completion finalizes the omitted set and removes the test from
    // the suspended/in-progress buckets — invalidate all filter counts.
    await this.invalidateFilterCountsCache(userId, test.step);

    return this.evaluateTestState(testId, userId, updatedTest);
  }

  private async evaluateTestState(testId: number, userId: number, test: Test): Promise<Test> {
    // Perform batch scoring and omitted-question analysis
    const [submissions, testMappings] = await Promise.all([
      this.submissionRepository.find({
        where: { testId, userId },
        relations: ['question', 'question.options'],
      }),
      this.testQuestionRepository.find({
        where: { testId },
        select: ['questionId'],
      }),
    ]);

    let correctCount = 0;
    let rtwTotal = 0;
    const testQuestionIds = new Set(testMappings.map((mapping) => Number(mapping.questionId)));
    const answeredQuestionIds = new Set<number>();
    const omittedSubmittedQuestionIds = new Set<number>();

    for (const sub of submissions) {
      if (!sub.question || !testQuestionIds.has(Number(sub.questionId))) continue;
      
      const correctOption = sub.question.options.find(o => o.isCorrect);
      if (!correctOption) continue;

      const hasSelectedAnswer =
        sub.selectedOptionId !== null && sub.selectedOptionId !== undefined;
      if (hasSelectedAnswer) {
        answeredQuestionIds.add(Number(sub.questionId));
      } else {
        // A submission exists for this test/question, but there is no answer chosen.
        // This is what we count as "omitted" while the test is suspended.
        omittedSubmittedQuestionIds.add(Number(sub.questionId));
      }

      const isCorrect = Number(sub.selectedOptionId) === correctOption.id;
      if (isCorrect) correctCount++;

      // Analyze sequence for Right -> Wrong transitions
      let rtwSub = 0;
      if (sub.answerSequence && sub.answerSequence.length > 1) {
          for (let i = 0; i < sub.answerSequence.length - 1; i++) {
              if (Number(sub.answerSequence[i]) === correctOption.id && Number(sub.answerSequence[i+1]) !== correctOption.id) {
                  rtwSub++;
              }
          }
      }
      
      sub.isCorrect = isCorrect;
      sub.rightToWrongChanges = rtwSub;
      sub.firstSelectedOptionId =
        sub.firstSelectedOptionId ??
        (sub.selectionHistory?.[0]?.optionId ?? sub.answerSequence?.[0] ?? null);
      sub.answerTransitionPattern = this.classifyAnswerTransition(
        sub.firstSelectedOptionId,
        sub.selectedOptionId,
        correctOption.id,
      );
      rtwTotal += rtwSub;
    }

    test.correctAnswers = correctCount;
    test.answeredQuestions = answeredQuestionIds.size;
    test.rightToWrongChanges = rtwTotal;
    if (test.status === TestStatus.SUSPENDED) {
      // While suspended: only count questions that were explicitly "submitted" without an answer.
      // Unvisited/unsubmitted questions remain UNUSED until the user completes the test/block.
      test.omittedQuestions = omittedSubmittedQuestionIds.size;
    } else {
      // When completed: remaining unanswered questions are counted as omitted.
      test.omittedQuestions = Math.max(0, Number(test.totalQuestions) - answeredQuestionIds.size);
    }
    test.percentageScore = test.totalQuestions > 0 ? (correctCount / test.totalQuestions) * 100 : 0;

    // Save all submissions with updated correctness
    await this.submissionRepository.save(submissions);
    const updatedTest = await this.testRepository.save(test);

    await this.analyticsAggregationService.processTestIfNeeded(testId, { forceRecompute: true });

    return updatedTest;
  }

  async renameTest(id: any, userId: number, newName: string): Promise<Test> {
    const testId = this.parseAndValidateId(id);
    const test = await this.testRepository.findOne({ where: { id: testId, userId } });
    if (!test) throw new NotFoundException('No results found for this id');

    test.title = newName;
    return this.testRepository.save(test);
  }

  async removeTest(id: any, userId: number): Promise<any> {
    const testId = this.parseAndValidateId(id);
    const test = await this.testRepository.findOne({
      where: { id: testId, userId },
      relations: ['user'],
    });
    if (!test) {
      throw new NotFoundException('No results found for this id');
    }

    let actualBankIds: number[] = test.filters?.questionBankIds || (test.blockBankId ? [test.blockBankId] : []);
    if (!actualBankIds || !actualBankIds.length) {
      try {
        const uniqueBanksQuery = await this.testRepository.manager
          .createQueryBuilder(TestQuestion, 'tq')
          .select('q.questionBankId', 'bankId')
          .innerJoin(Question, 'q', 'tq.questionId = q.id')
          .where('tq.testId = :testId', { testId })
          .groupBy('q.questionBankId')
          .getRawMany();
        actualBankIds = uniqueBanksQuery.map(row => row.bankId).filter(Boolean);
      } catch (e) {
        console.error('[TestExecutionService] Error fetching exact qbankIds:', e);
      }
    }

    const queryRunner = this.testRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let deletedSubmissions = 0;
    let deletedInteractions = 0;
    let deletedMappings = 0;

    try {
      const submissionsResult = await queryRunner.manager.delete(QuestionSubmission, {
        userId,
        testId,
      });
      deletedSubmissions = submissionsResult.affected || 0;

      const interactionsResult = await queryRunner.manager.delete(QuestionInteraction, {
        userId,
        testId,
      });
      deletedInteractions = interactionsResult.affected || 0;

      const mappingsResult = await queryRunner.manager.delete(TestQuestion, { testId });
      deletedMappings = mappingsResult.affected || 0;

      await queryRunner.manager.delete(TestAnalyticsSnapshot, { testId });

      const testDeleteResult = await queryRunner.manager.delete(Test, { id: testId, userId });
      if (!testDeleteResult.affected) {
        throw new NotFoundException('No results found for this id');
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Fix #1: delete may affect every per-step bucket — invalidate all of them
    // since we don't always know the originating step from the test record.
    await this.invalidateFilterCountsCache(userId);

    await this.analyticsAggregationService.rebuildUserAggregates(userId, Number(test.step));

    try {
      const historyEntry = this.historyRepo.create({
        adminEmail: test.user?.email || `user_id_${userId}`,
        action: 'DELETE_TEST',
        topic: 'Delete Hub',
        targetEntity: 'Test',
        targetId: testId.toString(),
        details: {
          qbankIds: actualBankIds,
          testId: testId,
          step: test.step,
          deletedRecords: {
            tests: 1,
            testQuestions: deletedMappings,
            questionSubmissions: deletedSubmissions,
            questionInteractions: deletedInteractions,
          },
        },
      });
      await this.historyRepo.save(historyEntry);
    } catch (e) {
      console.error('[TestExecutionService] Error logging to AdminHistory:', e);
    }

    return {
      success: true,
      message: 'Test removed and questions restored successfully',
      restoredQuestions: true,
      deletedRecords: {
        tests: 1,
        testQuestions: deletedMappings,
        questionSubmissions: deletedSubmissions,
        questionInteractions: deletedInteractions,
      },
    };
  }

  private normalizeAnswerInput(
    selectionHistory?: { optionId: number; timestampMs: number }[],
    answerSequence?: number[],
  ): {
    answerSequence: number[];
    selectionHistory: { optionId: number; timestampMs: number }[];
  } {
    if (selectionHistory && selectionHistory.length > 0) {
      const normalizedHistory = this.normalizeSelectionHistory(selectionHistory);
      return {
        selectionHistory: normalizedHistory,
        answerSequence: normalizedHistory.map((event) => Number(event.optionId)),
      };
    }

    const normalizedSequence = this.normalizeAnswerSequence(answerSequence || []);
    return {
      answerSequence: normalizedSequence,
      selectionHistory: normalizedSequence.map((optionId, index) => ({
        optionId,
        timestampMs: index,
      })),
    };
  }

  private normalizeSelectionHistory(
    selectionHistory: { optionId: number; timestampMs: number }[],
  ): { optionId: number; timestampMs: number }[] {
    const sorted = [...selectionHistory]
      .filter(
        (event) =>
          event &&
          event.optionId != null &&
          Number.isFinite(Number(event.optionId)) &&
          event.timestampMs != null &&
          Number.isFinite(Number(event.timestampMs)),
      )
      .map((event) => ({
        optionId: Number(event.optionId),
        timestampMs: Math.max(0, Number(event.timestampMs)),
      }))
      .sort((left, right) => left.timestampMs - right.timestampMs);

    const deduplicated: { optionId: number; timestampMs: number }[] = [];
    let previousOptionId: number | null = null;
    let previousTimestamp = -1;
    for (const event of sorted) {
      if (event.optionId === previousOptionId) {
        continue;
      }
      const monotonicTimestamp = Math.max(event.timestampMs, previousTimestamp + 1);
      deduplicated.push({
        optionId: event.optionId,
        timestampMs: monotonicTimestamp,
      });
      previousOptionId = event.optionId;
      previousTimestamp = monotonicTimestamp;
    }
    return deduplicated;
  }

  private normalizeAnswerSequence(answerSequence: number[]): number[] {
    const normalized: number[] = [];
    for (const rawOptionId of answerSequence || []) {
      const optionId = Number(rawOptionId);
      if (!Number.isFinite(optionId)) continue;
      if (normalized[normalized.length - 1] === optionId) continue;
      normalized.push(optionId);
    }
    return normalized;
  }

  private classifyAnswerTransition(
    firstSelectedOptionId: number | null | undefined,
    finalSelectedOptionId: number | null | undefined,
    correctOptionId: number | null | undefined,
  ): AnswerTransitionPattern {
    if (
      firstSelectedOptionId == null ||
      finalSelectedOptionId == null ||
      correctOptionId == null
    ) {
      return AnswerTransitionPattern.UNKNOWN;
    }

    const firstIsCorrect = Number(firstSelectedOptionId) === Number(correctOptionId);
    const finalIsCorrect = Number(finalSelectedOptionId) === Number(correctOptionId);

    if (firstIsCorrect && finalIsCorrect) return AnswerTransitionPattern.C_TO_C;
    if (firstIsCorrect && !finalIsCorrect) return AnswerTransitionPattern.C_TO_I;
    if (!firstIsCorrect && finalIsCorrect) return AnswerTransitionPattern.I_TO_C;
    return AnswerTransitionPattern.I_TO_I;
  }

  private countRightToWrongTransitions(
    answerSequence: number[] | null | undefined,
    correctOptionId: number | null | undefined,
  ): number {
    if (!answerSequence || answerSequence.length < 2 || correctOptionId == null) {
      return 0;
    }

    let count = 0;
    for (let index = 0; index < answerSequence.length - 1; index += 1) {
      if (
        Number(answerSequence[index]) === Number(correctOptionId) &&
        Number(answerSequence[index + 1]) !== Number(correctOptionId)
      ) {
        count += 1;
      }
    }
    return count;
  }

  private parseAndValidateId(id: any): number {
    const idStr = String(id);
    const numId = parseInt(idStr, 10);
    if (isNaN(numId) || numId < 1 || numId > 2147483647 || String(numId) !== idStr) {
      throw new NotFoundException('No results found for this id');
    }
    return numId;
  }

  /**
   * v=2 Mixed boundary: persist the in-flight submission, mark the test
   * COMPLETED, and return { autoCompleted: true } so the frontend can
   * navigate cleanly to results instead of treating a 400 as a silent
   * failure (which is what triggered the original bug — visual timer said
   * time left, server force-completed, frontend swallowed the 400, user
   * kept clicking, every subsequent answer was lost).
   *
   * `saveSubmissionInBackground` is reused so the persistence path stays
   * identical to a normal submit (highlights, marks, daily-stats mirror,
   * correctness recomputation). The only difference is that we then flip
   * status to COMPLETED in the same call.
   */
  private async saveThenAutoCompleteMixed(
    test: Test,
    userId: number,
    dto: SubmitAnswerDto,
    correctOptionId: number | null,
    cacheHit: boolean,
    question: any,
  ): Promise<any> {
    const {
      questionId,
      selectedOptionId,
      timeSpentSeconds,
      answerSequence,
      selectionHistory,
      highlights,
      isMarked,
      notes,
    } = dto;

    if (!cacheHit) {
      const correctOption = question?.options?.find((o: any) => o.isCorrect);
      correctOptionId = correctOption?.id ?? correctOptionId;
      if (correctOptionId) {
        await this.cacheManager.set(
          `question_keys:${questionId}:answer`,
          correctOptionId,
          3600000,
        );
      }
    }

    const isCorrect = selectedOptionId === correctOptionId;
    const normalizedInput = this.normalizeAnswerInput(selectionHistory, answerSequence);
    const normalizedSequence = normalizedInput.answerSequence;
    const normalizedSelectionHistory = normalizedInput.selectionHistory;
    const firstSelectedOptionId =
      normalizedSequence.length > 0 ? Number(normalizedSequence[0]) : null;
    const answerTransitionPattern = this.classifyAnswerTransition(
      firstSelectedOptionId,
      selectedOptionId,
      correctOptionId,
    );
    const rightToWrongChanges = this.countRightToWrongTransitions(
      normalizedSequence,
      correctOptionId,
    );
    const hasSelectedAnswer = selectedOptionId !== null && selectedOptionId !== undefined;

    // Persist the in-flight answer first. saveSubmissionInBackground writes
    // the submission row, bumps test counters, and (for v=2) adds the
    // per-submit time to test.timeSpentSeconds.
    await this.saveSubmissionInBackground(
      userId,
      Number(test.id),
      questionId,
      selectedOptionId,
      isCorrect,
      correctOptionId,
      timeSpentSeconds,
      normalizedSequence,
      normalizedSelectionHistory,
      firstSelectedOptionId,
      answerTransitionPattern,
      rightToWrongChanges,
      highlights,
      isMarked,
      notes,
      test,
    );

    // Reload to get the fresh counters/time that saveSubmissionInBackground
    // committed, then flip COMPLETED.
    const fresh = await this.testRepository.findOne({ where: { id: test.id } });
    const finalTest = fresh ?? test;
    finalTest.timeSpentSeconds = Math.min(
      Number(finalTest.timeLimitSeconds),
      Number(finalTest.timeSpentSeconds || 0),
    );
    finalTest.status = TestStatus.COMPLETED;
    finalTest.completedAt = new Date();
    finalTest.percentageScore = finalTest.totalQuestions > 0
      ? (Number(finalTest.correctAnswers) / Number(finalTest.totalQuestions)) * 100
      : 0;
    const savedTest = await this.testRepository.save(finalTest);

    // Re-derive counters from canonical submission rows + process analytics so
    // the results page has a snapshot. Mirrors what completeTest does at its
    // end. Without this, percentageScore / correctAnswers can drift from the
    // submission rows and the analytics aggregator never fires for this test.
    await this.evaluateTestState(Number(test.id), userId, savedTest);

    await this.invalidateFilterCountsCache(userId, finalTest.step);

    return {
      submission: {
        selectedOptionId: hasSelectedAnswer ? Number(selectedOptionId) : null,
        isCorrect,
        correctOptionId: correctOptionId ? Number(correctOptionId) : null,
        isMarked: isMarked ?? false,
        timeSpentSeconds: Number(timeSpentSeconds || 0),
        answerChanges: Math.max(0, normalizedSequence.length - 1),
        rightToWrongChanges,
        firstSelectedOptionId,
        answerTransitionPattern,
      },
      testStats: {
        answeredQuestions: Number(finalTest.answeredQuestions || 0),
        correctAnswers: Number(finalTest.correctAnswers || 0),
        timeSpentSeconds: Number(finalTest.timeSpentSeconds || 0),
        percentageScore: Number(finalTest.percentageScore || 0),
      },
      autoCompleted: true,
    };
  }

  private getElapsedTimeSeconds(test: Test): number {
    const persistedSeconds = Number(test.timeSpentSeconds || 0);
    if (test.status !== TestStatus.IN_PROGRESS) {
      return persistedSeconds;
    }
    if (!test.startedAt) {
      return persistedSeconds;
    }

    const startedAt = new Date(test.startedAt).getTime();
    const runningSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    return persistedSeconds + runningSeconds;
  }

  private checkpointElapsedTime(test: Test): void {
    if (test.status !== TestStatus.IN_PROGRESS) {
      return;
    }
    if (!test.startedAt) {
      test.startedAt = new Date();
      return;
    }
    const elapsedSeconds = this.getElapsedTimeSeconds(test);
    test.timeSpentSeconds = Math.max(0, Math.floor(elapsedSeconds));
    test.startedAt = new Date();
  }
}
