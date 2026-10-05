import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Test, TestStatus } from '../../entities/test.entity';
import {
  AnswerTransitionPattern,
  QuestionSubmission,
} from '../../entities/question-submission.entity';
import { TestQuestion } from '../../entities/test-question.entity';
import { Question } from '../../entities/question.entity';
import {
  AnalyticsCohortType,
  TestAnalyticsSnapshot,
} from '../../entities/test-analytics-snapshot.entity';
import { UserAnalyticsStats } from '../../entities/user-analytics-stats.entity';
import {
  DimensionType,
  UserDimensionStats,
} from '../../entities/user-dimension-stats.entity';

interface AttemptRecord {
  questionId: number;
  displayOrder: number;
  isCorrect: boolean;
  timeSpentSeconds: number;
  answerChanges: number;
  transitionPattern: AnswerTransitionPattern;
  difficulty: string;
  subjectId: number | null;
  subjectName: string | null;
  systemId: number | null;
  systemName: string | null;
  topicId: number | null;
  topicName: string | null;
  questionBankId: number | null;
  questionBankName: string | null;
}

interface SnapshotComputation {
  totalQuestions: number;
  attemptedQuestions: number;
  correctQuestions: number;
  scorePercentage: number;
  avgTimeSeconds: number;
  medianTimeSeconds: number;
  confidenceScore: number;
  overthinkingIndex: number;
  transitionCounts: {
    cToC: number;
    cToI: number;
    iToC: number;
    iToI: number;
    unknown: number;
  };
  timeAccuracyQuadrants: {
    fastCorrectCount: number;
    slowCorrectCount: number;
    slowIncorrectCount: number;
    fastIncorrectCount: number;
  };
  difficultyAnalytics: Record<
    string,
    {
      attempted: number;
      correct: number;
      accuracy: number;
      avgTimeSeconds: number;
    }
  >;
  fatigueSegments: {
    label: string;
    range: { start: number; end: number };
    attempted: number;
    correct: number;
    accuracy: number;
    avgTimeSeconds: number;
  }[];
  peerComparison: {
    missedHighConsensusCount: number;
    solvedLowConsensusCount: number;
    questionDifficultyBreakdown: { easy: number; medium: number; hard: number };
    lowConfidence: boolean;
  };
  weaknessMap: {
    subject: any[];
    system: any[];
    topic: any[];
    questionBank: any[];
  };
  insights: string[];
  cohortType: AnalyticsCohortType;
  cohortSize: number;
  percentileRank: number;
  lowConfidence: boolean;
}

interface InsightCandidate {
  category: 'knowledge_gap' | 'careless_mistake' | 'time_management' | 'confidence' | 'strength';
  priority: number;
  text: string;
}

@Injectable()
export class AnalyticsAggregationService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(TestAnalyticsSnapshot)
    private readonly snapshotRepository: Repository<TestAnalyticsSnapshot>,
  ) {}

  async processTestIfNeeded(testId: number, options?: { forceRecompute?: boolean }): Promise<{
    processed: boolean;
    reason?: string;
    snapshot?: TestAnalyticsSnapshot;
  }> {
    const result = await this.dataSource.transaction(async (manager) => {
      const snapshotRepo = manager.getRepository(TestAnalyticsSnapshot);
      const testRepo = manager.getRepository(Test);
      const testQuestionRepo = manager.getRepository(TestQuestion);
      const submissionRepo = manager.getRepository(QuestionSubmission);
      const questionRepo = manager.getRepository(Question);
      const userStatsRepo = manager.getRepository(UserAnalyticsStats);
      const dimensionStatsRepo = manager.getRepository(UserDimensionStats);

      const existingSnapshot = await snapshotRepo.findOne({ where: { testId } });
      // When a snapshot already exists, the user-level aggregate (testsCompleted,
      // questionsAttempted, etc.) and dimension-level stats already include this
      // test's contribution. A forceRecompute should rebuild the snapshot ONLY —
      // re-running the aggregate increments would double-count the test (or 3x,
      // 10x, etc. across repeated rebuilds). Track this so we can skip the
      // aggregate updates below.
      const isRebuild = Boolean(existingSnapshot);
      if (existingSnapshot) {
        if (options?.forceRecompute) {
          await snapshotRepo.remove(existingSnapshot);
        } else {
          return { processed: false, reason: 'already_processed', snapshot: existingSnapshot };
        }
      }

      const test = await testRepo.findOne({ where: { id: testId } });
      if (!test) {
        return { processed: false, reason: 'test_not_found' };
      }
      // Only COMPLETED tests get processed. Previously we also processed
      // SUSPENDED tests so the test-results view could show advanced
      // analytics on partial attempts, but that meant the same test got
      // counted twice in user_analytics_stats / user_dimension_stats:
      // once during the suspended-view processing, once again on
      // forceRecompute at completion. By gating to COMPLETED only, each
      // test contributes its final-state numbers exactly once.
      if (test.status !== TestStatus.COMPLETED) {
        return { processed: false, reason: 'test_not_completed' };
      }

      const testQuestions = await testQuestionRepo.find({
        where: { testId },
        order: { displayOrder: 'ASC' },
        relations: [
          'question',
          'question.options',
          'question.subject',
          'question.system',
          'question.topic',
          'question.questionBank',
        ],
      });
      const submissions = await submissionRepo.find({
        where: { testId, userId: test.userId },
      });
      const submissionMap = new Map(
        submissions.map((submission) => [Number(submission.questionId), submission]),
      );

      const submissionsToUpdate: QuestionSubmission[] = [];
      const attemptedRecords: AttemptRecord[] = [];
      const questionCounterUpdates = new Map<number, { answered: number; correct: number }>();

      for (const testQuestion of testQuestions) {
        const question = testQuestion.question;
        if (!question) continue;

        const submission = submissionMap.get(Number(testQuestion.questionId));
        if (!submission || submission.selectedOptionId == null) continue;

        const correctOptionId =
          question.options?.find((option) => option.isCorrect)?.id ?? null;
        const firstSelectedOptionId =
          submission.firstSelectedOptionId ??
          this.extractFirstSelectedOptionId(submission);
        const derivedPattern = this.classifyAnswerTransition(
          firstSelectedOptionId,
          Number(submission.selectedOptionId),
          correctOptionId,
        );
        const derivedRightToWrong = this.countRightToWrongTransitions(
          submission.answerSequence || [],
          correctOptionId,
        );

        let changed = false;
        if (
          firstSelectedOptionId != null &&
          submission.firstSelectedOptionId !== firstSelectedOptionId
        ) {
          submission.firstSelectedOptionId = firstSelectedOptionId;
          changed = true;
        }
        if (submission.answerTransitionPattern !== derivedPattern) {
          submission.answerTransitionPattern = derivedPattern;
          changed = true;
        }
        if ((submission.rightToWrongChanges || 0) !== derivedRightToWrong) {
          submission.rightToWrongChanges = derivedRightToWrong;
          changed = true;
        }
        if (changed) {
          submissionsToUpdate.push(submission);
        }

        const timeSpentSeconds = Math.max(0, Number(submission.timeSpentSeconds || 0));
        const isCorrect = Boolean(submission.isCorrect);
        const transitionPattern = derivedPattern || AnswerTransitionPattern.UNKNOWN;

        const resolvedSystemId = question.systemId ?? question.topic?.systemId ?? null;
        const resolvedSystemName = question.system?.name || null;
        const resolvedTopicId = question.topicId ?? question.topic?.id ?? null;

        attemptedRecords.push({
          questionId: Number(question.id),
          displayOrder: Number(testQuestion.displayOrder),
          isCorrect,
          timeSpentSeconds,
          answerChanges: Math.max(0, Number(submission.answerChanges || 0)),
          transitionPattern,
          difficulty: String(question.difficulty || 'medium'),
          subjectId: question.subjectId ?? null,
          subjectName: question.subject?.name || null,
          systemId: resolvedSystemId,
          systemName: resolvedSystemName,
          topicId: resolvedTopicId,
          topicName: question.topic?.name || null,
          questionBankId: question.questionBankId ?? null,
          questionBankName: question.questionBank?.name || null,
        });

        const counter = questionCounterUpdates.get(question.id) || { answered: 0, correct: 0 };
        counter.answered += 1;
        if (isCorrect) {
          counter.correct += 1;
        }
        questionCounterUpdates.set(question.id, counter);
      }

      if (submissionsToUpdate.length > 0) {
        await submissionRepo.save(submissionsToUpdate);
      }

      for (const [questionId, update] of questionCounterUpdates) {
        await questionRepo
          .createQueryBuilder()
          .update(Question)
          .set({
            timesAnswered: () => `"timesAnswered" + ${Math.max(0, update.answered)}`,
            timesCorrect: () => `"timesCorrect" + ${Math.max(0, update.correct)}`,
          })
          .where(`"id" = :questionId`, { questionId })
          .execute();
      }

      const globalQuestionMap = await this.fetchGlobalQuestionAccuracyMap(
        questionRepo,
        attemptedRecords.map((record) => record.questionId),
      );

      const computed = this.computeSnapshot({
        attemptedRecords,
        totalQuestions: testQuestions.length,
        globalQuestionMap,
      });
      const percentile = await this.calculatePercentile({
        testRepo,
        test,
        scorePercentage: computed.scorePercentage,
      });

      computed.cohortType = percentile.cohortType;
      computed.cohortSize = percentile.cohortSize;
      computed.percentileRank = percentile.percentileRank;
      computed.lowConfidence = percentile.lowConfidence;
      computed.peerComparison.lowConfidence = percentile.lowConfidence;

      const snapshot = snapshotRepo.create({
        testId: Number(test.id),
        userId: Number(test.userId),
        step: Number(test.step),
        totalQuestions: computed.totalQuestions,
        attemptedQuestions: computed.attemptedQuestions,
        correctQuestions: computed.correctQuestions,
        scorePercentage: computed.scorePercentage,
        avgTimeSeconds: computed.avgTimeSeconds,
        medianTimeSeconds: computed.medianTimeSeconds,
        confidenceScore: computed.confidenceScore,
        overthinkingIndex: computed.overthinkingIndex,
        cohortType: computed.cohortType,
        cohortSize: computed.cohortSize,
        percentileRank: computed.percentileRank,
        lowConfidence: computed.lowConfidence,
        transitionCounts: computed.transitionCounts,
        timeAccuracyQuadrants: computed.timeAccuracyQuadrants,
        difficultyAnalytics: computed.difficultyAnalytics,
        fatigueSegments: computed.fatigueSegments,
        peerComparison: computed.peerComparison,
        weaknessMap: computed.weaknessMap,
        insights: computed.insights,
      });
      const savedSnapshot = await snapshotRepo.save(snapshot);

      // On a forceRecompute rebuild, this test was already counted in the
      // user-level and dimension-level rollups during its first processing.
      // Skip them so the rebuild doesn't double-add.
      if (!isRebuild) {
        await this.updateUserAggregateStats(manager, test, savedSnapshot);
        await this.updateUserDimensionStats(dimensionStatsRepo, test, attemptedRecords);
      }

      test.analyticsProcessedAt = new Date();
      await testRepo.save(test);

      return { processed: true, snapshot: savedSnapshot };
    });

    return result;
  }

  async rebuildUserAggregates(userId: number, step: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const snapshotRepo = manager.getRepository(TestAnalyticsSnapshot);
      const userStatsRepo = manager.getRepository(UserAnalyticsStats);
      const dimensionStatsRepo = manager.getRepository(UserDimensionStats);
      const submissionRepo = manager.getRepository(QuestionSubmission);

      const snapshots = await snapshotRepo.find({
        where: { userId, step },
        order: { computedAt: 'DESC' },
      });

      if (snapshots.length === 0) {
        await userStatsRepo.delete({ userId, step });
        await dimensionStatsRepo.delete({ userId, step });
        return;
      }

      let userStats = await userStatsRepo.findOne({ where: { userId, step } });
      if (!userStats) {
        userStats = userStatsRepo.create({ userId, step });
      }

      const aggregated = snapshots.reduce(
        (acc, snapshot) => {
          const transitionCounts = snapshot.transitionCounts || {
            cToC: 0,
            cToI: 0,
            iToC: 0,
            iToI: 0,
            unknown: 0,
          };
          const quadrants = snapshot.timeAccuracyQuadrants || {
            fastCorrectCount: 0,
            slowCorrectCount: 0,
            slowIncorrectCount: 0,
            fastIncorrectCount: 0,
          };

          acc.testsCompleted += 1;
          acc.questionsAttempted += Number(snapshot.attemptedQuestions || 0);
          acc.correctAnswers += Number(snapshot.correctQuestions || 0);
          acc.totalTimeSeconds += Math.round(
            Number(snapshot.avgTimeSeconds || 0) * Number(snapshot.attemptedQuestions || 0),
          );
          acc.cToCCount += Number(transitionCounts.cToC || 0);
          acc.cToICount += Number(transitionCounts.cToI || 0);
          acc.iToCCount += Number(transitionCounts.iToC || 0);
          acc.iToICount += Number(transitionCounts.iToI || 0);
          acc.fastCorrectCount += Number(quadrants.fastCorrectCount || 0);
          acc.slowCorrectCount += Number(quadrants.slowCorrectCount || 0);
          acc.slowIncorrectCount += Number(quadrants.slowIncorrectCount || 0);
          acc.fastIncorrectCount += Number(quadrants.fastIncorrectCount || 0);
          acc.totalConfidenceScore += Number(snapshot.confidenceScore || 0);
          acc.confidenceSamples += 1;
          acc.totalOverthinkingIndex += Number(snapshot.overthinkingIndex || 0);
          acc.overthinkingSamples += 1;
          return acc;
        },
        {
          testsCompleted: 0,
          questionsAttempted: 0,
          correctAnswers: 0,
          totalTimeSeconds: 0,
          cToCCount: 0,
          cToICount: 0,
          iToCCount: 0,
          iToICount: 0,
          fastCorrectCount: 0,
          slowCorrectCount: 0,
          slowIncorrectCount: 0,
          fastIncorrectCount: 0,
          totalConfidenceScore: 0,
          confidenceSamples: 0,
          totalOverthinkingIndex: 0,
          overthinkingSamples: 0,
        },
      );

      Object.assign(userStats, aggregated);
      await userStatsRepo.save(userStats);

      await dimensionStatsRepo.delete({ userId, step });

      const submissions = await submissionRepo
        .createQueryBuilder('submission')
        .innerJoin(Test, 'test', 'test.id = submission.testId')
        .leftJoinAndSelect('submission.question', 'question')
        .leftJoinAndSelect('question.options', 'option')
        .leftJoinAndSelect('question.subject', 'subject')
        .leftJoinAndSelect('question.system', 'system')
        .leftJoinAndSelect('question.topic', 'topic')
        .leftJoinAndSelect('question.questionBank', 'questionBank')
        .where('submission.userId = :userId', { userId })
        .andWhere('test.status IN (:...statuses)', { statuses: [TestStatus.COMPLETED, TestStatus.SUSPENDED] })
        .andWhere('test.step = :step', { step })
        .andWhere('submission.selectedOptionId IS NOT NULL')
        .getMany();

      const increments = new Map<
        string,
        {
          dimensionType: DimensionType;
          dimensionKey: string;
          dimensionName: string | null;
          attempted: number;
          correct: number;
          totalTimeSeconds: number;
          correctTimeSeconds: number;
          incorrectTimeSeconds: number;
          cToICount: number;
          iToCCount: number;
        }
      >();

      const pushIncrement = (
        dimensionType: DimensionType,
        dimensionKey: string | null,
        dimensionName: string | null,
        submission: QuestionSubmission,
      ) => {
        if (!dimensionKey) return;

        const mapKey = `${dimensionType}:${dimensionKey}`;
        const current =
          increments.get(mapKey) || {
            dimensionType,
            dimensionKey,
            dimensionName,
            attempted: 0,
            correct: 0,
            totalTimeSeconds: 0,
            correctTimeSeconds: 0,
            incorrectTimeSeconds: 0,
            cToICount: 0,
            iToCCount: 0,
          };

        const timeSpentSeconds = Math.max(0, Number(submission.timeSpentSeconds || 0));
        const transitionPattern =
          submission.answerTransitionPattern || AnswerTransitionPattern.UNKNOWN;

        current.attempted += 1;
        current.correct += submission.isCorrect ? 1 : 0;
        current.totalTimeSeconds += timeSpentSeconds;
        if (submission.isCorrect) current.correctTimeSeconds += timeSpentSeconds;
        else current.incorrectTimeSeconds += timeSpentSeconds;
        if (transitionPattern === AnswerTransitionPattern.C_TO_I) current.cToICount += 1;
        if (transitionPattern === AnswerTransitionPattern.I_TO_C) current.iToCCount += 1;
        if (!current.dimensionName && dimensionName) current.dimensionName = dimensionName;

        increments.set(mapKey, current);
      };

      for (const submission of submissions) {
        const question = submission.question;
        if (!question) continue;

        pushIncrement(
          DimensionType.DIFFICULTY,
          String(question.difficulty || 'medium'),
          String(question.difficulty || 'medium').toUpperCase(),
          submission,
        );
        pushIncrement(
          DimensionType.SUBJECT,
          question.subjectId != null ? String(question.subjectId) : null,
          question.subject?.name || null,
          submission,
        );
        pushIncrement(
          DimensionType.SYSTEM,
          question.systemId != null ? String(question.systemId) : null,
          question.system?.name || null,
          submission,
        );
        pushIncrement(
          DimensionType.TOPIC,
          question.topicId != null ? String(question.topicId) : null,
          question.topic?.name || null,
          submission,
        );
        pushIncrement(
          DimensionType.QUESTION_BANK,
          question.questionBankId != null ? String(question.questionBankId) : null,
          question.questionBank?.name || null,
          submission,
        );
      }

      if (increments.size > 0) {
        await dimensionStatsRepo.save(
          [...increments.values()].map((increment) =>
            dimensionStatsRepo.create({
              userId,
              step,
              ...increment,
            }),
          ),
        );
      }

    });
  }

  async getSnapshotByTestId(testId: number): Promise<TestAnalyticsSnapshot | null> {
    return this.snapshotRepository.findOne({ where: { testId } });
  }

  // Mirrors the back-compat filter in TestAnalyticsService — drops
  // "weakest area at 0.0% accuracy" insights left over in old snapshots
  // before the min-attempts gate landed.
  private static readonly stalePreGateInsightPattern =
    /is one of your weakest areas( right now)? at 0\.0% accuracy/i;

  private filterStaleInsights(texts: string[]): string[] {
    return texts.filter(
      (text) => !AnalyticsAggregationService.stalePreGateInsightPattern.test(text),
    );
  }

  mapSnapshotToResponse(snapshot: TestAnalyticsSnapshot | null): any {
    if (!snapshot) {
      return null;
    }

    return {
      overview: {
        totalQuestions: Number(snapshot.totalQuestions),
        attemptedQuestions: Number(snapshot.attemptedQuestions),
        correctQuestions: Number(snapshot.correctQuestions),
        scorePercentage: Number(snapshot.scorePercentage || 0),
        avgTimeSeconds: Number(snapshot.avgTimeSeconds || 0),
        medianTimeSeconds: Number(snapshot.medianTimeSeconds || 0),
        confidenceScore: Number(snapshot.confidenceScore || 0),
        overthinkingIndex: Number(snapshot.overthinkingIndex || 0),
      },
      difficultyAnalytics: snapshot.difficultyAnalytics || {},
      behavioralInsights: {
        transitions: snapshot.transitionCounts || {},
        timeAccuracyQuadrants: snapshot.timeAccuracyQuadrants || {},
        fatigueSegments: snapshot.fatigueSegments || [],
      },
      peerComparison: snapshot.peerComparison || {},
      weaknessMap: snapshot.weaknessMap || {},
      insights: this.filterStaleInsights(snapshot.insights || []),
      metadata: {
        percentileRank: Number(snapshot.percentileRank || 0),
        cohortType: snapshot.cohortType,
        cohortSize: Number(snapshot.cohortSize || 0),
        lowConfidence: Boolean(snapshot.lowConfidence),
        computedAt: snapshot.computedAt,
      },
    };
  }

  private async fetchGlobalQuestionAccuracyMap(
    questionRepo: Repository<Question>,
    questionIds: number[],
  ): Promise<Map<number, number>> {
    if (questionIds.length === 0) {
      return new Map<number, number>();
    }

    const uniqueIds = [...new Set(questionIds)];
    const questions = await questionRepo.find({
      where: { id: In(uniqueIds) },
      select: ['id', 'timesAnswered', 'timesCorrect'],
    });

    const map = new Map<number, number>();
    for (const question of questions) {
      const answered = Number(question.timesAnswered || 0);
      const correct = Number(question.timesCorrect || 0);
      const accuracy = answered > 0 ? (correct / answered) * 100 : 0;
      map.set(Number(question.id), accuracy);
    }
    return map;
  }

  private computeSnapshot({
    attemptedRecords,
    totalQuestions,
    globalQuestionMap,
  }: {
    attemptedRecords: AttemptRecord[];
    totalQuestions: number;
    globalQuestionMap: Map<number, number>;
  }): SnapshotComputation {
    const attemptedQuestions = attemptedRecords.length;
    const correctQuestions = attemptedRecords.filter((record) => record.isCorrect).length;
    const scorePercentage =
      attemptedQuestions > 0 ? (correctQuestions / attemptedQuestions) * 100 : 0;

    const timeValues = attemptedRecords.map((record) => record.timeSpentSeconds);
    const totalTime = timeValues.reduce((sum, value) => sum + value, 0);
    const avgTimeSeconds = attemptedQuestions > 0 ? totalTime / attemptedQuestions : 0;
    const medianTimeSeconds = this.computeMedian(timeValues);

    const transitionCounts = {
      cToC: 0,
      cToI: 0,
      iToC: 0,
      iToI: 0,
      unknown: 0,
    };
    for (const record of attemptedRecords) {
      if (record.transitionPattern === AnswerTransitionPattern.C_TO_C) transitionCounts.cToC += 1;
      else if (record.transitionPattern === AnswerTransitionPattern.C_TO_I) transitionCounts.cToI += 1;
      else if (record.transitionPattern === AnswerTransitionPattern.I_TO_C) transitionCounts.iToC += 1;
      else if (record.transitionPattern === AnswerTransitionPattern.I_TO_I) transitionCounts.iToI += 1;
      else transitionCounts.unknown += 1;
    }

    const knownTransitions =
      transitionCounts.cToC +
      transitionCounts.cToI +
      transitionCounts.iToC +
      transitionCounts.iToI;
    const pctCToC = knownTransitions > 0 ? (transitionCounts.cToC / knownTransitions) * 100 : 0;
    const pctCToI = knownTransitions > 0 ? (transitionCounts.cToI / knownTransitions) * 100 : 0;
    const pctIToC = knownTransitions > 0 ? (transitionCounts.iToC / knownTransitions) * 100 : 0;
    const highFlipRate =
      attemptedQuestions > 0
        ? (attemptedRecords.filter((record) => record.answerChanges >= 2).length / attemptedQuestions) *
          100
        : 0;
    const confidenceScore = this.clamp(
      50 + pctCToC * 0.4 + pctIToC * 0.2 - pctCToI * 0.6 - highFlipRate * 0.3,
      0,
      100,
    );

    const correctTimes = attemptedRecords
      .filter((record) => record.isCorrect)
      .map((record) => record.timeSpentSeconds);
    const incorrectTimes = attemptedRecords
      .filter((record) => !record.isCorrect)
      .map((record) => record.timeSpentSeconds);
    const avgCorrectTime =
      correctTimes.length > 0
        ? correctTimes.reduce((sum, value) => sum + value, 0) / correctTimes.length
        : 0;
    const avgIncorrectTime =
      incorrectTimes.length > 0
        ? incorrectTimes.reduce((sum, value) => sum + value, 0) / incorrectTimes.length
        : 0;
    const overthinkingIndex = avgIncorrectTime - avgCorrectTime;

    const timeThreshold = medianTimeSeconds || avgTimeSeconds || 0;
    const timeAccuracyQuadrants = {
      fastCorrectCount: 0,
      slowCorrectCount: 0,
      slowIncorrectCount: 0,
      fastIncorrectCount: 0,
    };
    for (const record of attemptedRecords) {
      const isFast = record.timeSpentSeconds <= timeThreshold;
      if (record.isCorrect && isFast) timeAccuracyQuadrants.fastCorrectCount += 1;
      else if (record.isCorrect && !isFast) timeAccuracyQuadrants.slowCorrectCount += 1;
      else if (!record.isCorrect && !isFast) timeAccuracyQuadrants.slowIncorrectCount += 1;
      else timeAccuracyQuadrants.fastIncorrectCount += 1;
    }

    const difficultyBase: Record<
      string,
      { attempted: number; correct: number; totalTime: number; accuracy: number; avgTimeSeconds: number }
    > = {
      easy: { attempted: 0, correct: 0, totalTime: 0, accuracy: 0, avgTimeSeconds: 0 },
      medium: { attempted: 0, correct: 0, totalTime: 0, accuracy: 0, avgTimeSeconds: 0 },
      hard: { attempted: 0, correct: 0, totalTime: 0, accuracy: 0, avgTimeSeconds: 0 },
    };
    for (const record of attemptedRecords) {
      const key = ['easy', 'medium', 'hard'].includes(record.difficulty)
        ? record.difficulty
        : 'medium';
      difficultyBase[key].attempted += 1;
      if (record.isCorrect) difficultyBase[key].correct += 1;
      difficultyBase[key].totalTime += record.timeSpentSeconds;
    }
    for (const key of Object.keys(difficultyBase)) {
      const value = difficultyBase[key];
      value.accuracy = value.attempted > 0 ? (value.correct / value.attempted) * 100 : 0;
      value.avgTimeSeconds = value.attempted > 0 ? value.totalTime / value.attempted : 0;
    }

    const fatigueSegments = this.computeFatigueSegments(attemptedRecords, totalQuestions);

    const peerComparison = {
      missedHighConsensusCount: 0,
      solvedLowConsensusCount: 0,
      questionDifficultyBreakdown: { easy: 0, medium: 0, hard: 0 },
      lowConfidence: false,
    };
    for (const record of attemptedRecords) {
      const globalAccuracy = Number(globalQuestionMap.get(record.questionId) || 0);
      if (globalAccuracy > 80) peerComparison.questionDifficultyBreakdown.easy += 1;
      else if (globalAccuracy >= 50) peerComparison.questionDifficultyBreakdown.medium += 1;
      else peerComparison.questionDifficultyBreakdown.hard += 1;

      if (!record.isCorrect && globalAccuracy >= 90) {
        peerComparison.missedHighConsensusCount += 1;
      }
      if (record.isCorrect && globalAccuracy < 50) {
        peerComparison.solvedLowConsensusCount += 1;
      }
    }

    const weaknessMap = {
      subject: this.computeDimensionSummary(
        attemptedRecords,
        (record) => record.subjectId,
        (record) => record.subjectName,
        medianTimeSeconds,
      ),
      system: this.computeDimensionSummary(
        attemptedRecords,
        (record) => record.systemId,
        (record) => record.systemName,
        medianTimeSeconds,
      ),
      topic: this.computeDimensionSummary(
        attemptedRecords,
        (record) => record.topicId,
        (record) => record.topicName,
        medianTimeSeconds,
      ),
      questionBank: this.computeDimensionSummary(
        attemptedRecords,
        (record) => record.questionBankId,
        (record) => record.questionBankName,
        medianTimeSeconds,
      ),
    };

    const insights = this.buildActionableInsights({
      attemptedQuestions,
      transitionCounts,
      timeAccuracyQuadrants,
      difficultyBase,
      peerComparison,
      fatigueSegments,
      overthinkingIndex,
      weaknessMap,
    });

    return {
      totalQuestions,
      attemptedQuestions,
      correctQuestions,
      scorePercentage,
      avgTimeSeconds,
      medianTimeSeconds,
      confidenceScore,
      overthinkingIndex,
      transitionCounts,
      timeAccuracyQuadrants,
      difficultyAnalytics: {
        easy: {
          attempted: difficultyBase.easy.attempted,
          correct: difficultyBase.easy.correct,
          accuracy: difficultyBase.easy.accuracy,
          avgTimeSeconds: difficultyBase.easy.avgTimeSeconds,
        },
        medium: {
          attempted: difficultyBase.medium.attempted,
          correct: difficultyBase.medium.correct,
          accuracy: difficultyBase.medium.accuracy,
          avgTimeSeconds: difficultyBase.medium.avgTimeSeconds,
        },
        hard: {
          attempted: difficultyBase.hard.attempted,
          correct: difficultyBase.hard.correct,
          accuracy: difficultyBase.hard.accuracy,
          avgTimeSeconds: difficultyBase.hard.avgTimeSeconds,
        },
      },
      fatigueSegments,
      peerComparison,
      weaknessMap,
      insights,
      cohortType: AnalyticsCohortType.STEP,
      cohortSize: 0,
      percentileRank: 0,
      lowConfidence: false,
    };
  }

  private computeFatigueSegments(attemptedRecords: AttemptRecord[], totalQuestions: number) {
    const segments = [0, 1, 2, 3].map((index) => ({
      label: `segment_${index + 1}`,
      range: this.computeQuartileRange(index, totalQuestions),
      attempted: 0,
      correct: 0,
      totalTime: 0,
      accuracy: 0,
      avgTimeSeconds: 0,
    }));

    for (const record of attemptedRecords) {
      const segmentIndex = Math.min(
        3,
        Math.floor(((record.displayOrder - 1) * 4) / Math.max(totalQuestions, 1)),
      );
      const segment = segments[Math.max(0, segmentIndex)];
      segment.attempted += 1;
      if (record.isCorrect) segment.correct += 1;
      segment.totalTime += record.timeSpentSeconds;
    }

    for (const segment of segments) {
      segment.accuracy = segment.attempted > 0 ? (segment.correct / segment.attempted) * 100 : 0;
      segment.avgTimeSeconds =
        segment.attempted > 0 ? segment.totalTime / segment.attempted : 0;
      delete (segment as any).totalTime;
    }

    return segments;
  }

  private computeQuartileRange(
    quartileIndex: number,
    totalQuestions: number,
  ): { start: number; end: number } {
    if (totalQuestions <= 0) {
      return { start: 0, end: 0 };
    }
    const start = Math.floor((quartileIndex * totalQuestions) / 4) + 1;
    const end =
      quartileIndex === 3
        ? totalQuestions
        : Math.floor(((quartileIndex + 1) * totalQuestions) / 4);
    return { start, end: Math.max(start, end) };
  }

  private computeDimensionSummary(
    attemptedRecords: AttemptRecord[],
    idSelector: (record: AttemptRecord) => number | null,
    nameSelector: (record: AttemptRecord) => string | null,
    medianTimeSeconds: number,
  ): any[] {
    const grouped = new Map<
      string,
      { id: string; name: string; attempted: number; correct: number; totalTimeSeconds: number }
    >();

    for (const record of attemptedRecords) {
      const id = idSelector(record);
      if (id == null) continue;
      const key = String(id);
      const current =
        grouped.get(key) ||
        ({
          id: key,
          name: nameSelector(record) || 'Unknown',
          attempted: 0,
          correct: 0,
          totalTimeSeconds: 0,
        } as const);

      const mutable = {
        ...current,
        attempted: current.attempted + 1,
        correct: current.correct + (record.isCorrect ? 1 : 0),
        totalTimeSeconds: current.totalTimeSeconds + record.timeSpentSeconds,
      };
      grouped.set(key, mutable);
    }

    return [...grouped.values()]
      .map((value) => {
        const accuracy = value.attempted > 0 ? (value.correct / value.attempted) * 100 : 0;
        const avgTimeSeconds =
          value.attempted > 0 ? value.totalTimeSeconds / value.attempted : 0;
        const lowAccuracy = accuracy < 60;
        const slowAndLowAccuracy =
          accuracy < 70 && avgTimeSeconds > Math.max(1, medianTimeSeconds) * 1.2;
        return {
          id: value.id,
          name: value.name,
          attempted: value.attempted,
          correct: value.correct,
          accuracy,
          avgTimeSeconds,
          isWeak: lowAccuracy || slowAndLowAccuracy,
        };
      })
      .sort((a, b) => a.accuracy - b.accuracy);
  }

  private buildActionableInsights(input: {
    attemptedQuestions: number;
    transitionCounts: {
      cToC: number;
      cToI: number;
      iToC: number;
      iToI: number;
      unknown: number;
    };
    timeAccuracyQuadrants: {
      fastCorrectCount: number;
      slowCorrectCount: number;
      slowIncorrectCount: number;
      fastIncorrectCount: number;
    };
    difficultyBase: Record<
      string,
      { attempted: number; correct: number; totalTime: number; accuracy: number; avgTimeSeconds: number }
    >;
    peerComparison: {
      missedHighConsensusCount: number;
      solvedLowConsensusCount: number;
      questionDifficultyBreakdown: { easy: number; medium: number; hard: number };
      lowConfidence: boolean;
    };
    fatigueSegments: Array<{ attempted: number; accuracy: number }>;
    overthinkingIndex: number;
    weaknessMap: {
      subject: any[];
      system: any[];
      topic: any[];
      questionBank: any[];
    };
  }): string[] {
    const insights: InsightCandidate[] = [];
    const {
      attemptedQuestions,
      transitionCounts,
      timeAccuracyQuadrants,
      difficultyBase,
      peerComparison,
      fatigueSegments,
      overthinkingIndex,
      weaknessMap,
    } = input;

    if (difficultyBase.easy.attempted > 0 && difficultyBase.easy.accuracy < 80) {
      insights.push({
        category: 'knowledge_gap',
        priority: 1,
        text: `Knowledge gap: your easy-question accuracy is ${difficultyBase.easy.accuracy.toFixed(1)}%. You are dropping routine points, so review core concepts and aim to make easy questions feel automatic.`,
      });
    }

    if (
      difficultyBase.easy.attempted > 0 &&
      difficultyBase.medium.attempted > 0 &&
      difficultyBase.easy.avgTimeSeconds > difficultyBase.medium.avgTimeSeconds
    ) {
      insights.push({
        category: 'time_management',
        priority: 2,
        text: `Time management: easy questions are taking ${difficultyBase.easy.avgTimeSeconds.toFixed(1)}s on average versus ${difficultyBase.medium.avgTimeSeconds.toFixed(1)}s for medium questions. Move faster on routine items so you save time for harder ones.`,
      });
    }

    if (peerComparison.missedHighConsensusCount > 0) {
      insights.push({
        category: 'careless_mistake',
        priority: 2,
        text: `Careless mistakes: you missed ${peerComparison.missedHighConsensusCount} high-consensus questions that most students answered correctly. Slow down on stem details and avoid giving away easy points.`,
      });
    }

    if (peerComparison.solvedLowConsensusCount > 0) {
      insights.push({
        category: 'strength',
        priority: 5,
        text: `Strength: you solved ${peerComparison.solvedLowConsensusCount} questions that many students missed. Your reasoning is strong on at least some difficult items, so keep building on that.`,
      });
    }

    if (overthinkingIndex > 20) {
      insights.push({
        category: 'time_management',
        priority: 2,
        text: `Time management: your incorrect answers take ${overthinkingIndex.toFixed(1)}s longer than your correct answers on average. When reasoning stalls, commit to a cleaner elimination decision instead of overworking the question.`,
      });
    }

    if (transitionCounts.cToI > transitionCounts.iToC) {
      insights.push({
        category: 'confidence',
        priority: 1,
        text: `Confidence: you changed more correct answers to wrong answers (${transitionCounts.cToI}) than wrong answers to correct ones (${transitionCounts.iToC}). If your first read was strong, avoid unnecessary answer changes.`,
      });
    }

    if (timeAccuracyQuadrants.fastIncorrectCount > timeAccuracyQuadrants.slowIncorrectCount) {
      insights.push({
        category: 'careless_mistake',
        priority: 2,
        text: `Careless mistakes: many of your misses are happening quickly. Build a brief habit of checking the stem, key qualifiers, and answer choice wording before locking in.`,
      });
    }

    if (timeAccuracyQuadrants.slowIncorrectCount > 0) {
      const slowIncorrectRate = (timeAccuracyQuadrants.slowIncorrectCount / Math.max(attemptedQuestions, 1)) * 100;
      if (slowIncorrectRate >= 20) {
        insights.push({
          category: 'knowledge_gap',
          priority: 1,
          text: `Knowledge gap: ${slowIncorrectRate.toFixed(1)}% of your questions are falling into the slow-and-incorrect zone. That usually means the concept is not secure enough yet for exam speed.`,
        });
      }
    }

    if (fatigueSegments.length > 1) {
      const first = fatigueSegments[0];
      const last = fatigueSegments[fatigueSegments.length - 1];
      if (first.attempted > 0 && last.attempted > 0 && first.accuracy - last.accuracy >= 15) {
        insights.push({
          category: 'time_management',
          priority: 2,
          text: `Fatigue: your accuracy fell from ${first.accuracy.toFixed(1)}% early in the block to ${last.accuracy.toFixed(1)}% late in the block. Work on pacing and mental resets so performance holds deeper into the test.`,
        });
      }
    }

    // Knowledge-gap insights only fire on dimensions with enough attempts to
    // be statistically meaningful. Previously a single missed topic (1/1 →
    // 0% accuracy) would surface as "weakest area at 0.0%", which confused
    // users on the performance page. Three attempts is the smallest sample
    // where a "weak" classification carries real signal.
    const MIN_INSIGHT_ATTEMPTS = 3;
    const isInsightWorthy = (item: { isWeak?: boolean; attempted?: number }) =>
      Boolean(item?.isWeak) && Number(item?.attempted || 0) >= MIN_INSIGHT_ATTEMPTS;
    const weakestDimension =
      weaknessMap.topic.find(isInsightWorthy) ||
      weaknessMap.system.find(isInsightWorthy) ||
      weaknessMap.subject.find(isInsightWorthy) ||
      weaknessMap.questionBank.find(isInsightWorthy) ||
      null;

    if (weakestDimension) {
      insights.push({
        category: 'knowledge_gap',
        priority: 1,
        text: `Knowledge gap: ${weakestDimension.name} is one of your weakest areas at ${Number(weakestDimension.accuracy || 0).toFixed(1)}% accuracy. Put it near the top of your next review session.`,
      });
    }

    if (difficultyBase.hard.attempted > 0 && difficultyBase.hard.accuracy > 60) {
      insights.push({
        category: 'strength',
        priority: 5,
        text: `Strength: your hard-question accuracy is ${difficultyBase.hard.accuracy.toFixed(1)}%. You are holding up well on difficult material.`,
      });
    }

    const deduped = new Map<string, InsightCandidate>();
    for (const insight of insights) {
      const key = insight.text.trim().toLowerCase();
      const existing = deduped.get(key);
      if (!existing || insight.priority < existing.priority) {
        deduped.set(key, insight);
      }
    }

    return [...deduped.values()]
      .sort((left, right) => left.priority - right.priority)
      .slice(0, 6)
      .map((insight) => insight.text);
  }

  private async calculatePercentile({
    testRepo,
    test,
    scorePercentage,
  }: {
    testRepo: Repository<Test>;
    test: Test;
    scorePercentage: number;
  }): Promise<{
    cohortType: AnalyticsCohortType;
    cohortSize: number;
    percentileRank: number;
    lowConfidence: boolean;
  }> {
    let cohortType = AnalyticsCohortType.BLUEPRINT;
    let lowConfidence = false;

    let cohort = test.blueprintSignature
      ? await testRepo.find({
          where: {
            step: Number(test.step),
            status: TestStatus.COMPLETED,
            blueprintSignature: test.blueprintSignature,
          },
          select: ['id', 'percentageScore', 'timeSpentSeconds'],
        })
      : [];

    if (cohort.length < 20) {
      cohortType = AnalyticsCohortType.STEP;
      lowConfidence = true;
      cohort = await testRepo.find({
        where: {
          step: Number(test.step),
          status: TestStatus.COMPLETED,
        },
        select: ['id', 'percentageScore', 'timeSpentSeconds'],
      });
    }

    if (!cohort.find((candidate) => Number(candidate.id) === Number(test.id))) {
      cohort.push({
        id: test.id,
        percentageScore: scorePercentage,
        timeSpentSeconds: Number(test.timeSpentSeconds || 0),
      } as Test);
    }

    cohort.sort((left, right) => {
      const leftScore = Number(left.percentageScore || 0);
      const rightScore = Number(right.percentageScore || 0);
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return Number(left.timeSpentSeconds || 0) - Number(right.timeSpentSeconds || 0);
    });

    const rank = Math.max(
      1,
      cohort.findIndex((candidate) => Number(candidate.id) === Number(test.id)) + 1,
    );
    const cohortSize = cohort.length;
    const percentileRank = Math.round(((cohortSize - rank) / Math.max(cohortSize, 1)) * 100);

    return {
      cohortType,
      cohortSize,
      percentileRank,
      lowConfidence,
    };
  }

  private async updateUserAggregateStats(
    manager: EntityManager,
    test: Test,
    snapshot: TestAnalyticsSnapshot,
  ) {
    const userId = Number(test.userId);
    const step = Number(test.step);
    const transitionCounts = snapshot.transitionCounts || {
      cToC: 0,
      cToI: 0,
      iToC: 0,
      iToI: 0,
      unknown: 0,
    };
    const quadrants = snapshot.timeAccuracyQuadrants || {
      fastCorrectCount: 0,
      slowCorrectCount: 0,
      slowIncorrectCount: 0,
      fastIncorrectCount: 0,
    };

    // Precompute every delta so the SQL statement is a single round-trip.
    const attempted = Number(snapshot.attemptedQuestions || 0);
    const correct = Number(snapshot.correctQuestions || 0);
    const totalTimeSeconds = Math.round(
      Number(snapshot.avgTimeSeconds || 0) * attempted,
    );
    const cToC = Number(transitionCounts.cToC || 0);
    const cToI = Number(transitionCounts.cToI || 0);
    const iToC = Number(transitionCounts.iToC || 0);
    const iToI = Number(transitionCounts.iToI || 0);
    const fastCorrect = Number(quadrants.fastCorrectCount || 0);
    const slowCorrect = Number(quadrants.slowCorrectCount || 0);
    const slowIncorrect = Number(quadrants.slowIncorrectCount || 0);
    const fastIncorrect = Number(quadrants.fastIncorrectCount || 0);
    const confidenceScore = Number(snapshot.confidenceScore || 0);
    const overthinkingIndex = Number(snapshot.overthinkingIndex || 0);

    // Atomic upsert: insert with the initial values if no row exists for
    // (userId, step), otherwise add every delta in-place. The row lock is
    // taken by Postgres on the affected row — no read-modify-write in JS,
    // so two concurrent test completions can't clobber each other.
    await manager.query(
      `INSERT INTO user_analytics_stats (
         "userId", "step",
         "testsCompleted", "questionsAttempted", "correctAnswers", "totalTimeSeconds",
         "cToCCount", "cToICount", "iToCCount", "iToICount",
         "fastCorrectCount", "slowCorrectCount", "slowIncorrectCount", "fastIncorrectCount",
         "totalConfidenceScore", "confidenceSamples",
         "totalOverthinkingIndex", "overthinkingSamples",
         "createdAt", "updatedAt"
       )
       VALUES (
         $1, $2,
         1, $3, $4, $5,
         $6, $7, $8, $9,
         $10, $11, $12, $13,
         $14, 1,
         $15, 1,
         now(), now()
       )
       ON CONFLICT ("userId", "step") DO UPDATE SET
         "testsCompleted"        = user_analytics_stats."testsCompleted"        + 1,
         "questionsAttempted"    = user_analytics_stats."questionsAttempted"    + EXCLUDED."questionsAttempted",
         "correctAnswers"        = user_analytics_stats."correctAnswers"        + EXCLUDED."correctAnswers",
         "totalTimeSeconds"      = user_analytics_stats."totalTimeSeconds"      + EXCLUDED."totalTimeSeconds",
         "cToCCount"             = user_analytics_stats."cToCCount"             + EXCLUDED."cToCCount",
         "cToICount"             = user_analytics_stats."cToICount"             + EXCLUDED."cToICount",
         "iToCCount"             = user_analytics_stats."iToCCount"             + EXCLUDED."iToCCount",
         "iToICount"             = user_analytics_stats."iToICount"             + EXCLUDED."iToICount",
         "fastCorrectCount"      = user_analytics_stats."fastCorrectCount"      + EXCLUDED."fastCorrectCount",
         "slowCorrectCount"      = user_analytics_stats."slowCorrectCount"      + EXCLUDED."slowCorrectCount",
         "slowIncorrectCount"    = user_analytics_stats."slowIncorrectCount"    + EXCLUDED."slowIncorrectCount",
         "fastIncorrectCount"    = user_analytics_stats."fastIncorrectCount"    + EXCLUDED."fastIncorrectCount",
         "totalConfidenceScore"  = user_analytics_stats."totalConfidenceScore"  + EXCLUDED."totalConfidenceScore",
         "confidenceSamples"     = user_analytics_stats."confidenceSamples"     + 1,
         "totalOverthinkingIndex"= user_analytics_stats."totalOverthinkingIndex"+ EXCLUDED."totalOverthinkingIndex",
         "overthinkingSamples"   = user_analytics_stats."overthinkingSamples"   + 1,
         "updatedAt"             = now()`,
      [
        userId, step,
        attempted, correct, totalTimeSeconds,
        cToC, cToI, iToC, iToI,
        fastCorrect, slowCorrect, slowIncorrect, fastIncorrect,
        confidenceScore,
        overthinkingIndex,
      ],
    );
  }

  private async updateUserDimensionStats(
    dimensionStatsRepo: Repository<UserDimensionStats>,
    test: Test,
    attemptedRecords: AttemptRecord[],
  ) {
    if (attemptedRecords.length === 0) {
      return;
    }

    const increments = new Map<
      string,
      {
        dimensionType: DimensionType;
        dimensionKey: string;
        dimensionName: string | null;
        attempted: number;
        correct: number;
        totalTimeSeconds: number;
        correctTimeSeconds: number;
        incorrectTimeSeconds: number;
        cToICount: number;
        iToCCount: number;
      }
    >();

    const pushIncrement = (
      dimensionType: DimensionType,
      dimensionKey: string | null,
      dimensionName: string | null,
      record: AttemptRecord,
    ) => {
      if (!dimensionKey) return;
      const mapKey = `${dimensionType}:${dimensionKey}`;
      const current =
        increments.get(mapKey) || {
          dimensionType,
          dimensionKey,
          dimensionName,
          attempted: 0,
          correct: 0,
          totalTimeSeconds: 0,
          correctTimeSeconds: 0,
          incorrectTimeSeconds: 0,
          cToICount: 0,
          iToCCount: 0,
        };
      current.attempted += 1;
      current.correct += record.isCorrect ? 1 : 0;
      current.totalTimeSeconds += record.timeSpentSeconds;
      if (record.isCorrect) current.correctTimeSeconds += record.timeSpentSeconds;
      else current.incorrectTimeSeconds += record.timeSpentSeconds;
      if (record.transitionPattern === AnswerTransitionPattern.C_TO_I) current.cToICount += 1;
      if (record.transitionPattern === AnswerTransitionPattern.I_TO_C) current.iToCCount += 1;
      if (!current.dimensionName && dimensionName) current.dimensionName = dimensionName;
      increments.set(mapKey, current);
    };

    for (const record of attemptedRecords) {
      pushIncrement(
        DimensionType.DIFFICULTY,
        record.difficulty,
        record.difficulty.toUpperCase(),
        record,
      );
      pushIncrement(
        DimensionType.SUBJECT,
        record.subjectId != null ? String(record.subjectId) : null,
        record.subjectName,
        record,
      );
      pushIncrement(
        DimensionType.SYSTEM,
        record.systemId != null ? String(record.systemId) : null,
        record.systemName,
        record,
      );
      pushIncrement(
        DimensionType.TOPIC,
        record.topicId != null ? String(record.topicId) : null,
        record.topicName,
        record,
      );
      pushIncrement(
        DimensionType.QUESTION_BANK,
        record.questionBankId != null ? String(record.questionBankId) : null,
        record.questionBankName,
        record,
      );
    }

    const userId = Number(test.userId);
    const step = Number(test.step);
    const existingRows = await dimensionStatsRepo.find({ where: { userId, step } });
    const existingMap = new Map(
      existingRows.map((row) => [
        `${row.dimensionType}:${row.dimensionKey}`,
        row,
      ]),
    );

    const rowsToSave: UserDimensionStats[] = [];
    for (const increment of increments.values()) {
      const mapKey = `${increment.dimensionType}:${increment.dimensionKey}`;
      const existing = existingMap.get(mapKey);
      if (existing) {
        existing.attempted = Number(existing.attempted || 0) + increment.attempted;
        existing.correct = Number(existing.correct || 0) + increment.correct;
        existing.totalTimeSeconds =
          Number(existing.totalTimeSeconds || 0) + increment.totalTimeSeconds;
        existing.correctTimeSeconds =
          Number(existing.correctTimeSeconds || 0) + increment.correctTimeSeconds;
        existing.incorrectTimeSeconds =
          Number(existing.incorrectTimeSeconds || 0) + increment.incorrectTimeSeconds;
        existing.cToICount = Number(existing.cToICount || 0) + increment.cToICount;
        existing.iToCCount = Number(existing.iToCCount || 0) + increment.iToCCount;
        if (!existing.dimensionName && increment.dimensionName) {
          existing.dimensionName = increment.dimensionName;
        }
        rowsToSave.push(existing);
      } else {
        rowsToSave.push(
          dimensionStatsRepo.create({
            userId,
            step,
            dimensionType: increment.dimensionType,
            dimensionKey: increment.dimensionKey,
            dimensionName: increment.dimensionName,
            attempted: increment.attempted,
            correct: increment.correct,
            totalTimeSeconds: increment.totalTimeSeconds,
            correctTimeSeconds: increment.correctTimeSeconds,
            incorrectTimeSeconds: increment.incorrectTimeSeconds,
            cToICount: increment.cToICount,
            iToCCount: increment.iToCCount,
          }),
        );
      }
    }

    if (rowsToSave.length > 0) {
      await dimensionStatsRepo.save(rowsToSave);
    }
  }

  private extractFirstSelectedOptionId(submission: QuestionSubmission): number | null {
    const fromHistory = submission.selectionHistory?.[0]?.optionId;
    if (fromHistory != null) return Number(fromHistory);

    const fromSequence = submission.answerSequence?.[0];
    if (fromSequence != null) return Number(fromSequence);

    return null;
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
    sequence: number[],
    correctOptionId: number | null,
  ): number {
    if (!correctOptionId || !sequence || sequence.length < 2) {
      return 0;
    }

    let count = 0;
    for (let i = 0; i < sequence.length - 1; i += 1) {
      const current = Number(sequence[i]);
      const next = Number(sequence[i + 1]);
      if (current === Number(correctOptionId) && next !== Number(correctOptionId)) {
        count += 1;
      }
    }
    return count;
  }

  private computeMedian(values: number[]): number {
    if (!values || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const midpoint = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
    }
    return sorted[midpoint];
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

}
