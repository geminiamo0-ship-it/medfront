import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Test, TestStatus, TestType } from '../../entities/test.entity';
import { TestQuestion } from '../../entities/test-question.entity';
import { QuestionSubmission } from '../../entities/question-submission.entity';
import { UserQuestionHighlight } from '../../entities/user-question-highlight.entity';
import { UserQuestionMark } from '../../entities/user-question-mark.entity';
import { Question } from '../../entities/question.entity';
import { QuestionBank } from '../../entities/question-bank.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { resolveDifficultyFromCorrectOptionRate } from '../../utils/question-difficulty.util';

@Injectable()
export class TestRetrievalService {
  private readonly defaultBlockSize = 20;

  constructor(
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
    @InjectRepository(TestQuestion)
    private testQuestionRepository: Repository<TestQuestion>,
    @InjectRepository(QuestionSubmission)
    private submissionRepository: Repository<QuestionSubmission>,
    @InjectRepository(UserQuestionHighlight)
    private highlightRepository: Repository<UserQuestionHighlight>,
    @InjectRepository(UserQuestionMark)
    private markRepository: Repository<UserQuestionMark>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(QuestionBank)
    private questionBankRepository: Repository<QuestionBank>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async getUserTests(userId: number, step?: number, qBankId?: number, isBlock?: boolean): Promise<Test[]> {
    const query = this.testRepository.createQueryBuilder('test')
      .where('test.userId = :userId', { userId })
      .orderBy('test.createdAt', 'DESC');

    if (step) {
      query.andWhere('test.step = :step', { step });
    }

    if (typeof isBlock === 'boolean') {
      query.andWhere('test.isBlock = :isBlock', { isBlock });
    }

    if (qBankId) {
      if (typeof isBlock === 'boolean' && isBlock) {
        query.andWhere('test.blockBankId = :blockBankId', { blockBankId: qBankId });
      } else {
        query.andWhere(`test.filters::jsonb->'questionBankIds' @> :qBankId::jsonb`, { qBankId: JSON.stringify([qBankId]) });
      }
    }

    const tests = await query.getMany();
    
    // Omit massive filter arrays from list responses to significantly reduce JSON payload size
    return tests.map(test => {
      if (test.filters) {
        test.filters = {
          questionBankIds: test.filters.questionBankIds || [],
        };
      }
      return test;
    });
  }

  async getTest(id: any, userId: number): Promise<any> {
    const testId = this.parseAndValidateId(id);
    const test = await this.testRepository.findOne({
      where: { id: testId },
    });

    if (!test) {
      throw new NotFoundException('No results found for this id');
    }

    if (test.userId !== userId) {
      throw new ForbiddenException('You do not have access to this test');
    }
    
    // Check for expiration. v=2 Mixed must NOT auto-complete on read — the
    // read path never advances the active-time accumulator, so wall-clock
    // here would silently force-complete a test whose visual timer still
    // shows time left. That's the exact desync the v=2 design fixes.
    if (
      test.status === TestStatus.IN_PROGRESS &&
      test.timeLimitSeconds &&
      Number(test.timeAccountingVersion) !== 2
    ) {
      const elapsedTimeSeconds = this.getElapsedTimeSeconds(test);
      if (elapsedTimeSeconds >= Number(test.timeLimitSeconds)) {
        test.status = TestStatus.COMPLETED;
        test.completedAt = new Date();
        test.timeSpentSeconds = Number(test.timeLimitSeconds);
        test.percentageScore = test.answeredQuestions > 0 ? (test.correctAnswers / test.answeredQuestions) * 100 : 0;
        await this.testRepository.save(test);
        // Continue to return the test, but it will now have 'completed' status
      }
    }

    const { locked: blockResultsLocked } = await this.getBlockResultsLock(test, userId);

    // 1. Get test-question mapping (orders)
    const testMappings = await this.testQuestionRepository.find({
      where: { testId },
      order: { displayOrder: 'ASC' },
    });

    const questionIds = testMappings.map(tq => tq.questionId);
    if (questionIds.length === 0) {
      return { ...test, blockResultsLocked, omittedQuestionIds: [], questions: [] };
    }

    // 2. Fetch full question content (GLOBAL CACHE - 24H TTL)
    const questionsData = await this.fetchQuestionsData(questionIds);
    const questionsMap = new Map(questionsData.map(q => [q.id, q]));


    const [submissions, highlightRows, markRows] = await Promise.all([
      this.submissionRepository.find({
        where: { userId, testId, questionId: In(questionIds) },
      }),
      // Load highlights from their isolated table — no coupling to submissions
      this.highlightRepository.find({
        where: { userId, testId, questionId: In(questionIds) },
      }),
      // Marks live in their own table — single PK-indexed range scan over the
      // questions in this test. Returns only the marked question IDs.
      this.markRepository.find({
        where: { userId, questionId: In(questionIds) },
        select: ['questionId'],
      }),
    ]);

    const submissionMap = new Map(submissions.map((s) => [s.questionId, s]));
    const highlightMap  = new Map(highlightRows.map((h) => [h.questionId, h]));
    const markedSet     = new Set(markRows.map((m) => m.questionId));

    // 🚀 CACHE OPTIMIZATION: Pre-cache answers if not already cached
    await this.ensureAnswersCached(questionIds);

    // Format response
    const questions = testMappings.map((tq) => {
      const question = questionsMap.get(tq.questionId);
      if (!question) return null;

      const submission = submissionMap.get(tq.questionId);
      const isMarked = markedSet.has(tq.questionId);
      const isTestCompleted = test.status === TestStatus.COMPLETED;
      const hasSelectedAnswer =
        submission?.selectedOptionId !== null && submission?.selectedOptionId !== undefined;
      const isOmitted = isTestCompleted && !hasSelectedAnswer;
      const questionStatus = hasSelectedAnswer
        ? 'answered'
        : isOmitted
          ? 'omitted'
          : 'unanswered';
      
      const isTutorLikeMode =
        test.type === TestType.TUTOR || test.type === TestType.MIXED;
      // Use hasSelectedAnswer (not just submission) so that highlight-only draft
      // rows — which have selectedOptionId = null — do NOT trigger answer reveal.
      const shouldShowAnswers =
        !blockResultsLocked && (isTestCompleted || (isTutorLikeMode && hasSelectedAnswer));
      
      return {
        id: Number(question.id),
        externalId: question.externalId ? String(question.externalId) : null,
        displayOrder: Number(tq.displayOrder),
        textHtml: question.textHtml,
        explanationHtml: shouldShowAnswers ? question.explanationHtml : undefined,
        difficulty: this.resolveQuestionDifficulty(question),
        estimatedTimeSeconds: Number(question.estimatedTimeSeconds),
        subject: question.subject,
        system: question.system,
        topic: question.topic,
        questionBank: question.questionBank,
        articleId: question.articleId ? Number(question.articleId) : undefined,
        libraryName: question.libraryName ? String(question.libraryName) : undefined,
        options: question.options.map((opt) => ({
          id: Number(opt.id),
          textHtml: opt.textHtml,
          displayOrder: opt.displayOrder,
          isCorrect: shouldShowAnswers ? opt.isCorrect : undefined,
          explanationHtml: shouldShowAnswers ? opt.explanationHtml : undefined,
          uworldChosenBy: shouldShowAnswers ? opt.uworldChosenBy : undefined,
        })),
        userAnswer: submission
          ? {
              selectedOptionId: hasSelectedAnswer ? Number(submission.selectedOptionId) : null,
              isCorrect: shouldShowAnswers ? submission.isCorrect : undefined,
              timeSpentSeconds: Number(submission.timeSpentSeconds),
              answerChanges: Number(submission.answerChanges),
              // Marks are sourced from user_question_marks now — userAnswer.isMarked
              // is kept here only for any legacy reader that hasn't migrated yet.
              // The top-level `isMarked` field below is the source of truth.
              isMarked,
              highlights: submission.highlights,
              notes: submission.notes,
            }
          : null,
        // Top-level mark flag — present whether or not the question has a
        // submission, so unanswered-but-marked questions correctly show the flag.
        isMarked,
        // Highlights are isolated from submissions — loaded from their own table.
        // Present whether or not the question has been answered.
        highlightData: (() => {
          const h = highlightMap.get(tq.questionId);
          if (!h) return null;
          return {
            highlights:           h.highlights           ?? [],
            questionHtmlCache:    h.questionHtmlCache    ?? null,
            explanationHtmlCache: h.explanationHtmlCache ?? null,
          };
        })(),
        isAnswered: hasSelectedAnswer,
        isOmitted,
        status: questionStatus,
      };
    }).filter(q => q !== null);

    const omittedQuestionIds = questions.filter((q) => q.isOmitted).map((q) => q.id);
    const resumeQuestion =
      questions.find((q) => q.status === 'unanswered') ??
      questions[questions.length - 1] ??
      null;


    return {
      ...test,
      id: Number(test.id),
      userId: Number(test.userId),
      step: Number(test.step),
      totalQuestions: Number(test.totalQuestions),
      answeredQuestions: Number(test.answeredQuestions),
      correctAnswers: Number(test.correctAnswers),
      rightToWrongChanges: Number(test.rightToWrongChanges),
      percentageScore: test.percentageScore ? Number(test.percentageScore) : null,
      timeSpentSeconds: Number(test.timeSpentSeconds),
      timeLimitSeconds: test.timeLimitSeconds ? Number(test.timeLimitSeconds) : null,
      blockResultsLocked,
      omittedQuestionIds,
      resumeQuestionId: resumeQuestion ? Number(resumeQuestion.id) : null,
      resumeDisplayOrder: resumeQuestion ? Number(resumeQuestion.displayOrder) : null,
      questions,
    };
  }

  async getTestQuestionIds(id: any, userId: number): Promise<number[]> {
    try {
      const testId = this.parseAndValidateId(id);
      const test = await this.testRepository.findOne({ where: { id: testId } });
      
      if (!test) {
        return [];
      }

      const testQuestions = await this.testQuestionRepository.find({
        where: { testId },
        select: ['questionId'],
        order: { displayOrder: 'ASC' },
      });

      const questionIds = testQuestions.map(tq => tq.questionId);
      if (questionIds.length === 0) {
        return [];
      }

      const questions = await this.questionRepository.find({
        where: { id: In(questionIds) },
        select: ['id', 'externalId'],
      });
      const externalIdById = new Map(
        questions.map((q) => [q.id, q.externalId ? String(q.externalId) : null]),
      );

      return testQuestions
        .map((tq) => externalIdById.get(tq.questionId))
        .filter((value) => value)
        .map((value) => Number(value))
        .filter((value) => !Number.isNaN(value));
    } catch {
      return [];
    }
  }

  /**
   * Ensure all question answers are cached
   * Checks cache first, only fetches uncached questions from DB
   */
  private async ensureAnswersCached(questionIds: number[]): Promise<void> {
    if (questionIds.length === 0) return;

    // Check which questions are NOT cached
    const uncachedIds: number[] = [];
    for (const qId of questionIds) {
      const cacheKey = `question_keys:${qId}:answer`;
      const cached = await this.cacheManager.get(cacheKey);
      if (cached === null || cached === undefined) {
        uncachedIds.push(qId);
      }
    }

    // If all are cached, we're done!
    if (uncachedIds.length === 0) {
      console.log(`✅ All ${questionIds.length} answers already cached!`);
      return;
    }

    console.log(`🔄 Pre-caching ${uncachedIds.length}/${questionIds.length} missing answers...`);

    // Fetch only uncached questions
    const questions = await this.questionRepository
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.options', 'opt')
      .where('q.id IN (:...questionIds)', { questionIds: uncachedIds })
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

    console.log(`💾 Successfully cached ${cachedCount} new answers!`);
  }

  private async getBlockResultsLock(test: Test, userId: number) {
    if (!test?.isBlock || !test.blockBankId) {
      return { locked: false };
    }

    const bank = await this.questionBankRepository.findOne({
      where: { id: test.blockBankId, isActive: true },
      select: ['id', 'totalQuestions', 'isBlockBank', 'blockSize', 'step'],
    });

    if (!bank || !bank.isBlockBank) {
      return { locked: false, bank };
    }

    const effectiveBlockSize = bank.blockSize || this.defaultBlockSize;
    const totalBlocks = Math.ceil((bank.totalQuestions || 0) / effectiveBlockSize);
    if (totalBlocks <= 0) {
      return { locked: false, bank, totalBlocks, completedBlocks: 0 };
    }

    const completedBlocks = await this.testRepository.count({
      where: {
        userId,
        isBlock: true,
        blockBankId: bank.id,
        status: TestStatus.COMPLETED,
      },
    });

    return {
      locked: completedBlocks < totalBlocks,
      bank,
      totalBlocks,
      completedBlocks,
    };
  }

  /**
   * Fetches full question content using Redis cache (24H TTL)
   * This is the "Static Global Content" optimized for many users
   */
  private async fetchQuestionsData(questionIds: number[]): Promise<any[]> {
    const results: any[] = [];
    const missingIds: number[] = [];

    // 1. Check Redis for each question
    for (const id of questionIds) {
      const cacheKey = `static_questions:${id}:content`;
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        results.push(cached);
      } else {
        missingIds.push(id);
      }
    }

    if (missingIds.length === 0) {
      console.log(`[StaticCache] ⚡ Full Cache HIT for ${questionIds.length} questions`);
      return results;
    }

    console.log(`[StaticCache] 🔍 Cache MISS for ${missingIds.length} questions - fetching from DB`);

    // 2. Fetch missing from DB with full joins
    const dbQuestions = await this.questionRepository
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.options', 'options')
      .leftJoinAndSelect('q.subject', 'subject')
      .leftJoinAndSelect('q.system', 'system')
      .leftJoinAndSelect('q.topic', 'topic')
      .leftJoinAndSelect('q.questionBank', 'questionBank')
      .where('q.id IN (:...missingIds)', { missingIds })
      .getMany();

    // 3. Cache the DB results for 24 hours (86,400s)
    for (const question of dbQuestions) {
      const cacheKey = `static_questions:${question.id}:content`;
      const cachedQuestion = this.serializeQuestionForCache(question);
      await this.cacheManager.set(cacheKey, cachedQuestion, 86400 * 1000); // 24h in ms
      results.push(cachedQuestion);
    }

    return results;
  }


  private parseAndValidateId(id: any): number {
    const idStr = String(id);
    const numId = parseInt(idStr, 10);
    
    if (isNaN(numId) || numId < 1 || numId > 2147483647 || String(numId) !== idStr) {
      throw new NotFoundException('No results found for this id');
    }
    return numId;
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

  private serializeQuestionForCache(question: any) {
    return {
      ...question,
      difficulty: this.resolveQuestionDifficulty(question),
    };
  }

  private resolveQuestionDifficulty(question: any) {
    const correctOption = question?.options?.find((option: any) => option?.isCorrect);
    return resolveDifficultyFromCorrectOptionRate(correctOption?.uworldChosenBy);
  }
}
