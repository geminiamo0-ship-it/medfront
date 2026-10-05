import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from '../../entities/subject.entity';
import { System } from '../../entities/system.entity';
import { Topic } from '../../entities/topic.entity';
import { QuestionBank } from '../../entities/question-bank.entity';
import { Question, QuestionDifficultyTier } from '../../entities/question.entity';
import { QuestionSubmission } from '../../entities/question-submission.entity';
import { TestQuestion } from '../../entities/test-question.entity';
import { Test, TestStatus } from '../../entities/test.entity';
import { User } from '../../entities/user.entity';
import { MainBank } from '../../entities/main-bank.entity';
import { QuestionBankSubjectOrder } from '../../entities/question-bank-subject-order.entity';
import { QuestionBankSystemOrder } from '../../entities/question-bank-system-order.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SubscriptionService } from '../../subscriptions/subscription.service';
import { Cache } from 'cache-manager';
import {
  taxonomyTopicsCacheKey,
  taxonomySystemsCacheKey,
  taxonomyQuestionBanksCacheKey,
  bankTotalsCacheKey,
  difficultyCountsCacheKey,
  difficultyCountsEpochCacheKey,
  TAXONOMY_TTL_MS,
  BANK_TOTALS_TTL_MS,
  DIFFICULTY_COUNTS_TTL_MS,
} from '../../cache/cache-keys.util';
import { safeCacheGet, safeCacheSet, safeCacheDel } from '../../cache/safe-cache.util';

export type QuestionMode =
  | 'all'
  | 'unused'
  | 'used'
  | 'incorrect'
  | 'correct'
  | 'marked'
  | 'marked_correct'
  | 'marked_incorrect'
  | 'omitted'
  | 'suspended';

@Injectable()
export class TestMetadataService {
  constructor(
    @InjectRepository(Subject)
    private subjectRepository: Repository<Subject>,
    @InjectRepository(System)
    private systemRepository: Repository<System>,
    @InjectRepository(Topic)
    private topicRepository: Repository<Topic>,
    @InjectRepository(QuestionBank)
    private questionBankRepository: Repository<QuestionBank>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(QuestionSubmission)
    private submissionRepository: Repository<QuestionSubmission>,
    @InjectRepository(TestQuestion)
    private testQuestionRepository: Repository<TestQuestion>,
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
    @InjectRepository(MainBank)
    private mainBankRepository: Repository<MainBank>,
    @InjectRepository(QuestionBankSubjectOrder)
    private subjectOrderRepository: Repository<QuestionBankSubjectOrder>,
    @InjectRepository(QuestionBankSystemOrder)
    private systemOrderRepository: Repository<QuestionBankSystemOrder>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    private subscriptionService: SubscriptionService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Per-bank subject/system ORDER + column layout override.
  //
  // When EXACTLY ONE bank is selected we may have a stored 2-column layout for
  // its subjects/systems (question_bank_subject_order / _system_order). Load it
  // into a Map keyed by the taxonomy id. Empty map (no override for that bank)
  // → callers keep the global order and emit no columnIndex, so the frontend
  // falls back to its even/odd split.
  // ─────────────────────────────────────────────────────────────────────────
  private async loadOrderOverride(
    kind: 'subject' | 'system',
    enforcedBankIds: number[],
  ): Promise<Map<number, { columnIndex: number; position: number }>> {
    const map = new Map<number, { columnIndex: number; position: number }>();
    // Override is per-bank and only meaningful for a single selected bank.
    if (!enforcedBankIds || enforcedBankIds.length !== 1) return map;
    const bankId = enforcedBankIds[0];

    if (kind === 'subject') {
      const rows = await this.subjectOrderRepository.find({
        where: { questionBankId: bankId },
      });
      for (const r of rows) {
        map.set(Number(r.subjectId), {
          columnIndex: Number(r.columnIndex),
          position: Number(r.position),
        });
      }
    } else {
      const rows = await this.systemOrderRepository.find({
        where: { questionBankId: bankId },
      });
      for (const r of rows) {
        map.set(Number(r.systemId), {
          columnIndex: Number(r.columnIndex),
          position: Number(r.position),
        });
      }
    }
    return map;
  }

  // Attach columnIndex/position to each item from the override map and sort by
  // (columnIndex ASC, position ASC). Items already arrive in global display
  // order. Override items use their stored slot; NON-override items (present in
  // the bank but not in the override) are appended to column 1 AFTER the last
  // pinned column-1 item, preserving their incoming (global) order — so every
  // item ends up with a column. Mutates + returns a new array; when the map is
  // empty the input is returned unchanged (no columnIndex added).
  private applyOrderOverride<T extends { id: number }>(
    items: T[],
    overrideMap: Map<number, { columnIndex: number; position: number }>,
  ): Array<T & { columnIndex?: number; position?: number }> {
    if (overrideMap.size === 0) return items;

    // Highest position currently used in column 1 by an override item. Appended
    // (non-override) items continue after it so they never collide with a
    // pinned slot.
    let maxCol1Pos = -1;
    for (const v of overrideMap.values()) {
      if (v.columnIndex === 1 && v.position > maxCol1Pos) maxCol1Pos = v.position;
    }

    let appendCursor = 0;
    const decorated = items.map((item) => {
      const ov = overrideMap.get(item.id);
      if (ov) {
        return { ...item, columnIndex: ov.columnIndex, position: ov.position };
      }
      const position = maxCol1Pos + 1 + appendCursor;
      appendCursor++;
      return { ...item, columnIndex: 1, position };
    });

    decorated.sort((a, b) => {
      if (a.columnIndex !== b.columnIndex) return a.columnIndex - b.columnIndex;
      return a.position - b.position;
    });
    return decorated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal helper: returns question IDs for omitted questions (seen in a
  // completed test but never actually answered).
  // ─────────────────────────────────────────────────────────────────────────
  private buildAnsweredGlobalExistsSubquery(qb: any, questionIdExpr: string): string {
    return qb
      .subQuery()
      .select('1')
      .from(QuestionSubmission, 'sub_ans')
      .where('sub_ans.userId = :userId')
      .andWhere(`sub_ans.questionId = ${questionIdExpr}`)
      .andWhere('sub_ans.selectedOptionId IS NOT NULL')
      .getQuery();
  }

  private buildBlankSubmissionExistsSubquery(qb: any, questionIdExpr: string): string {
    return qb
      .subQuery()
      .select('1')
      .from(QuestionSubmission, 'sub_blank')
      .where('sub_blank.userId = :userId')
      .andWhere(`sub_blank.questionId = ${questionIdExpr}`)
      .andWhere('sub_blank.selectedOptionId IS NULL')
      .getQuery();
  }

  /**
   * Correct/incorrect status by the user's LATEST answered attempt per question
   * (not "any attempt ever"). Keeps the subject/system/topic mode breakdowns on
   * the Create Test page consistent with the headline counts and with what a
   * test actually selects: a wrong-then-right question moves to correct.
   */
  private async getLatestAnsweredStatusIds(
    userId: number,
  ): Promise<{ incorrectIds: number[]; correctIds: number[] }> {
    const rows: Array<{ questionId: number; isCorrect: boolean }> =
      await this.questionRepository.query(
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

  private buildMarkedExistsSubquery(qb: any, questionIdExpr: string): string {
    // Marks live in user_question_marks (PK on user_id, question_id).
    // Existence of a row = marked. Direct PK probe, no JOIN.
    //
    // NOTE: passing the table name string (not the entity class) — see the
    // matching comment in TestCreationService.buildMarkedExistsSubquery for
    // why. TypeORM's `.from(EntityClass)` path is broken for composite-PK
    // entities.
    return qb
      .subQuery()
      .select('1')
      .from('user_question_marks', 'uqm_mark')
      .where('uqm_mark.user_id = :userId')
      .andWhere(`uqm_mark.question_id = ${questionIdExpr}`)
      .getQuery();
  }

  private buildOmittedPredicate(qb: any, questionIdExpr: string): string {
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

    return `(
      NOT EXISTS ${answeredGlobalSub}
      AND
      (EXISTS ${completedSeenSub} OR EXISTS ${blankAnySub})
    )`;
  }

  private buildSuspendedUntouchedPredicate(qb: any, questionIdExpr: string): string {
    const suspendedUntouchedSub = qb
      .subQuery()
      .select('1')
      .from(TestQuestion, 'tq_sus')
      .innerJoin(Test, 'test_sus', 'test_sus.id = tq_sus.testId')
      .where('test_sus.userId = :userId')
      .andWhere(`test_sus.status = '${TestStatus.SUSPENDED}'`)
      .andWhere(`tq_sus.questionId = ${questionIdExpr}`)
      .andWhere((qb2: any) => {
        const touchedInThisTest = qb2
          .subQuery()
          .select('1')
          .from(QuestionSubmission, 'sub_sus_touched')
          .where('sub_sus_touched.userId = :userId')
          .andWhere('sub_sus_touched.testId = test_sus.id')
          .andWhere(`sub_sus_touched.questionId = ${questionIdExpr}`)
          .getQuery();

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

    return `(
      EXISTS ${suspendedUntouchedSub}
    )`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal helper: restricts a question query builder to only the
  // questions that match the requested `mode`.
  // Returns null when the mode would yield zero results up-front (e.g.
  // "incorrect" but the user has no incorrect submissions) so that callers
  // can short-circuit to empty results without running the expensive count.
  // ─────────────────────────────────────────────────────────────────────────
  private async applyModeFilter(
    queryBuilder: ReturnType<Repository<Question>['createQueryBuilder']>,
    userId: number,
    mode: QuestionMode,
  ): Promise<boolean> {
    if (!mode || mode === 'all') return true;

    queryBuilder.setParameter('userId', userId);
    const questionIdExpr = 'question.id';

    // Incorrect/Correct resolve by the user's LATEST answered attempt per
    // question. Apply the precomputed id set as a primary-key IN; an empty set
    // means zero results, so return false to let the caller short-circuit.
    // marked_correct / marked_incorrect are the same id sets additionally
    // intersected with the user's marks (mirrors TestCreationService).
    if (
      mode === 'incorrect' ||
      mode === 'correct' ||
      mode === 'marked_incorrect' ||
      mode === 'marked_correct'
    ) {
      const { incorrectIds, correctIds } =
        await this.getLatestAnsweredStatusIds(userId);
      const ids =
        mode === 'incorrect' || mode === 'marked_incorrect'
          ? incorrectIds
          : correctIds;
      if (ids.length === 0) return false;
      queryBuilder.andWhere('question.id IN (:...latestStatusIds)', {
        latestStatusIds: ids,
      });
      if (mode === 'marked_correct' || mode === 'marked_incorrect') {
        queryBuilder.andWhere(
          (qb: any) => `EXISTS ${this.buildMarkedExistsSubquery(qb, questionIdExpr)}`,
        );
      }
      return true;
    }

    queryBuilder.andWhere((qb: any) => {
      const answeredGlobalSub = this.buildAnsweredGlobalExistsSubquery(qb, questionIdExpr);
      const omittedPredicate = this.buildOmittedPredicate(qb, questionIdExpr);
      const suspendedPredicate = this.buildSuspendedUntouchedPredicate(qb, questionIdExpr);

      switch (mode) {
        case 'unused':
          return `(
            NOT EXISTS ${answeredGlobalSub}
            AND NOT (${omittedPredicate})
            AND NOT (${suspendedPredicate})
          )`;
        case 'used':
          return `(EXISTS ${answeredGlobalSub} OR (${omittedPredicate}))`;
        case 'marked': {
          const markedSub = this.buildMarkedExistsSubquery(qb, questionIdExpr);
          return `(EXISTS ${markedSub})`;
        }
        case 'omitted':
          return `(${omittedPredicate})`;
        case 'suspended':
          return `(${suspendedPredicate})`;
        default:
          return '1=1';
      }
    });

    return true;
  }

  /**
   * Scope a metadata count query to the selected 5-tier difficulties, so the
   * per-subject / per-system / per-topic counts reflect the difficulty filter
   * the same way they already reflect the mode filter. Reads the stored
   * question.difficultyTier column (no join). Empty/invalid selection after
   * normalization → match nothing (1 = 0). Distinct param name avoids
   * colliding with any mode-filter parameters on the same builder.
   */
  private applyDifficultyFilter(qb: any, difficulty?: string[]) {
    if (!difficulty?.length) return;
    const allowed = new Set<string>(Object.values(QuestionDifficultyTier));
    const tiers = difficulty
      .map((v) => String(v).toLowerCase())
      .filter((v) => allowed.has(v));
    if (tiers.length === 0) {
      qb.andWhere('1 = 0');
      return;
    }
    qb.andWhere('question.difficultyTier IN (:...metaDifficulty)', {
      metaDifficulty: tiers,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /tests/metadata/difficulty-counts
  //
  // Per-tier question counts for the Create Test difficulty checkboxes.
  // Reads the stored, trigger-maintained questions.difficulty column — one
  // indexed GROUP BY, no joins. This is bank-level CONTENT metadata (not
  // user activity): it changes only on bank imports and admin option edits,
  // so the result is cached for 24h and shared across every user with the
  // same accessible-bank set. Admin edits bump a global epoch that orphans
  // all cached variants at once (see AdminQuestionsService); offline imports
  // are covered by the TTL.
  // ─────────────────────────────────────────────────────────────────────────
  async getDifficultyCounts(
    user: User,
    step: number,
    questionBankIds?: number[],
  ): Promise<Record<QuestionDifficultyTier, number>> {
    const zeroed = Object.values(QuestionDifficultyTier).reduce(
      (acc, tier) => ({ ...acc, [tier]: 0 }),
      {} as Record<QuestionDifficultyTier, number>,
    );

    // Same bank-access enforcement as the question counts endpoint — the
    // cache key is built from the ENFORCED set, so users with different
    // access levels can never share each other's cached counts.
    const allowedBankIds = await this.subscriptionService.getAllowedQuestionBankIds(user, step);
    let enforcedBankIds = allowedBankIds;
    if (questionBankIds?.length) {
      enforcedBankIds = questionBankIds.filter((id) => allowedBankIds.includes(Number(id)));
    }
    if (!enforcedBankIds || enforcedBankIds.length === 0) {
      return zeroed;
    }

    const epoch =
      (await safeCacheGet<string>(this.cacheManager, difficultyCountsEpochCacheKey())) ?? '0';
    const bankKey = [...enforcedBankIds].sort((a, b) => a - b).join(',');
    const cacheKey = difficultyCountsCacheKey(epoch, step, bankKey);

    const cached = await safeCacheGet<Record<QuestionDifficultyTier, number>>(
      this.cacheManager,
      cacheKey,
    );
    if (cached) return cached;

    const rows = await this.questionRepository
      .createQueryBuilder('question')
      .select('question.difficultyTier', 'tier')
      .addSelect('COUNT(*)', 'count')
      .where('question.step = :step', { step })
      .andWhere('question.isActive = true')
      .andWhere('question.questionBankId IN (:...bankIds)', { bankIds: enforcedBankIds })
      .groupBy('question.difficultyTier')
      .getRawMany<{ tier: string | null; count: string }>();

    const counts = { ...zeroed };
    for (const row of rows) {
      // NULL tier = questions without UWorld data — not shown as a checkbox,
      // intentionally dropped here.
      if (row.tier && row.tier in counts) {
        counts[row.tier as QuestionDifficultyTier] = parseInt(row.count, 10) || 0;
      }
    }

    await safeCacheSet(this.cacheManager, cacheKey, counts, DIFFICULTY_COUNTS_TTL_MS);
    return counts;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /tests/metadata/subjects (POST now to support rich filters + mode)
  // ─────────────────────────────────────────────────────────────────────────
  async getSubjects(
    user: User,
    step?: number,
    questionBankIds?: number[],
    mode: QuestionMode = 'all',
    difficulty?: string[],
  ) {
    const userId = user.id;

    // 🔒 Enforce question bank access
    const allowedBankIds = await this.subscriptionService.getAllowedQuestionBankIds(user, step || 1);
    let enforcedBankIds = allowedBankIds;
    if (questionBankIds && questionBankIds.length > 0) {
      enforcedBankIds = questionBankIds.filter((id) => allowedBankIds.includes(Number(id)));
    }

    if (enforcedBankIds.length === 0) return [];

    const query = this.questionRepository
      .createQueryBuilder('question')
      .innerJoin('question.subject', 'subject')
      .where('subject.isActive = :isActive', { isActive: true })
      .andWhere('question.isActive = :isActive', { isActive: true });

    if (step) {
      query.andWhere('question.step = :step', { step });
    }

    query.andWhere('question.questionBankId IN (:...questionBankIds)', {
      questionBankIds: enforcedBankIds,
    });

    // Apply the mode filter (unused / correct / etc.)
    const hasResults = await this.applyModeFilter(query, userId, mode);
    if (!hasResults) return [];

    // Scope the per-subject counts to the selected difficulty tiers too.
    this.applyDifficultyFilter(query, difficulty);

    const rawResults = await query
      .select('subject.id', 'id')
      .addSelect('subject.name', 'name')
      .addSelect('COUNT(DISTINCT question.id)', 'questionCount')
      .addSelect('subject.displayOrder', 'displayOrder')
      .groupBy('subject.id')
      .addGroupBy('subject.name')
      .addGroupBy('subject.displayOrder')
      .orderBy('subject.displayOrder', 'ASC')
      .getRawMany();

    const subjects = rawResults
      .map((r) => ({
        id: parseInt(r.id, 10),
        name: r.name,
        displayOrder: parseInt(r.displayOrder, 10),
        questionCount: parseInt(r.questionCount, 10),
      }))
      .filter((s) => s.questionCount > 0);

    // Per-bank order/column override (single-bank selection only). When present
    // it re-sorts subjects into the stored 2-column layout and attaches
    // columnIndex/position; otherwise the global displayOrder order above is
    // returned untouched.
    const overrideMap = await this.loadOrderOverride('subject', enforcedBankIds);
    return this.applyOrderOverride(subjects, overrideMap);
  }

  async getMainBanks(user: User, step?: number) {
    const query = this.mainBankRepository
      .createQueryBuilder('mainBank')
      .innerJoin('mainBank.questionBanks', 'qb')
      .where('mainBank.isActive = :isActive', { isActive: true })
      .andWhere('qb.isActive = :isActive', { isActive: true });

    if (step) {
      query.andWhere('qb.step = :step', { step });
    }

    const mainBanks = await query
      .select([
        'mainBank.id',
        'mainBank.name',
        'mainBank.code',
        'mainBank.displayOrder',
        'mainBank.isPremium',
      ])
      .distinct(true)
      .orderBy('mainBank.displayOrder', 'ASC')
      .getMany();

    const hasActiveSubscription = this.subscriptionService.hasActiveSubscription(user);

    return mainBanks.map((bank) => ({
      ...bank,
      // isLocked = true when the bank is premium AND the user has no active subscription
      isLocked: bank.isPremium && !hasActiveSubscription,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Fix #3: cached taxonomy fetchers — shared across all users, long TTL.
  // ─────────────────────────────────────────────────────────────────────────
  private async getCachedQuestionBanks(step?: number, mainBankId?: number): Promise<QuestionBank[]> {
    const cacheKey = taxonomyQuestionBanksCacheKey(step, mainBankId);
    const cached = await safeCacheGet<QuestionBank[]>(this.cacheManager, cacheKey);
    if (cached) return cached;

    const where: any = { isActive: true };
    if (step) where.step = step;
    if (mainBankId) where.mainBankId = mainBankId;

    const banks = await this.questionBankRepository.find({ where, order: { id: 'ASC' } });
    await safeCacheSet(this.cacheManager, cacheKey, banks, TAXONOMY_TTL_MS);
    return banks;
  }

  private async getCachedSystems(): Promise<System[]> {
    const cacheKey = taxonomySystemsCacheKey();
    const cached = await safeCacheGet<System[]>(this.cacheManager, cacheKey);
    if (cached) return cached;

    const systems = await this.systemRepository.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' },
    });
    await safeCacheSet(this.cacheManager, cacheKey, systems, TAXONOMY_TTL_MS);
    return systems;
  }

  private async getCachedTopics(): Promise<Topic[]> {
    const cacheKey = taxonomyTopicsCacheKey();
    const cached = await safeCacheGet<Topic[]>(this.cacheManager, cacheKey);
    if (cached) return cached;

    const topics = await this.topicRepository.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' },
    });
    await safeCacheSet(this.cacheManager, cacheKey, topics, TAXONOMY_TTL_MS);
    return topics;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Fix #4: per-(step,mainBankId) static totalQuestions map.
  // The per-user used/omitted counts are computed fresh below.
  // ─────────────────────────────────────────────────────────────────────────
  private async getCachedBankTotals(
    step: number | undefined,
    mainBankId: number | undefined,
    bankIds: number[],
  ): Promise<Map<number, number>> {
    const cacheKey = bankTotalsCacheKey(step, mainBankId);
    const cached = await safeCacheGet<Array<[number, number]>>(this.cacheManager, cacheKey);
    if (cached) return new Map(cached);

    const totalCountsRaw = await this.questionRepository
      .createQueryBuilder('question')
      .innerJoin(QuestionBank, 'bank', 'bank.id = question.questionBankId')
      .select('question.questionBankId', 'bankId')
      .addSelect('COUNT(question.id)', 'count')
      .where('question.questionBankId IN (:...bankIds)', { bankIds })
      .andWhere('question.isActive = :isActive', { isActive: true })
      .andWhere('question.step = bank.step')
      .groupBy('question.questionBankId')
      .getRawMany();

    const totals = new Map<number, number>(
      totalCountsRaw.map((r) => [Number(r.bankId), parseInt(r.count, 10)]),
    );
    // Cache as array tuples — Maps don't survive JSON serialization in Redis.
    await safeCacheSet(this.cacheManager, cacheKey, Array.from(totals.entries()), BANK_TOTALS_TTL_MS);
    return totals;
  }

  async getQuestionBanksWithProgress(user: User, step?: number, mainBankId?: number) {
    const userId = user.id;

    // Fix #3: bank list cached (~24h)
    const banks = await this.getCachedQuestionBanks(step, mainBankId);

    if (banks.length === 0) return [];

    const bankIds = banks.map((b) => b.id);

    // Fix #4: bank totals cached (~1h)
    const totalCountMap = await this.getCachedBankTotals(step, mainBankId, bankIds);

    // "used" for progress = answered only (omitted is added separately).
    const usedCountsRaw = await this.submissionRepository
      .createQueryBuilder('submission')
      .innerJoin(Question, 'question', 'question.id = submission.questionId')
      .where('submission.userId = :userId', { userId })
      .andWhere('submission.selectedOptionId IS NOT NULL')
      .andWhere('question.questionBankId IN (:...bankIds)', { bankIds })
      .select('question.questionBankId', 'bankId')
      .addSelect('COUNT(DISTINCT submission.questionId)', 'count')
      .groupBy('question.questionBankId')
      .getRawMany();

    // Omitted questions per bank:
    // - COMPLETED tests: questions with no answered submission (global)
    // - SUSPENDED tests: only questions that were explicitly "submitted" without an answer in that test
    const omittedCountsRaw = await this.testQuestionRepository
      .createQueryBuilder('tq')
      .innerJoin(Test, 'test', 'test.id = tq.testId')
      .innerJoin(Question, 'question', 'question.id = tq.questionId')
      .where('test.userId = :userId', { userId })
      .andWhere('test.status IN (:...statuses)', { statuses: [TestStatus.COMPLETED, TestStatus.SUSPENDED] })
      .andWhere('question.questionBankId IN (:...bankIds)', { bankIds })
      .andWhere((qb) => {
        const answeredSub = qb
          .subQuery()
          .select('1')
          .from(QuestionSubmission, 'sub')
          .where('sub.userId = :userId')
          .andWhere('sub.questionId = tq.questionId')
          .andWhere('sub.selectedOptionId IS NOT NULL')
          .getQuery();

        const omittedInThisTestSub = qb
          .subQuery()
          .select('1')
          .from(QuestionSubmission, 'sub2')
          .where('sub2.userId = :userId')
          .andWhere('sub2.testId = test.id')
          .andWhere('sub2.questionId = tq.questionId')
          .andWhere('sub2.selectedOptionId IS NULL')
          .getQuery();

        return `(
          (test.status = '${TestStatus.COMPLETED}' AND NOT EXISTS ${answeredSub})
          OR
          (test.status = '${TestStatus.SUSPENDED}' AND EXISTS ${omittedInThisTestSub} AND NOT EXISTS ${answeredSub})
        )`;
      })
      .select('question.questionBankId', 'bankId')
      .addSelect('COUNT(DISTINCT tq.questionId)', 'count')
      .groupBy('question.questionBankId')
      .getRawMany();

    const omittedCountMap = new Map(omittedCountsRaw.map((r) => [Number(r.bankId), parseInt(r.count, 10)]));
    const usedCountMap = new Map(usedCountsRaw.map((r) => [Number(r.bankId), parseInt(r.count, 10)]));
    const hasActiveSubscription = this.subscriptionService.hasActiveSubscription(user);

    return banks.map((bank) => ({
      ...bank,
      totalQuestions: totalCountMap.get(bank.id) || 0,
      usedQuestions: (usedCountMap.get(bank.id) || 0) + (omittedCountMap.get(bank.id) || 0),
      isLocked: bank.isPremium && !hasActiveSubscription,
    }));
  }

  async getSystems() {
    // Fix #3: cached taxonomy.
    return this.getCachedSystems();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /tests/metadata/systems-with-topics
  // Now respects `filters.mode` for accurate per-system / per-topic counts.
  // ─────────────────────────────────────────────────────────────────────────
  async getSystemsWithTopics(user: User, step: number, filters?: any) {
    const userId = user.id;

    // 🔒 Enforce question bank access
    const allowedBankIds = await this.subscriptionService.getAllowedQuestionBankIds(user, step);
    let enforcedBankIds = allowedBankIds;
    if (filters?.questionBankIds && filters.questionBankIds.length > 0) {
      enforcedBankIds = filters.questionBankIds.filter((id) => allowedBankIds.includes(Number(id)));
    }

    if (enforcedBankIds.length === 0) return [];

    const mode: QuestionMode = filters?.mode || 'all';

    console.log(`[TestMetadata] 🔍 Fetching systems for user ${userId} with mode=${mode}`);

    // Fix #3: both reads come from Redis after the first hit (~24h TTL).
    const [systems, allTopics] = await Promise.all([
      this.getCachedSystems(),
      this.getCachedTopics(),
    ]);

    // Build the base question query
    const buildBase = () => {
      const q = this.questionRepository
        .createQueryBuilder('question')
        .where('question.step = :step', { step })
        .andWhere('question.isActive = :isActive', { isActive: true })
        .andWhere('question.questionBankId IN (:...questionBankIds)', {
          questionBankIds: enforcedBankIds,
        });

      if (filters?.subjectIds?.length > 0) {
        q.andWhere('question.subjectId IN (:...subjectIds)', { subjectIds: filters.subjectIds });
      }
      // Scope per-system / per-topic counts to the selected difficulty tiers.
      this.applyDifficultyFilter(q, filters?.difficulty);
      return q;
    };

    // Apply mode filter on a fresh base query
    const topicBase = buildBase();
    const systemBase = buildBase();

    const topicHasResults = await this.applyModeFilter(topicBase, userId, mode);
    const systemHasResults = await this.applyModeFilter(systemBase, userId, mode);

    if (!topicHasResults && !systemHasResults) {
      return systems.map((s) => ({ ...s, questionCount: 0, topics: [] })).filter(() => false);
    }

    const [topicCountsRaw, systemCountsRaw] = await Promise.all([
      topicHasResults
        ? topicBase
            .select('question.topicId', 'topicId')
            .addSelect('COUNT(DISTINCT question.id)', 'count')
            .groupBy('question.topicId')
            .getRawMany()
        : [],
      systemHasResults
        ? systemBase
            .select('question.systemId', 'systemId')
            .addSelect('COUNT(DISTINCT question.id)', 'count')
            .groupBy('question.systemId')
            .getRawMany()
        : [],
    ]);

    const topicCountMap = new Map(topicCountsRaw.map((r) => [Number(r.topicId), parseInt(r.count, 10)]));
    const systemCountMap = new Map(systemCountsRaw.map((r) => [Number(r.systemId), parseInt(r.count, 10)]));

    const systemsWithTopics = systems
      .map((system) => {
        const topics = allTopics
          .filter((t) => t.systemId === system.id)
          .map((topic) => ({
            id: topic.id,
            name: topic.name,
            description: topic.description,
            questionCount: topicCountMap.get(topic.id) || 0,
          }))
          .filter((t) => t.questionCount > 0);

        return {
          id: system.id,
          name: system.name,
          description: system.description,
          questionCount: systemCountMap.get(system.id) || 0,
          topics,
        };
      })
      .filter((s) => s.questionCount > 0);

    // Per-bank order/column override (single-bank selection only). Applied
    // in-memory AFTER reading the shared systems cache — the cache itself is
    // never mutated. Topics inside each system are unchanged. No override →
    // the global displayOrder order from getCachedSystems() is preserved and
    // no columnIndex is attached (frontend falls back to even/odd).
    const overrideMap = await this.loadOrderOverride('system', enforcedBankIds);
    return this.applyOrderOverride(systemsWithTopics, overrideMap);
  }

  private extractFilterHash(filters: any): string {
    if (!filters) return 'none';
    const parts = [];
    if (filters.subjectIds?.length) parts.push(`sub:${filters.subjectIds.sort().join(',')}`);
    if (filters.questionBankIds?.length) parts.push(`bank:${filters.questionBankIds.sort().join(',')}`);
    return parts.length > 0 ? parts.join('|') : 'none';
  }

  async getTopics(subjectId?: number, systemId?: number) {
    // Fix #3: hot path for the unfiltered call uses the cached active set.
    if (!subjectId && !systemId) {
      return this.getCachedTopics();
    }

    // Filtered variants stay uncached — the call volume is far lower and the
    // filter space (subject × system) would explode the key count.
    const where: any = { isActive: true };
    if (subjectId) where.subjectId = subjectId;
    if (systemId) where.systemId = systemId;
    return this.topicRepository.find({ where, order: { displayOrder: 'ASC' } });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public invalidators — called by admin services after taxonomy writes.
  // Kept on this service so admin code doesn't need to know cache key shapes.
  // ─────────────────────────────────────────────────────────────────────────
  async invalidateTaxonomyCache(scope: 'topics' | 'systems' | 'banks' | 'all'): Promise<void> {
    const tasks: Promise<unknown>[] = [];
    if (scope === 'topics' || scope === 'all') {
      tasks.push(safeCacheDel(this.cacheManager, taxonomyTopicsCacheKey()));
    }
    if (scope === 'systems' || scope === 'all') {
      tasks.push(safeCacheDel(this.cacheManager, taxonomySystemsCacheKey()));
    }
    if (scope === 'banks' || scope === 'all') {
      // Bank list and bank totals are keyed by (step, mainBankId). We don't
      // track which variants exist, so we delete the unfiltered keys and let
      // the rest expire naturally via TTL. Admin writes are rare enough that
      // a short staleness window on uncommon variants is acceptable.
      tasks.push(safeCacheDel(this.cacheManager, taxonomyQuestionBanksCacheKey()));
      tasks.push(safeCacheDel(this.cacheManager, bankTotalsCacheKey()));
      for (const step of [1, 2, 3, 4, 5]) {
        tasks.push(safeCacheDel(this.cacheManager, taxonomyQuestionBanksCacheKey(step)));
        tasks.push(safeCacheDel(this.cacheManager, bankTotalsCacheKey(step)));
      }
    }
    await Promise.all(tasks);
  }
}
