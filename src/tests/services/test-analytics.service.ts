import { Injectable, NotFoundException, BadRequestException, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Test, TestStatus } from '../../entities/test.entity';
import {
  AnswerTransitionPattern,
  QuestionSubmission,
} from '../../entities/question-submission.entity';
import { Question } from '../../entities/question.entity';
import { Subject } from '../../entities/subject.entity';
import { System } from '../../entities/system.entity';
import { Topic } from '../../entities/topic.entity';

import { ALL_EXAM_STEPS, QuestionBank } from '../../entities/question-bank.entity';
import { TestQuestion } from '../../entities/test-question.entity';
import { TestAnalyticsSnapshot } from '../../entities/test-analytics-snapshot.entity';
import {
  DimensionType,
  UserDimensionStats,
} from '../../entities/user-dimension-stats.entity';
import { UserAnalyticsStats } from '../../entities/user-analytics-stats.entity';
import { AnalyticsAggregationService } from './analytics-aggregation.service';
import { TestCreationService } from './test-creation.service';
import { User } from '../../entities/user.entity';

@Injectable()
export class TestAnalyticsService {
  private readonly defaultBlockSize = 20;

  constructor(
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
    @InjectRepository(QuestionSubmission)
    private submissionRepository: Repository<QuestionSubmission>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(Subject)
    private subjectRepository: Repository<Subject>,
    @InjectRepository(System)
    private systemRepository: Repository<System>,
    @InjectRepository(Topic)
    private topicRepository: Repository<Topic>,
    @InjectRepository(QuestionBank)
    private questionBankRepository: Repository<QuestionBank>,
    @InjectRepository(TestQuestion)
    private testQuestionRepository: Repository<TestQuestion>,
    @InjectRepository(TestAnalyticsSnapshot)
    private snapshotRepository: Repository<TestAnalyticsSnapshot>,
    @InjectRepository(UserAnalyticsStats)
    private userAnalyticsStatsRepository: Repository<UserAnalyticsStats>,
    @InjectRepository(UserDimensionStats)
    private userDimensionStatsRepository: Repository<UserDimensionStats>,
    private analyticsAggregationService: AnalyticsAggregationService,
    private testCreationService: TestCreationService,
  ) {}

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

  private async getLockedBlockBankIds(userId: number, step?: number): Promise<number[]> {
    const where: any = { isActive: true, isBlockBank: true };
    if (step) {
      where.step = step;
    }

    const banks = await this.questionBankRepository.find({
      where,
      select: ['id', 'totalQuestions', 'blockSize', 'step'],
    });

    if (banks.length === 0) {
      return [];
    }

    const bankIds = banks.map((bank) => bank.id);
    const completedCounts = await this.testRepository
      .createQueryBuilder('test')
      .select('test.blockBankId', 'bankId')
      .addSelect('COUNT(test.id)', 'count')
      .where('test.userId = :userId', { userId })
      .andWhere('test.isBlock = true')
      .andWhere('test.status = :status', { status: TestStatus.COMPLETED })
      .andWhere('test.blockBankId IN (:...bankIds)', { bankIds })
      .groupBy('test.blockBankId')
      .getRawMany<{ bankId: string; count: string }>();

    const completedMap = new Map(
      completedCounts.map((row) => [Number(row.bankId), Number(row.count)]),
    );

    return banks
      .map((bank) => {
        const effectiveBlockSize = bank.blockSize || this.defaultBlockSize;
        const totalBlocks = Math.ceil((bank.totalQuestions || 0) / effectiveBlockSize);
        if (totalBlocks <= 0) {
          return null;
        }
        const completed = completedMap.get(bank.id) || 0;
        return completed < totalBlocks ? bank.id : null;
      })
      .filter((value): value is number => Number.isFinite(value));
  }

  async getUserPerformance(userId: number, step?: number, qBankId?: number) {
    // Analytics logs removed for cleaner console

    if (qBankId) {
      const progress = await this.getBlockBankProgress(userId, qBankId);
      if (progress.bank?.isBlockBank && !progress.unlocked) {
        throw this.buildBlockLockedError({
          bankId: qBankId,
          completedBlocks: progress.completedBlocks,
          totalBlocks: progress.totalBlocks,
          step: progress.bank?.step,
        });
      }
    }

    const lockedBlockBankIds = qBankId ? [] : await this.getLockedBlockBankIds(userId, step);

    let scopedCompletedTests = await this.getScopedCompletedTests(userId, step, qBankId);
    if (!qBankId && lockedBlockBankIds.length > 0) {
      scopedCompletedTests = scopedCompletedTests.filter((test) => {
        const blockBankId = Number(test.blockBankId || 0);
        if (blockBankId && lockedBlockBankIds.includes(blockBankId)) {
          return false;
        }
        const bankIds = Array.isArray(test.filters?.questionBankIds)
          ? test.filters.questionBankIds.map((id) => Number(id))
          : [];
        if (bankIds.some((id) => lockedBlockBankIds.includes(id))) {
          return false;
        }
        return true;
      });
    }
    const scopedTestIds = new Set(scopedCompletedTests.map((test) => Number(test.id)));

    // 1. Overall Stats
    const totalCompletedTests = scopedCompletedTests.length;

    const query = this.submissionRepository
      .createQueryBuilder('sub')
      .innerJoinAndSelect('sub.question', 'question')
      .where('sub.userId = :userId', { userId });

    if (qBankId) {
      query.leftJoinAndSelect('question.options', 'options')
           .leftJoinAndSelect('question.subject', 'subject')
           .leftJoinAndSelect('question.system', 'system')
           .leftJoinAndSelect('question.topic', 'topic')
           .leftJoinAndSelect('question.questionBank', 'questionBank');
    }

    if (step) {
      query.andWhere('question.step = :step', { step: step.toString() });
    }

    if (!qBankId && lockedBlockBankIds.length > 0) {
      query.andWhere('question.questionBankId NOT IN (:...lockedBlockBankIds)', { lockedBlockBankIds });
    }

    if (qBankId) {
      if (scopedTestIds.size > 0) {
        query.andWhere('sub.testId IN (:...testIds)', { testIds: Array.from(scopedTestIds) });
      } else {
        query.andWhere('1=0'); // Ensure no results if no scoped tests match
      }
      query.andWhere('question.questionBankId = :qBankId', { qBankId });
    }

    const filteredSubmissions = await query.getMany();

    const totalAnswered = filteredSubmissions.length;
    const totalCorrect = filteredSubmissions.filter(s => s.isCorrect).length;
    const accuracy = totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 0;

    const totalChanges = filteredSubmissions.reduce((sum, s) => sum + (s.answerChanges || 0), 0);
    const avgChanges = totalAnswered > 0 ? totalChanges / totalAnswered : 0;
    
    const guessedCount = filteredSubmissions.filter(s => s.wasGuessed).length;
    const guessRate = totalAnswered > 0 ? (guessedCount / totalAnswered) * 100 : 0;

    const subjectStats = await this.groupSubmissionsExtended(filteredSubmissions, 'subjectId', this.subjectRepository);
    const systemStats = await this.groupSubmissionsExtended(filteredSubmissions, 'systemId', this.systemRepository);

    let incorrectToCorrect = 0;
    let incorrectToIncorrect = 0;
    let correctToIncorrectCount = 0;

    for (const sub of filteredSubmissions) {
      // Use the newly tracked field or fallback to sequence analysis for historical data
      if (sub.rightToWrongChanges > 0) {
        correctToIncorrectCount += sub.rightToWrongChanges;
      }
      
      if (sub.answerSequence && sub.answerSequence.length > 1) {
        // Basic heuristics for others until we add explicit fields for them too
        if (sub.isCorrect && sub.answerChanges > 0 && sub.rightToWrongChanges === 0) incorrectToCorrect++;
        if (!sub.isCorrect && sub.answerChanges > 0 && sub.rightToWrongChanges === 0) incorrectToIncorrect++;
      }
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const dailyActivityQuery = this.submissionRepository
      .createQueryBuilder('sub')
      .innerJoin('sub.question', 'question')
      .select("DATE_TRUNC('day', sub.submittedAt)", 'date')
      .addSelect('COUNT(sub.id)', 'count')
      .addSelect('SUM(CASE WHEN sub.isCorrect THEN 1 ELSE 0 END)', 'correct')
      .where('sub.userId = :userId', { userId })
      .andWhere('sub.submittedAt >= :sevenDaysAgo', { sevenDaysAgo })
      .andWhere('question.step = :step', { step: step || 1 }); // Default to step 1 for timeline if not specified

    if (qBankId) {
      if (scopedCompletedTests.length === 0) {
        dailyActivityQuery.andWhere('1=0');
      } else {
        dailyActivityQuery.andWhere('sub.testId IN (:...testIds)', {
          testIds: scopedCompletedTests.map((test) => Number(test.id)),
        });
      }
      dailyActivityQuery.andWhere('question.questionBankId = :qBankId', { qBankId });
    } else if (lockedBlockBankIds.length > 0) {
      dailyActivityQuery.andWhere('question.questionBankId NOT IN (:...lockedBlockBankIds)', {
        lockedBlockBankIds,
      });
    }

    const dailyActivity = await dailyActivityQuery
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    const totalAvailable = await this.countAvailableQuestions(step, qBankId, lockedBlockBankIds);
    if (step && !qBankId && totalCompletedTests === 0 && filteredSubmissions.length === 0) {
      await this.analyticsAggregationService.rebuildUserAggregates(userId, step);
    }

    const advancedOverview = qBankId
      ? await this.buildScopedQuestionBankAdvancedOverview(
          userId,
          step,
          qBankId,
          scopedCompletedTests,
          filteredSubmissions,
        )
      : lockedBlockBankIds.length > 0
      ? await this.buildFilteredAdvancedOverview(filteredSubmissions, totalCompletedTests)
      : await this.buildAdvancedOverview(userId, step);

    const result = {
      success: true,
      data: {
        summary: {
          totalTests: totalCompletedTests,
          questionsAnswered: totalAnswered,
          correctAnswers: totalCorrect,
          accuracy: accuracy.toFixed(1),
          avgChanges: avgChanges.toFixed(2),
          guessRate: guessRate.toFixed(1),
          qbankUsage: totalAvailable > 0 ? ((totalAnswered / totalAvailable) * 100).toFixed(1) : 0,
          totalAvailable
        },
        behavioral: {
          incorrectToCorrect,
          correctToIncorrect: correctToIncorrectCount,
          incorrectToIncorrect,
          avgTimePerQuestion: (() => {
            // Convert to numbers and filter out corrupted time values
            const allTimes = filteredSubmissions.map(s => {
              // Convert to number (handles both string and number types)
              const timeNum = typeof s.timeSpentSeconds === 'string' 
                ? parseFloat(s.timeSpentSeconds) 
                : s.timeSpentSeconds;
              return timeNum;
            });
            
            const validTimes = allTimes.filter(time => {
              // Check for valid, reasonable time values (0 to 3600 seconds = 1 hour max per question)
              return !isNaN(time) && time != null && time >= 0 && time <= 3600;
            });
            
            if (validTimes.length === 0) {
              return '0';
            }
            const avgTime = validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length;
            return avgTime.toFixed(1);
          })()
        },
        subjectStats,
        systemStats,
        timeline: dailyActivity.map(d => ({
          date: d.date,
          total: parseInt(d.count),
          correct: parseInt(d.correct),
          accuracy: d.count > 0 ? (parseInt(d.correct) / parseInt(d.count) * 100).toFixed(1) : 0
        })),
        advanced: advancedOverview,
      }
    };

    return result;
  }

  async getQBankStatistics(user: User, qBankCode: string, step: number) {
    const userId = user.id;
    const qBank = await this.questionBankRepository
      .createQueryBuilder('qb')
      .where('UPPER(qb.code) = :code', { code: qBankCode.toUpperCase() })
      .andWhere('qb.step = :step', { step })
      .getOne();

    if (!qBank) {
      throw new NotFoundException(`Question Bank with code ${qBankCode} for Step ${step} not found`);
    }

    if (qBank.isBlockBank) {
      const progress = await this.getBlockBankProgress(userId, qBank.id);
      if (!progress.unlocked) {
        throw this.buildBlockLockedError({
          bankId: qBank.id,
          completedBlocks: progress.completedBlocks,
          totalBlocks: progress.totalBlocks,
          step: qBank.step,
        });
      }
    }

    const submissions = await this.submissionRepository
      .createQueryBuilder('sub')
      .innerJoin('sub.question', 'question')
      .where('sub.userId = :userId', { userId })
      .andWhere('question.questionBankId = :qBankId', { qBankId: qBank.id })
      .getMany();

    // Source correct/incorrect/omitted/used/unused from the SAME canonical
    // question-state logic as the Create Test filters, so the two screens match
    // exactly. The previous submission-only counts under-reported "omitted":
    // questions left unanswered in a completed test have no blank submission
    // row, so this page showed e.g. 4 omitted instead of the real 124.
    // (Scoring — accuracy/answer-changes/percentile/time — stays submission-based.)
    const stateCounts = (await this.testCreationService.getQuestionCounts(
      user,
      { questionBankIds: [qBank.id] },
      step,
    )) as {
      correct: number;
      incorrect: number;
      omitted: number;
      used: number;
      unused: number;
    };
    const totalCorrect = stateCounts.correct;
    const totalIncorrect = stateCounts.incorrect;
    const totalOmitted = stateCounts.omitted;
    const totalAnswered = totalCorrect + totalIncorrect;
    const accuracy = totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 0;

    let correctToIncorrect = 0;
    let incorrectToCorrect = 0;
    let incorrectToIncorrect = 0;

    for (const sub of submissions) {
      switch (sub.answerTransitionPattern) {
        case AnswerTransitionPattern.C_TO_I:
          correctToIncorrect++;
          break;
        case AnswerTransitionPattern.I_TO_C:
          incorrectToCorrect++;
          break;
        case AnswerTransitionPattern.I_TO_I:
          incorrectToIncorrect++;
          break;
      }
    }

    const totalQuestions = qBank.totalQuestions;
    const usedCount = stateCounts.used;
    const unusedCount = stateCounts.unused;
    const usagePercentage = totalQuestions > 0 ? (usedCount / totalQuestions) * 100 : 0;

    const scopedUserTests = await this.testQuestionRepository
      .createQueryBuilder('testQuestion')
      .innerJoin('testQuestion.test', 'test')
      .innerJoin('testQuestion.question', 'question')
      .where('test.userId = :userId', { userId })
      .andWhere('test.step = :step', { step })
      .andWhere('test.status != :notStarted', { notStarted: TestStatus.NOT_STARTED })
      .andWhere('question.questionBankId = :qBankId', { qBankId: qBank.id })
      .select('test.id', 'testId')
      .addSelect('test.status', 'status')
      .distinct(true)
      .getRawMany<{ testId: string; status: TestStatus }>();

    const testsCreated = scopedUserTests.length;
    const testsCompleted = scopedUserTests.filter(
      (test) => test.status === TestStatus.COMPLETED,
    ).length;
    const suspendedTests = scopedUserTests.filter(
      (test) => test.status === TestStatus.IN_PROGRESS || test.status === TestStatus.SUSPENDED,
    ).length;

    const completedScopedTestScores = await this.testQuestionRepository
      .createQueryBuilder('testQuestion')
      .innerJoin('testQuestion.test', 'test')
      .innerJoin('testQuestion.question', 'question')
      .leftJoin(
        QuestionSubmission,
        'submission',
        'submission.testId = test.id AND submission.questionId = question.id AND submission.userId = test.userId',
      )
      .where('test.step = :step', { step })
      .andWhere('test.status = :status', { status: TestStatus.COMPLETED })
      .andWhere('question.questionBankId = :qBankId', { qBankId: qBank.id })
      .select('test.id', 'testId')
      .addSelect('test.userId', 'userId')
      .addSelect('COUNT(testQuestion.id)', 'questionCount')
      .addSelect(
        'SUM(CASE WHEN submission.isCorrect = true THEN 1 ELSE 0 END)',
        'correctCount',
      )
      .groupBy('test.id')
      .addGroupBy('test.userId')
      .getRawMany<{
        testId: string;
        userId: string;
        questionCount: string;
        correctCount: string | null;
      }>();

    const perUserAverageScores = new Map<number, number[]>();

    for (const row of completedScopedTestScores) {
      const questionCount = Number(row.questionCount || 0);
      if (!Number.isFinite(questionCount) || questionCount <= 0) {
        continue;
      }

      const correctCount = Number(row.correctCount || 0);
      const userIdKey = Number(row.userId);
      const scopedScore = (correctCount / questionCount) * 100;
      const existingScores = perUserAverageScores.get(userIdKey) || [];
      existingScores.push(scopedScore);
      perUserAverageScores.set(userIdKey, existingScores);
    }

    const peerScores = [...perUserAverageScores.values()]
      .map((scores) => scores.reduce((sum, value) => sum + value, 0) / scores.length)
      .filter((score) => Number.isFinite(score));

    const userPeerScoreValues = perUserAverageScores.get(userId) || [];
    const userPeerScore =
      userPeerScoreValues.length > 0
        ? userPeerScoreValues.reduce((sum, value) => sum + value, 0) / userPeerScoreValues.length
        : null;
    const medianScore = this.computeMedian(peerScores);
    const percentileRank =
      userPeerScore == null || peerScores.length < 2
        ? 0
        : this.computeRankBasedPercentile(userPeerScore, peerScores);
    const medianPercentile =
      peerScores.length < 2
        ? 0
        : Math.round(this.computeRankBasedPercentile(medianScore, peerScores));

    // Time-spent averages must compare against the SAME peer cohort as the
    // percentile/median above: answered questions from COMPLETED tests of this
    // bank/step. Joining through `test` also excludes contest-only submissions
    // (testId null), keeping the user vs. peers comparison apples-to-apples.
    const yourTimeResult = await this.submissionRepository
      .createQueryBuilder('sub')
      .innerJoin('sub.question', 'question')
      .innerJoin(Test, 'test', 'test.id = sub.testId')
      .where('question.questionBankId = :qBankId', { qBankId: qBank.id })
      .andWhere('test.step = :step', { step })
      .andWhere('test.status = :status', { status: TestStatus.COMPLETED })
      .andWhere('sub.userId = :userId', { userId })
      .andWhere('sub.selectedOptionId IS NOT NULL')
      .select('AVG(COALESCE(sub.timeSpentSeconds, 0))', 'avgTime')
      .getRawOne<{ avgTime: string | null }>();
    const yourAverageTimeSpent = Math.round(this.toSafeNumber(yourTimeResult?.avgTime));

    const othersTimeResult = await this.submissionRepository
      .createQueryBuilder('sub')
      .innerJoin('sub.question', 'question')
      .innerJoin(Test, 'test', 'test.id = sub.testId')
      .where('question.questionBankId = :qBankId', { qBankId: qBank.id })
      .andWhere('test.step = :step', { step })
      .andWhere('test.status = :status', { status: TestStatus.COMPLETED })
      .andWhere('sub.userId != :userId', { userId })
      .andWhere('sub.selectedOptionId IS NOT NULL')
      .select('AVG(COALESCE(sub.timeSpentSeconds, 0))', 'avgTime')
      .getRawOne<{ avgTime: string | null }>();
    const othersAverageTimeSpent = Math.round(this.toSafeNumber(othersTimeResult?.avgTime));

    return {
      success: true,
      data: {
        qBankName: qBank.name,
        score: {
          percentage: accuracy.toFixed(1),
          totalCorrect,
          totalIncorrect,
          totalOmitted,
        },
        answerChanges: {
          correctToIncorrect,
          incorrectToCorrect,
          incorrectToIncorrect,
        },
        usage: {
          percentage: usagePercentage.toFixed(1),
          usedQuestions: usedCount,
          unusedQuestions: unusedCount,
          totalQuestions: totalQuestions,
        },
        testCount: {
          created: testsCreated,
          completed: testsCompleted,
          suspended: suspendedTests,
        },
        percentileRank,
        medianScore: Number(medianScore.toFixed(1)),
        medianPercentile,
        yourAverageTimeSpent,
        othersAverageTimeSpent,
      }
    };
  }

  async getTestResults(id: any, userId: number): Promise<any> {
    const testId = this.parseAndValidateId(id);
    const test = await this.testRepository.findOne({
      where: { id: testId, userId },
    });

    if (!test) {
      throw new NotFoundException('No results found for this id');
    }

    if (test.status !== TestStatus.COMPLETED && test.status !== TestStatus.SUSPENDED) {
      throw new BadRequestException('Test is not completed yet');
    }

    if (test.isBlock && test.blockBankId) {
      const progress = await this.getBlockBankProgress(userId, test.blockBankId);
      if (progress.bank?.isBlockBank && !progress.unlocked) {
        throw this.buildBlockLockedError({
          bankId: test.blockBankId,
          completedBlocks: progress.completedBlocks,
          totalBlocks: progress.totalBlocks,
          step: test.step,
        });
      }
    }

    const [submissions, testQuestions] = await Promise.all([
      this.submissionRepository.find({
        where: { userId, testId },
        relations: ['question', 'question.options'],
      }),
      this.testQuestionRepository.find({
        where: { testId },
        relations: ['question', 'question.options'],
      })
    ]);

    const analytics = {
      overall: {
        totalQuestions: test.totalQuestions,
        answeredQuestions: test.answeredQuestions,
        correctAnswers: test.correctAnswers,
        percentageScore: test.percentageScore,
        timeSpentSeconds: test.timeSpentSeconds,
        averageTimePerQuestion: test.answeredQuestions > 0 ? test.timeSpentSeconds / test.answeredQuestions : 0,
      },
      byDifficulty: this.groupSubmissions(testQuestions, submissions, 'difficulty'),
      bySubject: this.groupSubmissions(testQuestions, submissions, 'subjectId'),
      bySystem: this.groupSubmissions(testQuestions, submissions, 'systemId'),
    };

    await this.analyticsAggregationService.processTestIfNeeded(testId).catch(() => null);
    const snapshot = await this.snapshotRepository.findOne({ where: { testId } });
    const advancedAnalytics = this.analyticsAggregationService.mapSnapshotToResponse(snapshot);

    return {
      test,
      analytics,
      advancedAnalytics,
      analyticsProcessingComplete: Boolean(
        advancedAnalytics && (snapshot || advancedAnalytics?.metadata?.computedAt),
      ),
    };
  }

  private async getScopedCompletedTests(userId: number, step?: number, qBankId?: number): Promise<Test[]> {
    const query = this.testRepository
      .createQueryBuilder('test')
      .where('test.userId = :userId', { userId })
      .andWhere('test.status IN (:...statuses)', { statuses: [TestStatus.COMPLETED, TestStatus.SUSPENDED] })
      .orderBy('COALESCE(test.completedAt, test.updatedAt)', 'DESC');

    if (step) {
      query.andWhere('test.step = :step', { step });
    }

    if (qBankId) {
      query.andWhere(`test.filters::jsonb->'questionBankIds' @> :qBankId::jsonb`, {
        qBankId: JSON.stringify([qBankId]),
      });
    }

    return query.getMany();
  }

  private async countCompletedTests(userId: number, step?: number, qBankId?: number): Promise<number> {
    const scopedTests = await this.getScopedCompletedTests(userId, step, qBankId);
    return scopedTests.length;
  }

  private async countAvailableQuestions(
    step?: number,
    qBankId?: number,
    excludeBankIds: number[] = [],
  ): Promise<number> {
    if (qBankId) {
      return this.questionRepository.count({
        where: {
          isActive: true,
          questionBankId: qBankId,
          ...(step ? { step } : {}),
        },
      });
    }

    const query = this.questionRepository
      .createQueryBuilder('question')
      .where('question.isActive = :isActive', { isActive: true });

    if (step) {
      query.andWhere('question.step = :step', { step });
    } else {
      query.andWhere('question.step IN (:...steps)', { steps: ALL_EXAM_STEPS });
    }

    if (excludeBankIds.length > 0) {
      query.andWhere('question.questionBankId NOT IN (:...excludeBankIds)', { excludeBankIds });
    }

    return query.getCount();
  }

  private async resolveDimensionNameMaps(submissions: QuestionSubmission[]) {
    const subjectIds = new Set<number>();
    const systemIds = new Set<number>();
    const topicIds = new Set<number>();
    const questionBankIds = new Set<number>();

    for (const submission of submissions) {
      const question = submission.question;
      if (!question) continue;

      const subjectId = Number(question.subjectId ?? question.subject?.id ?? 0);
      if (subjectId) subjectIds.add(subjectId);

      const systemId = Number(question.systemId ?? question.system?.id ?? 0);
      if (systemId) systemIds.add(systemId);

      const topicId = Number(question.topicId ?? question.topic?.id ?? 0);
      if (topicId) topicIds.add(topicId);

      const questionBankId = Number(question.questionBankId ?? question.questionBank?.id ?? 0);
      if (questionBankId) questionBankIds.add(questionBankId);
    }

    const topics = topicIds.size > 0
      ? await this.topicRepository.find({ where: { id: In([...topicIds]) } })
      : [];

    for (const topic of topics) {
      const systemId = Number(topic.systemId || 0);
      if (systemId) systemIds.add(systemId);
    }

    const [subjects, systems, banks] = await Promise.all([
      subjectIds.size > 0
        ? this.subjectRepository.find({ where: { id: In([...subjectIds]) } })
        : Promise.resolve([]),
      systemIds.size > 0
        ? this.systemRepository.find({ where: { id: In([...systemIds]) } })
        : Promise.resolve([]),
      questionBankIds.size > 0
        ? this.questionBankRepository.find({ where: { id: In([...questionBankIds]) } })
        : Promise.resolve([]),
    ]);

    return {
      subjectMap: new Map(subjects.map((item) => [Number(item.id), item.name])),
      systemMap: new Map(systems.map((item) => [Number(item.id), item.name])),
      topicMap: new Map(topics.map((item) => [Number(item.id), item.name])),
      topicSystemMap: new Map(topics.map((item) => [Number(item.id), Number(item.systemId || 0)])),
      questionBankMap: new Map(banks.map((item) => [Number(item.id), item.name])),
    };
  }

  private async buildFilteredAdvancedOverview(
    submissions: QuestionSubmission[],
    totalCompletedTests: number,
  ) {
    const attemptedSubmissions = submissions.filter(
      (submission) => submission.selectedOptionId != null && submission.question,
    );

    const nameMaps = await this.resolveDimensionNameMaps(attemptedSubmissions);

    const attemptedQuestions = attemptedSubmissions.length;
    const correctAnswers = attemptedSubmissions.filter((submission) => submission.isCorrect).length;
    const totalTimeSeconds = attemptedSubmissions.reduce(
      (sum, submission) => sum + this.toSafeNumber(submission.timeSpentSeconds),
      0,
    );
    const averageTimeSeconds =
      attemptedQuestions > 0 ? totalTimeSeconds / attemptedQuestions : 0;
    const medianTimeSeconds = this.computeMedian(
      attemptedSubmissions.map((submission) => this.toSafeNumber(submission.timeSpentSeconds)),
    );

    const transitions = {
      cToC: 0,
      cToI: 0,
      iToC: 0,
      iToI: 0,
      unknown: 0,
      total: 0,
    };

    const quadrants = {
      fastCorrectCount: 0,
      slowCorrectCount: 0,
      slowIncorrectCount: 0,
      fastIncorrectCount: 0,
    };

    const dimensions = {
      difficulty: new Map<string, any>(),
      subject: new Map<string, any>(),
      system: new Map<string, any>(),
      topic: new Map<string, any>(),
      questionBank: new Map<string, any>(),
    };

    let incorrectTimeSum = 0;
    let incorrectTimeCount = 0;
    let correctTimeSum = 0;
    let correctTimeCount = 0;
    let missedHighConsensusCount = 0;
    let solvedLowConsensusCount = 0;
    const peerDifficultyBreakdown = { easy: 0, medium: 0, hard: 0 };

    for (const submission of attemptedSubmissions) {
      const transitionPattern = this.resolveTransitionPattern(submission);
      if (transitionPattern === AnswerTransitionPattern.C_TO_C) transitions.cToC += 1;
      else if (transitionPattern === AnswerTransitionPattern.C_TO_I) transitions.cToI += 1;
      else if (transitionPattern === AnswerTransitionPattern.I_TO_C) transitions.iToC += 1;
      else if (transitionPattern === AnswerTransitionPattern.I_TO_I) transitions.iToI += 1;
      else transitions.unknown += 1;

      const timeSpentSeconds = this.toSafeNumber(submission.timeSpentSeconds);
      const threshold = medianTimeSeconds || averageTimeSeconds || 0;
      const isFast = timeSpentSeconds <= threshold;
      if (submission.isCorrect && isFast) quadrants.fastCorrectCount += 1;
      else if (submission.isCorrect) quadrants.slowCorrectCount += 1;
      else if (isFast) quadrants.fastIncorrectCount += 1;
      else quadrants.slowIncorrectCount += 1;

      if (submission.isCorrect) {
        correctTimeSum += timeSpentSeconds;
        correctTimeCount += 1;
      } else {
        incorrectTimeSum += timeSpentSeconds;
        incorrectTimeCount += 1;
      }
      const question = submission.question;
      const questionDifficulty = String(question?.difficulty || 'medium').toLowerCase();
      const difficultyKey = ['easy', 'medium', 'hard'].includes(questionDifficulty)
        ? questionDifficulty
        : 'medium';

      this.incrementDimensionMetric(dimensions.difficulty, {
        key: difficultyKey,
        name: difficultyKey.toUpperCase(),
        isCorrect: submission.isCorrect,
        timeSpentSeconds,
        transitionPattern,
      });
      const subjectId = question?.subjectId ?? question?.subject?.id ?? null;
      const subjectKey = subjectId != null ? Number(subjectId) : null;
      const subjectName =
        subjectKey != null ? nameMaps.subjectMap.get(subjectKey) : undefined;
      this.incrementDimensionMetric(dimensions.subject, {
        key: subjectKey,
        name: subjectName ?? question?.subject?.name,
        isCorrect: submission.isCorrect,
        timeSpentSeconds,
        transitionPattern,
      });
      const systemId = question?.systemId ?? question?.system?.id ?? null;
      const topicIdForSystem = question?.topicId ?? question?.topic?.id ?? null;
      const systemKey = systemId != null
        ? Number(systemId)
        : topicIdForSystem != null
          ? nameMaps.topicSystemMap.get(Number(topicIdForSystem)) || null
          : null;
      const systemName =
        systemKey != null ? nameMaps.systemMap.get(systemKey) : undefined;
      this.incrementDimensionMetric(dimensions.system, {
        key: systemKey,
        name: systemName ?? question?.system?.name,
        isCorrect: submission.isCorrect,
        timeSpentSeconds,
        transitionPattern,
      });
      const topicId = question?.topicId ?? question?.topic?.id ?? null;
      const topicKey = topicId != null ? Number(topicId) : null;
      const topicName = topicKey != null ? nameMaps.topicMap.get(topicKey) : undefined;
      this.incrementDimensionMetric(dimensions.topic, {
        key: topicKey,
        name: topicName ?? question?.topic?.name,
        isCorrect: submission.isCorrect,
        timeSpentSeconds,
        transitionPattern,
      });
      const questionBankId =
        question?.questionBankId ?? question?.questionBank?.id ?? null;
      const questionBankKey = questionBankId != null ? Number(questionBankId) : null;
      const questionBankName =
        questionBankKey != null ? nameMaps.questionBankMap.get(questionBankKey) : undefined;
      this.incrementDimensionMetric(dimensions.questionBank, {
        key: questionBankKey,
        name: questionBankName ?? question?.questionBank?.name,
        isCorrect: submission.isCorrect,
        timeSpentSeconds,
        transitionPattern,
      });

      const globalAccuracy = this.getGlobalAccuracy(submission);
      if (globalAccuracy > 80) peerDifficultyBreakdown.easy += 1;
      else if (globalAccuracy >= 50) peerDifficultyBreakdown.medium += 1;
      else peerDifficultyBreakdown.hard += 1;

      if (!submission.isCorrect && globalAccuracy >= 90) {
        missedHighConsensusCount += 1;
      }
      if (submission.isCorrect && globalAccuracy < 50) {
        solvedLowConsensusCount += 1;
      }
    }

    transitions.total =
      transitions.cToC +
      transitions.cToI +
      transitions.iToC +
      transitions.iToI +
      transitions.unknown;

    const confidenceScore =
      this.computeTransitionConfidenceScore(transitions, attemptedSubmissions);
    const avgCorrectTime = correctTimeCount > 0 ? correctTimeSum / correctTimeCount : 0;
    const avgIncorrectTime = incorrectTimeCount > 0 ? incorrectTimeSum / incorrectTimeCount : 0;
    const overthinkingIndex = avgIncorrectTime - avgCorrectTime;

    const difficultyMetrics = this.finalizeDimensionMetrics(
      dimensions.difficulty,
      averageTimeSeconds,
    );
    const subjectMetrics = this.finalizeDimensionMetrics(dimensions.subject, averageTimeSeconds);
    const systemMetrics = this.finalizeDimensionMetrics(dimensions.system, averageTimeSeconds);
    const topicMetrics = this.finalizeDimensionMetrics(dimensions.topic, averageTimeSeconds);
    const questionBankMetrics = this.finalizeDimensionMetrics(
      dimensions.questionBank,
      averageTimeSeconds,
    );

    const difficultyAnalytics = ['easy', 'medium', 'hard'].reduce(
      (acc, difficulty) => {
        const metric = difficultyMetrics.find((item) => item.key === difficulty);
        acc[difficulty] = {
          attempted: Number(metric?.attempted || 0),
          correct: Number(metric?.correct || 0),
          accuracy: Number(metric?.accuracy || 0),
          avgTimeSeconds: Number(metric?.avgTimeSeconds || 0),
        };
        return acc;
      },
      {} as Record<
        string,
        { attempted: number; correct: number; accuracy: number; avgTimeSeconds: number }
      >,
    );

    const fatigueSegments: Array<{ attempted: number; accuracy: number }> = [];
    const peerComparison = {
      missedHighConsensusCount,
      solvedLowConsensusCount,
      questionDifficultyBreakdown: peerDifficultyBreakdown,
      lowConfidence: false,
    };
    const weaknessMap = {
      difficulty: difficultyMetrics.filter((item) => item.isWeak),
      subject: subjectMetrics.filter((item) => item.isWeak),
      system: systemMetrics.filter((item) => item.isWeak),
      topic: topicMetrics.filter((item) => item.isWeak),
      questionBank: questionBankMetrics.filter((item) => item.isWeak),
    };

    return {
      summary: {
        testsCompleted: totalCompletedTests,
        questionsAttempted: attemptedQuestions,
        correctAnswers,
        accuracy:
          attemptedQuestions > 0 ? Number(((correctAnswers / attemptedQuestions) * 100).toFixed(2)) : 0,
        averageTimeSeconds: Number(averageTimeSeconds.toFixed(2)),
        confidenceScore: Number(confidenceScore.toFixed(2)),
        overthinkingIndex: Number(overthinkingIndex.toFixed(2)),
      },
      transitions,
      timeAccuracyQuadrants: quadrants,
      dimensions: {
        difficulty: difficultyMetrics,
        subject: subjectMetrics,
        system: systemMetrics,
        topic: topicMetrics,
        questionBank: questionBankMetrics,
      },
      weaknessMap,
      latestPercentile: null,
      recentInsights: this.buildFilteredInsights({
        attemptedQuestions,
        transitions,
        quadrants,
        difficultyAnalytics,
        peerComparison,
        fatigueSegments,
        overthinkingIndex,
        weaknessMap,
      }),
      metadata: {
        totalSnapshots: 0,
        lastComputedAt: null,
      },
    };
  }

  private async buildScopedQuestionBankAdvancedOverview(
    userId: number,
    step: number | undefined,
    qBankId: number,
    scopedTests: Test[],
    submissions: QuestionSubmission[],
  ) {
    const baseOverview = await this.buildFilteredAdvancedOverview(
      submissions,
      scopedTests.length,
    );
    if (scopedTests.length === 0) {
      return baseOverview;
    }

    const snapshots = await this.snapshotRepository.find({
      where: {
        userId,
        ...(step ? { step } : {}),
        testId: In(scopedTests.map((test) => Number(test.id))),
      },
      order: { computedAt: 'DESC' },
      take: 20,
    });

    if (snapshots.length === 0) {
      return baseOverview;
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
        acc.totalTimeSeconds +=
          Number(snapshot.avgTimeSeconds || 0) * Number(snapshot.attemptedQuestions || 0);
        acc.cToC += Number(transitionCounts.cToC || 0);
        acc.cToI += Number(transitionCounts.cToI || 0);
        acc.iToC += Number(transitionCounts.iToC || 0);
        acc.iToI += Number(transitionCounts.iToI || 0);
        acc.unknown += Number(transitionCounts.unknown || 0);
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
        cToC: 0,
        cToI: 0,
        iToC: 0,
        iToI: 0,
        unknown: 0,
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

    const transitionTotal =
      aggregated.cToC +
      aggregated.cToI +
      aggregated.iToC +
      aggregated.iToI +
      aggregated.unknown;
    // (accuracy and averageTimeSeconds intentionally dropped — they were only
    // used to override truthful cumulative values on the return summary, which
    // caused the "questions attempted = 582" capping bug. baseOverview.summary
    // already carries the right values.)
    const recentInsights = this.filterStaleInsights(
      snapshots
        .flatMap((snapshot) => snapshot.insights || [])
        .filter(Boolean),
    ).slice(0, 10);
    const latestPercentile = await this.computeLatestScopedQuestionBankPercentile(
      qBankId,
      step,
      scopedTests,
    );

    // CRITICAL FIX:
    // baseOverview.summary already contains the TRUTHFUL cumulative counts
    // (testsCompleted / questionsAttempted / correctAnswers / accuracy /
    // averageTimeSeconds), computed from ALL of the user's filtered
    // submissions and tests for this bank — no `take` cap.
    //
    // The `aggregated` object below is derived from at most 20 of the most
    // recent test_analytics_snapshots (`take: 20` above). Those 20 snapshots
    // are only meaningful for trend-style metrics that don't have a
    // pre-aggregated rollup table — confidenceScore and overthinkingIndex.
    //
    // Previously this return also overrode testsCompleted /
    // questionsAttempted / correctAnswers / accuracy / averageTimeSeconds
    // with the snapshot-capped sums, so a user who had taken e.g. 40 tests
    // in one bank would see "questions attempted = 582" when the real total
    // was ~1,200. Now we only let `aggregated` win for the metrics that
    // genuinely want the recent trend.
    // `baseOverview` (from buildFilteredAdvancedOverview) already exposes
    // truthful, full-history `transitions` and `timeAccuracyQuadrants`
    // computed from every filtered submission — NOT capped at 20 snapshots.
    // The spread below carries those through unchanged. We only override
    // confidenceScore / overthinkingIndex because those genuinely live in
    // snapshots and have no equivalent cumulative rollup in the submissions
    // path.
    //
    // (Previously we re-wrote transitions/quadrants from the snapshot-capped
    //  `aggregated` object, producing the same "questions attempted = 582"
    //  class of bug for transition/quadrant counts. Same fix as the summary
    //  counts above.)
    void transitionTotal; // kept locally for any downstream debugging
    return {
      ...baseOverview,
      summary: {
        ...baseOverview.summary,
        confidenceScore:
          aggregated.confidenceSamples > 0
            ? Number((aggregated.totalConfidenceScore / aggregated.confidenceSamples).toFixed(2))
            : 0,
        overthinkingIndex:
          aggregated.overthinkingSamples > 0
            ? Number((aggregated.totalOverthinkingIndex / aggregated.overthinkingSamples).toFixed(2))
            : 0,
      },
      latestPercentile,
      recentInsights,
      metadata: {
        totalSnapshots: snapshots.length,
        lastComputedAt: snapshots[0].computedAt,
      },
    };
  }

  private groupSubmissions(testQuestions: TestQuestion[], submissions: QuestionSubmission[], groupBy: string): any {
    // 1. Group ALL questions in the test by category (the denominator)
    const groupedTotals = testQuestions.reduce((acc, tq) => {
      const key = tq.question?.[groupBy];
      if (key) {
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // 2. Group correctly answered submissions by category (the numerator)
    const groupedCorrect = submissions.reduce((acc, sub) => {
      const key = sub.question?.[groupBy];
      if (key && sub.isCorrect) {
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // 3. Map to final results
    return Object.entries(groupedTotals).map(([key, total]) => {
      const correct = groupedCorrect[key] || 0;
      return {
        [groupBy]: key,
        total: total,
        correct: correct,
        percentage: ((correct / total) * 100).toFixed(2),
      };
    });
  }

  private async groupSubmissionsExtended(submissions: QuestionSubmission[], groupBy: string, repository: Repository<any>): Promise<any> {
    const grouped = submissions.reduce((acc, sub) => {
      const key = sub.question[groupBy];
      if (!key) return acc;
      if (!acc[key]) {
        acc[key] = { total: 0, correct: 0 };
      }
      acc[key].total += 1;
      if (sub.isCorrect) {
        acc[key].correct += 1;
      }
      return acc;
    }, {});

    // ✅ Batch load all entities at once instead of N+1 queries
    const ids = Object.keys(grouped).map(id => parseInt(id));
    
    if (ids.length === 0) {
      return [];
    }
    
    const entities = await repository.find({
      where: { id: In(ids) }
    });
    
    // Create a lookup map for O(1) access
    const entityMap = new Map(entities.map(e => [e.id, e]));
    
    // Map results using the lookup
    const results = Object.entries(grouped).map(([key, value]: [string, any]) => {
      const entity = entityMap.get(parseInt(key));
      return {
        id: key,
        name: entity?.name || 'Unknown',
        total: value.total,
        correct: value.correct,
        percentage: ((value.correct / value.total) * 100).toFixed(1),
      };
    });

    return results.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
  }

  private async backfillDimensionNames(rows: UserDimensionStats[]) {
    const pending = rows.filter(
      (row) => !row.dimensionName || row.dimensionName === 'Unknown',
    );
    if (pending.length === 0) return;

    const idsByType = new Map<DimensionType, number[]>();
    for (const row of pending) {
      const id = Number(row.dimensionKey);
      if (!Number.isFinite(id)) continue;
      const list = idsByType.get(row.dimensionType) || [];
      list.push(id);
      idsByType.set(row.dimensionType, list);
    }

    const [subjects, systems, topics, banks] = await Promise.all([
      idsByType.get(DimensionType.SUBJECT)?.length
        ? this.subjectRepository.find({ where: { id: In(idsByType.get(DimensionType.SUBJECT)!) } })
        : Promise.resolve([]),
      idsByType.get(DimensionType.SYSTEM)?.length
        ? this.systemRepository.find({ where: { id: In(idsByType.get(DimensionType.SYSTEM)!) } })
        : Promise.resolve([]),
      idsByType.get(DimensionType.TOPIC)?.length
        ? this.topicRepository.find({ where: { id: In(idsByType.get(DimensionType.TOPIC)!) } })
        : Promise.resolve([]),
      idsByType.get(DimensionType.QUESTION_BANK)?.length
        ? this.questionBankRepository.find({ where: { id: In(idsByType.get(DimensionType.QUESTION_BANK)!) } })
        : Promise.resolve([]),
    ]);

    const subjectMap = new Map(subjects.map((item) => [Number(item.id), item.name]));
    const systemMap = new Map(systems.map((item) => [Number(item.id), item.name]));
    const topicMap = new Map(topics.map((item) => [Number(item.id), item.name]));
    const bankMap = new Map(banks.map((item) => [Number(item.id), item.name]));

    const toSave: UserDimensionStats[] = [];
    for (const row of pending) {
      const id = Number(row.dimensionKey);
      if (!Number.isFinite(id)) continue;
      let resolved: string | undefined;
      if (row.dimensionType === DimensionType.SUBJECT) resolved = subjectMap.get(id);
      if (row.dimensionType === DimensionType.SYSTEM) resolved = systemMap.get(id);
      if (row.dimensionType === DimensionType.TOPIC) resolved = topicMap.get(id);
      if (row.dimensionType === DimensionType.QUESTION_BANK) resolved = bankMap.get(id);
      if (resolved) {
        row.dimensionName = resolved;
        toSave.push(row);
      }
    }

    if (toSave.length > 0) {
      await this.userDimensionStatsRepository.save(toSave);
    }
  }

  private async buildAdvancedOverview(userId: number, step?: number) {
    const statsRows = await this.userAnalyticsStatsRepository.find({
      where: step ? { userId, step } : { userId },
    });
    const snapshots = await this.snapshotRepository.find({
      where: step ? { userId, step } : { userId },
      order: { computedAt: 'DESC' },
      take: 20,
    });
    const dimensionRows = await this.userDimensionStatsRepository.find({
      where: step ? { userId, step } : { userId },
    });

    await this.backfillDimensionNames(dimensionRows);

    const aggregated = statsRows.reduce(
      (acc, row) => {
        acc.testsCompleted += Number(row.testsCompleted || 0);
        acc.questionsAttempted += Number(row.questionsAttempted || 0);
        acc.correctAnswers += Number(row.correctAnswers || 0);
        acc.totalTimeSeconds += Number(row.totalTimeSeconds || 0);
        acc.cToCCount += Number(row.cToCCount || 0);
        acc.cToICount += Number(row.cToICount || 0);
        acc.iToCCount += Number(row.iToCCount || 0);
        acc.iToICount += Number(row.iToICount || 0);
        acc.fastCorrectCount += Number(row.fastCorrectCount || 0);
        acc.slowCorrectCount += Number(row.slowCorrectCount || 0);
        acc.slowIncorrectCount += Number(row.slowIncorrectCount || 0);
        acc.fastIncorrectCount += Number(row.fastIncorrectCount || 0);
        acc.totalConfidenceScore += Number(row.totalConfidenceScore || 0);
        acc.confidenceSamples += Number(row.confidenceSamples || 0);
        acc.totalOverthinkingIndex += Number(row.totalOverthinkingIndex || 0);
        acc.overthinkingSamples += Number(row.overthinkingSamples || 0);
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

    const transitionTotal =
      aggregated.cToCCount +
      aggregated.cToICount +
      aggregated.iToCCount +
      aggregated.iToICount;
    const accuracy =
      aggregated.questionsAttempted > 0
        ? (aggregated.correctAnswers / aggregated.questionsAttempted) * 100
        : 0;
    const avgTime =
      aggregated.questionsAttempted > 0
        ? aggregated.totalTimeSeconds / aggregated.questionsAttempted
        : 0;

    const dimensionsByType = (dimensionType: DimensionType) =>
      dimensionRows
        .filter((row) => row.dimensionType === dimensionType)
        .map((row) => {
          const attempted = Number(row.attempted || 0);
          const correct = Number(row.correct || 0);
          const totalTimeSeconds = Number(row.totalTimeSeconds || 0);
          const dimensionAccuracy = attempted > 0 ? (correct / attempted) * 100 : 0;
          const dimensionAvgTime = attempted > 0 ? totalTimeSeconds / attempted : 0;
          const isWeak =
            dimensionAccuracy < 60 ||
            (dimensionAccuracy < 70 && dimensionAvgTime > Math.max(avgTime, 1) * 1.2);
          return {
            key: row.dimensionKey,
            name: row.dimensionName || row.dimensionKey,
            attempted,
            correct,
            accuracy: Number(dimensionAccuracy.toFixed(2)),
            avgTimeSeconds: Number(dimensionAvgTime.toFixed(2)),
            cToICount: Number(row.cToICount || 0),
            iToCCount: Number(row.iToCCount || 0),
            isWeak,
          };
        })
        .sort((left, right) => left.accuracy - right.accuracy);

    const recentInsights = this.filterStaleInsights(
      snapshots
        .flatMap((snapshot) => snapshot.insights || [])
        .filter(Boolean),
    ).slice(0, 10);
    const difficultyDimensions = dimensionsByType(DimensionType.DIFFICULTY);
    const subjectDimensions = dimensionsByType(DimensionType.SUBJECT);
    const systemDimensions = dimensionsByType(DimensionType.SYSTEM);
    const topicDimensions = dimensionsByType(DimensionType.TOPIC);
    const questionBankDimensions = dimensionsByType(DimensionType.QUESTION_BANK);

    return {
      summary: {
        testsCompleted: aggregated.testsCompleted,
        questionsAttempted: aggregated.questionsAttempted,
        correctAnswers: aggregated.correctAnswers,
        accuracy: Number(accuracy.toFixed(2)),
        averageTimeSeconds: Number(avgTime.toFixed(2)),
        confidenceScore:
          aggregated.confidenceSamples > 0
            ? Number((aggregated.totalConfidenceScore / aggregated.confidenceSamples).toFixed(2))
            : 0,
        overthinkingIndex:
          aggregated.overthinkingSamples > 0
            ? Number((aggregated.totalOverthinkingIndex / aggregated.overthinkingSamples).toFixed(2))
            : 0,
      },
      transitions: {
        cToC: aggregated.cToCCount,
        cToI: aggregated.cToICount,
        iToC: aggregated.iToCCount,
        iToI: aggregated.iToICount,
        total: transitionTotal,
      },
      timeAccuracyQuadrants: {
        fastCorrectCount: aggregated.fastCorrectCount,
        slowCorrectCount: aggregated.slowCorrectCount,
        slowIncorrectCount: aggregated.slowIncorrectCount,
        fastIncorrectCount: aggregated.fastIncorrectCount,
      },
      dimensions: {
        difficulty: difficultyDimensions,
        subject: subjectDimensions,
        system: systemDimensions,
        topic: topicDimensions,
        questionBank: questionBankDimensions,
      },
      weaknessMap: {
        subject: subjectDimensions.filter((item) => item.isWeak),
        system: systemDimensions.filter((item) => item.isWeak),
        topic: topicDimensions.filter((item) => item.isWeak),
        questionBank: questionBankDimensions.filter((item) => item.isWeak),
      },
      latestPercentile: snapshots.length > 0 ? Number(snapshots[0].percentileRank || 0) : null,
      recentInsights,
      metadata: {
        totalSnapshots: snapshots.length,
        lastComputedAt: snapshots.length > 0 ? snapshots[0].computedAt : null,
      },
    };
  }

  // Back-compat filter for "weakest area at 0.0% accuracy" knowledge-gap
  // insights generated before the 3-attempt gate landed. These were noise
  // from single missed-question topics and confused users on the dashboard.
  // The gate prevents new ones; this filter scrubs the stragglers already in
  // the snapshot pool so they don't have to wait 20 tests to age out.
  // Safe to remove once snapshots predating the gate have rolled off.
  private readonly stalePreGateInsightPattern =
    /is one of your weakest areas( right now)? at 0\.0% accuracy/i;

  private filterStaleInsights(texts: string[]): string[] {
    return texts.filter((text) => !this.stalePreGateInsightPattern.test(text));
  }

  private resolveTransitionPattern(submission: QuestionSubmission): AnswerTransitionPattern {
    if (
      submission.answerTransitionPattern &&
      submission.answerTransitionPattern !== AnswerTransitionPattern.UNKNOWN
    ) {
      return submission.answerTransitionPattern;
    }

    const correctOptionId =
      submission.question?.options?.find((option: any) => option?.isCorrect)?.id ?? null;
    const firstSelectedOptionId =
      submission.firstSelectedOptionId ?? this.extractFirstSelectedOptionId(submission);

    return this.classifyAnswerTransition(
      firstSelectedOptionId,
      submission.selectedOptionId ?? null,
      correctOptionId,
    );
  }

  private extractFirstSelectedOptionId(submission: QuestionSubmission): number | null {
    const selectionHistory = Array.isArray(submission.selectionHistory)
      ? submission.selectionHistory
      : [];
    if (selectionHistory.length > 0) {
      return Number(selectionHistory[0]?.optionId || 0) || null;
    }

    const answerSequence = Array.isArray(submission.answerSequence) ? submission.answerSequence : [];
    if (answerSequence.length > 0) {
      return Number(answerSequence[0] || 0) || null;
    }

    return submission.selectedOptionId ?? null;
  }

  private classifyAnswerTransition(
    firstSelectedOptionId: number | null,
    finalSelectedOptionId: number | null,
    correctOptionId: number | null,
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

  private incrementDimensionMetric(
    bucket: Map<string, any>,
    input: {
      key: string | number | null | undefined;
      name: string | null | undefined;
      isCorrect: boolean;
      timeSpentSeconds: number;
      transitionPattern: AnswerTransitionPattern;
    },
  ) {
    if (input.key == null) {
      return;
    }

    const key = String(input.key);
    const current = bucket.get(key) || {
      key,
      name: input.name || 'Unknown',
      attempted: 0,
      correct: 0,
      totalTimeSeconds: 0,
      cToICount: 0,
      iToCCount: 0,
    };

    current.attempted += 1;
    current.correct += input.isCorrect ? 1 : 0;
    current.totalTimeSeconds += input.timeSpentSeconds;
    if (input.transitionPattern === AnswerTransitionPattern.C_TO_I) {
      current.cToICount += 1;
    }
    if (input.transitionPattern === AnswerTransitionPattern.I_TO_C) {
      current.iToCCount += 1;
    }

    bucket.set(key, current);
  }

  private finalizeDimensionMetrics(bucket: Map<string, any>, overallAvgTime: number) {
    return [...bucket.values()]
      .map((item) => {
        const attempted = Number(item.attempted || 0);
        const correct = Number(item.correct || 0);
        const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0;
        const avgTimeSeconds =
          attempted > 0 ? Number(item.totalTimeSeconds || 0) / attempted : 0;
        const isWeak =
          accuracy < 60 || (accuracy < 70 && avgTimeSeconds > Math.max(overallAvgTime, 1) * 1.2);

        return {
          key: item.key,
          name: item.name || item.key,
          attempted,
          correct,
          accuracy: Number(accuracy.toFixed(2)),
          avgTimeSeconds: Number(avgTimeSeconds.toFixed(2)),
          cToICount: Number(item.cToICount || 0),
          iToCCount: Number(item.iToCCount || 0),
          isWeak,
        };
      })
      .sort((left, right) => left.accuracy - right.accuracy);
  }

  private getGlobalAccuracy(submission: QuestionSubmission): number {
    const answered = Number(submission.question?.timesAnswered || 0);
    const correct = Number(submission.question?.timesCorrect || 0);
    if (answered <= 0) {
      return 0;
    }

    return (correct / answered) * 100;
  }

  private computeMedian(values: number[]): number {
    const sorted = [...values].filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (sorted.length === 0) {
      return 0;
    }

    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }

    return sorted[middle];
  }

  private computeRankBasedPercentile(score: number, cohortScores: number[]): number {
    const normalizedScores = cohortScores.filter((value) => Number.isFinite(value));

    if (normalizedScores.length === 0) {
      return 0;
    }

    const rank = normalizedScores.filter((value) => value > score).length + 1;
    const percentile =
      ((normalizedScores.length - rank) / Math.max(normalizedScores.length, 1)) * 100;

    return Math.round(this.clamp(percentile, 0, 100));
  }

  private async computeLatestScopedQuestionBankPercentile(
    qBankId: number,
    step: number | undefined,
    scopedTests: Test[],
  ): Promise<number | null> {
    if (scopedTests.length === 0) {
      return null;
    }

    const cohortRows = await this.testQuestionRepository
      .createQueryBuilder('testQuestion')
      .innerJoin('testQuestion.test', 'test')
      .innerJoin('testQuestion.question', 'question')
      .leftJoin(
        QuestionSubmission,
        'submission',
        'submission.testId = test.id AND submission.questionId = question.id AND submission.userId = test.userId',
      )
      .where('test.status = :status', { status: TestStatus.COMPLETED })
      .andWhere('question.questionBankId = :qBankId', { qBankId })
      .select('test.id', 'testId')
      .addSelect('COUNT(testQuestion.id)', 'questionCount')
      .addSelect(
        'SUM(CASE WHEN submission.isCorrect = true THEN 1 ELSE 0 END)',
        'correctCount',
      )
      .addSelect('AVG(COALESCE(submission.timeSpentSeconds, 0))', 'avgTimeSeconds')
      .groupBy('test.id');

    if (step) {
      cohortRows.andWhere('test.step = :step', { step });
    }

    const completedTestRows = await cohortRows.getRawMany<{
      testId: string;
      questionCount: string;
      correctCount: string | null;
      avgTimeSeconds: string | null;
    }>();

    const scoredCohort = completedTestRows
      .map((row) => {
        const questionCount = Number(row.questionCount || 0);
        if (!Number.isFinite(questionCount) || questionCount <= 0) {
          return null;
        }

        const correctCount = Number(row.correctCount || 0);
        const avgTimeSeconds = Number(row.avgTimeSeconds || 0);

        return {
          testId: Number(row.testId),
          score: (correctCount / questionCount) * 100,
          avgTimeSeconds,
        };
      })
      .filter(
        (
          row,
        ): row is {
          testId: number;
          score: number;
          avgTimeSeconds: number;
        } => Boolean(row),
      );

    if (scoredCohort.length < 2) {
      return null;
    }

    const latestScopedTest = scopedTests.find((test) =>
      scoredCohort.some((row) => row.testId === Number(test.id)),
    );
    if (!latestScopedTest) {
      return null;
    }

    scoredCohort.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.avgTimeSeconds - right.avgTimeSeconds;
    });

    const rank =
      scoredCohort.findIndex((row) => row.testId === Number(latestScopedTest.id)) + 1;
    if (rank <= 0) {
      return null;
    }

    return Math.round(
      ((scoredCohort.length - rank) / Math.max(scoredCohort.length, 1)) * 100,
    );
  }

  private computeTransitionConfidenceScore(
    transitions: {
      cToC: number;
      cToI: number;
      iToC: number;
      iToI: number;
      unknown: number;
      total: number;
    },
    submissions: QuestionSubmission[],
  ): number {
    const knownTransitions =
      transitions.cToC + transitions.cToI + transitions.iToC + transitions.iToI;
    const pctCToC = knownTransitions > 0 ? (transitions.cToC / knownTransitions) * 100 : 0;
    const pctCToI = knownTransitions > 0 ? (transitions.cToI / knownTransitions) * 100 : 0;
    const pctIToC = knownTransitions > 0 ? (transitions.iToC / knownTransitions) * 100 : 0;
    const highFlipRate =
      submissions.length > 0
        ? (submissions.filter((submission) => Number(submission.answerChanges || 0) >= 2).length /
            submissions.length) *
          100
        : 0;

    return this.clamp(
      50 + pctCToC * 0.4 + pctIToC * 0.2 - pctCToI * 0.6 - highFlipRate * 0.3,
      0,
      100,
    );
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private toSafeNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return 0;
  }

  private buildFilteredInsights(input: {
    attemptedQuestions: number;
    transitions: {
      cToC: number;
      cToI: number;
      iToC: number;
      iToI: number;
      unknown: number;
      total: number;
    };
    quadrants: {
      fastCorrectCount: number;
      slowCorrectCount: number;
      slowIncorrectCount: number;
      fastIncorrectCount: number;
    };
    difficultyAnalytics: Record<
      string,
      { attempted: number; correct: number; accuracy: number; avgTimeSeconds: number }
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
      difficulty: any[];
      subject: any[];
      system: any[];
      topic: any[];
      questionBank: any[];
    };
  }): string[] {
    const insights: Array<{ priority: number; text: string }> = [];

    if (
      input.difficultyAnalytics.easy?.attempted > 0 &&
      input.difficultyAnalytics.easy.accuracy < 80
    ) {
      insights.push({
        priority: 1,
        text: `Knowledge gap: your accuracy on easier questions is ${input.difficultyAnalytics.easy.accuracy.toFixed(1)}%. Missing routine questions usually means core facts need reinforcement.`,
      });
    }

    if (
      input.difficultyAnalytics.easy?.attempted > 0 &&
      input.difficultyAnalytics.medium?.attempted > 0 &&
      input.difficultyAnalytics.easy.avgTimeSeconds > input.difficultyAnalytics.medium.avgTimeSeconds
    ) {
      insights.push({
        priority: 2,
        text: `Time management: you are spending longer on easy questions than medium ones. Move faster on routine items so that harder questions get the extra time.`,
      });
    }

    if (input.peerComparison.missedHighConsensusCount > 0) {
      insights.push({
        priority: 2,
        text: `Careless mistakes: you missed ${input.peerComparison.missedHighConsensusCount} questions that most peers answered correctly. Slow down enough to catch stem qualifiers and trap choices.`,
      });
    }

    if (input.peerComparison.solvedLowConsensusCount > 0) {
      insights.push({
        priority: 5,
        text: `Strength: you solved ${input.peerComparison.solvedLowConsensusCount} questions that many peers missed. That shows useful strength on tougher material.`,
      });
    }

    if (input.overthinkingIndex > 20) {
      insights.push({
        priority: 2,
        text: `Time management: your incorrect answers are taking ${input.overthinkingIndex.toFixed(1)}s longer than your correct ones. When a question starts dragging, make a cleaner elimination decision sooner.`,
      });
    }

    if (input.transitions.cToI > input.transitions.iToC) {
      insights.push({
        priority: 1,
        text: `Confidence: you changed more right answers into wrong ones than wrong answers into right ones. Only switch when new evidence clearly beats your first choice.`,
      });
    }

    if (input.quadrants.fastIncorrectCount > input.quadrants.slowIncorrectCount) {
      insights.push({
        priority: 2,
        text: `Careless mistakes: many misses are happening quickly. Add a short final check for key stem words before locking the answer.`,
      });
    }

    if (input.quadrants.slowIncorrectCount > 0) {
      const slowIncorrectRate =
        (input.quadrants.slowIncorrectCount / Math.max(input.attemptedQuestions, 1)) * 100;
      if (slowIncorrectRate >= 20) {
        insights.push({
          priority: 1,
          text: `Knowledge gap: ${slowIncorrectRate.toFixed(1)}% of your questions are slow and incorrect. That usually means the concept is not secure enough yet for exam speed.`,
        });
      }
    }

    if (input.fatigueSegments.length > 1) {
      const first = input.fatigueSegments[0];
      const last = input.fatigueSegments[input.fatigueSegments.length - 1];
      if (first.attempted > 0 && last.attempted > 0 && first.accuracy - last.accuracy >= 15) {
        insights.push({
          priority: 2,
          text: `Fatigue: your accuracy drops noticeably later in the block. Work on pacing and short mental resets so your focus holds deeper into the set.`,
        });
      }
    }

    // Match the snapshot path: a "weakest area" insight needs at least 3
    // attempts on that dimension before it's worth surfacing. A 0/1 topic is
    // noise, not signal.
    const MIN_INSIGHT_ATTEMPTS = 3;
    const hasEnoughAttempts = (item: any) =>
      Number(item?.attempted || 0) >= MIN_INSIGHT_ATTEMPTS;
    const weakestDimension =
      input.weaknessMap.topic.find(hasEnoughAttempts) ||
      input.weaknessMap.system.find(hasEnoughAttempts) ||
      input.weaknessMap.subject.find(hasEnoughAttempts) ||
      input.weaknessMap.questionBank.find(hasEnoughAttempts) ||
      input.weaknessMap.difficulty.find(hasEnoughAttempts) ||
      null;

    if (weakestDimension) {
      insights.push({
        priority: 1,
        text: `Knowledge gap: ${weakestDimension.name} is one of your weakest areas right now at ${Number(weakestDimension.accuracy || 0).toFixed(1)}% accuracy. Put it near the top of your next review session.`,
      });
    }

    if (input.difficultyAnalytics.hard?.attempted > 0 && input.difficultyAnalytics.hard.accuracy > 60) {
      insights.push({
        priority: 5,
        text: `Strength: you are performing well on harder questions. Keep that strength warm while you close easier score leaks.`,
      });
    }

    return [...new Map(insights.map((item) => [item.text.toLowerCase(), item])).values()]
      .sort((left, right) => left.priority - right.priority)
      .slice(0, 6)
      .map((item) => item.text);
  }

  private parseAndValidateId(id: any): number {
    const idStr = String(id);
    const numId = parseInt(idStr, 10);
    if (isNaN(numId) || numId < 1 || numId > 2147483647 || String(numId) !== idStr) {
      throw new NotFoundException('No results found for this id');
    }
    return numId;
  }
}
