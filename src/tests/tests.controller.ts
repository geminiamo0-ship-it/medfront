import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CreateTestDto, SubmitAnswerDto, CompleteTestDto, GetQuestionCountsDto, GetDifficultyCountsDto, QuestionFeedbackDto, GetSubjectsDto, GetSystemsWithTopicsDto, UpdateTestNameDto, UpdateHighlightsDto, ToggleMarkDto, SubmitAnswersBatchDto } from './dto/test.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TestMetadataService } from './services/test-metadata.service';
import { TestAnalyticsService } from './services/test-analytics.service';
import { TestCreationService } from './services/test-creation.service';
import { TestExecutionService } from './services/test-execution.service';
import { TestRetrievalService } from './services/test-retrieval.service';
import { QuestionSearchService } from './services/question-search.service';
import { TestAccessGuard } from './guards/test-access.guard';
import { ContentSecurityGuard } from '../security/content-security.guard';
import { SecurityWatermarkService } from '../security/security-watermark.service';
import { getClientIp } from '../rate-limit/rate-limit.utils';
import { TestAiService } from './services/test-ai.service';

@Controller('tests')
@UseGuards(JwtAuthGuard, ContentSecurityGuard)
export class TestsController {
  constructor(
    private readonly metadataService: TestMetadataService,
    private readonly analyticsService: TestAnalyticsService,
    private readonly creationService: TestCreationService,
    private readonly executionService: TestExecutionService,
    private readonly retrievalService: TestRetrievalService,
    private readonly questionSearchService: QuestionSearchService,
    private readonly securityWatermarkService: SecurityWatermarkService,
    private readonly testAiService: TestAiService,
  ) {}

  /**
   * Get available question counts based on filters
   * POST /api/tests/counts
   */
  @Post('counts')
  @UseGuards(TestAccessGuard)
  async getQuestionCounts(@Request() req, @Body() queryDto: GetQuestionCountsDto) {
    return this.creationService.getQuestionCounts(req.user, queryDto.filters, queryDto.step);
  }
  /**
   * Get exact deduplicated question count for a combined set of modes
   * POST /api/tests/counts/mixed
   */
  @Post('counts/mixed')
  @UseGuards(TestAccessGuard)
  async getMixedModeCount(@Request() req, @Body() queryDto: GetQuestionCountsDto) {
    return this.creationService.getMixedModeCount(req.user, queryDto.filters, queryDto.step);
  }


  /**
   * Create a new test
   * POST /api/tests
   */
  @Post()
  @SkipThrottle()
  @UseGuards(TestAccessGuard)
  async createTest(@Request() req, @Body() createTestDto: CreateTestDto) {
    return this.creationService.createTest(req.user, createTestDto, {
      ip: getClientIp(req),
      userAgent: String(req.headers?.["user-agent"] || ""),
      path: req.originalUrl || req.url || "/tests",
    });
  }

  /**
   * Get user's tests
   * GET /api/tests
   */
  @Get()
  async getUserTests(@Request() req) {
    const userId = req.user.id;
    const { step, qBankId, isBlock } = req.query;
    return this.retrievalService.getUserTests(
      userId,
      step ? parseInt(step as string) : undefined,
      qBankId ? parseInt(qBankId as string) : undefined,
      typeof isBlock === 'string' ? isBlock === 'true' : undefined,
    );
  }

  /**
   * Search for questions by internal question ID or imported UWorld ID
   * GET /api/tests/search/questions?mode=questionId|uworldId&value=123
   */
  @Get('search/questions')
  async searchQuestions(
    @Request() req,
    @Query('mode') mode?: string,
    @Query('value') value?: string,
  ) {
    return this.questionSearchService.search(req.user, String(mode || ''), String(value || ''));
  }

  /**
   * Quick practice: fetch a question with options (no answers)
   * GET /api/tests/practice/:questionId
   */
  @Get('practice/:questionId')
  async getPracticeQuestion(
    @Request() req,
    @Param('questionId') questionId: string,
  ) {
    const question = await this.questionSearchService.getPracticeQuestion(
      req.user,
      Number(questionId),
    );
    question.textHtml = await this.securityWatermarkService.watermarkHtml(
      question.textHtml,
      {
        userId: req.user.id,
        email: req.user.email || null,
        contentId: `practice:${question.id}`,
        kind: "test_question",
      },
    );
    question.options = await Promise.all(
      question.options.map(async (option: any) => ({
        ...option,
        textHtml: await this.securityWatermarkService.watermarkHtml(
          option.textHtml,
          {
            userId: req.user.id,
            email: req.user.email || null,
            contentId: `practice:${question.id}:option:${option.id}`,
            kind: "test_option",
          },
        ),
      })),
    );
    return question;
  }

  /**
   * Quick practice: submit an answer and check correctness
   * POST /api/tests/practice/:questionId/submit
   */
  @Post('practice/:questionId/submit')
  async submitPracticeAnswer(
    @Request() req,
    @Param('questionId') questionId: string,
    @Body() body: { selectedOptionId: number },
  ) {
    return this.questionSearchService.submitPracticeAnswer(
      req.user,
      Number(questionId),
      Number(body?.selectedOptionId),
    );
  }

  /**
   * Get a specific test with questions
   * GET /api/tests/:id
   */
  @Get(':id')
  @UseGuards(TestAccessGuard)
  async getTest(@Param('id') id: string, @Request() req) {
    const userId = req.user.id;
    const test = await this.retrievalService.getTest(id, userId);
    if (Array.isArray(test?.questions)) {
      test.questions = await Promise.all(
        test.questions.map(async (question: any) => ({
          ...question,
          textHtml: await this.securityWatermarkService.watermarkHtml(
            question.textHtml,
            {
              userId,
              email: req.user.email || null,
              contentId: `test:${test.id}:question:${question.id}`,
              kind: "test_question",
            },
          ),
          explanationHtml: question.explanationHtml
            ? await this.securityWatermarkService.watermarkHtml(
                question.explanationHtml,
                {
                  userId,
                  email: req.user.email || null,
                  contentId: `test:${test.id}:question:${question.id}:explanation`,
                  kind: "test_explanation",
                },
              )
            : question.explanationHtml,
          options: Array.isArray(question.options)
            ? await Promise.all(
                question.options.map(async (option: any) => ({
                  ...option,
                  textHtml: await this.securityWatermarkService.watermarkHtml(
                    option.textHtml,
                    {
                      userId,
                      email: req.user.email || null,
                      contentId: `test:${test.id}:question:${question.id}:option:${option.id}`,
                      kind: "test_option",
                    },
                  ),
                  explanationHtml: option.explanationHtml
                    ? await this.securityWatermarkService.watermarkHtml(
                        option.explanationHtml,
                        {
                          userId,
                          email: req.user.email || null,
                          contentId: `test:${test.id}:question:${question.id}:option:${option.id}:explanation`,
                          kind: "test_option_explanation",
                        },
                      )
                    : option.explanationHtml,
                })),
              )
            : question.options,
        })),
      );
    }
    return test;
  }

  /**
   * Remove a test and restore question progress tied to it
   * DELETE /api/tests/:id
   */
  @Delete(':id')
  @UseGuards(TestAccessGuard)
  async removeTest(@Param('id') id: string, @Request() req) {
    const userId = req.user.id;
    return this.executionService.removeTest(id, userId);
  }

  /**
   * Rename a test
   * PATCH /api/tests/:id/name
   */
  @Patch(':id/name')
  @UseGuards(TestAccessGuard)
  async renameTest(
    @Param('id') id: string,
    @Request() req,
    @Body() updateTestNameDto: UpdateTestNameDto,
  ) {
    const userId = req.user.id;
    return this.executionService.renameTest(id, userId, updateTestNameDto.title);
  }

  /**
   * Get UWorld IDs for a test
   * POST /api/tests/retrieve-questions
   */
  @Post('retrieve-questions')
  @UseGuards(TestAccessGuard)
  async getTestQuestionIds(@Body('testId') testId: string, @Request() req) {
    const userId = req.user.id;
    return this.retrievalService.getTestQuestionIds(testId, userId);
  }

  /**
   * Submit an answer to a question in a test
   * POST /api/tests/:id/submit
   */
  @Post(':id/submit')
  @UseGuards(TestAccessGuard)
  async submitAnswer(
    @Param('id') id: string,
    @Request() req,
    @Body() submitAnswerDto: SubmitAnswerDto,
  ) {
    const userId = req.user.id;
    return this.executionService.submitAnswer(id, userId, submitAnswerDto);
  }

  /**
   * Timed-mode End-Block bulk submit. Accepts all selected answers in one
   * request, persists them atomically, flips the test to COMPLETED, runs
   * counter recompute + analytics, returns final state.
   * POST /api/tests/:id/submit-batch
   *
   * Service rejects non-Timed tests (BadRequest). Idempotent on COMPLETED.
   */
  @Post(':id/submit-batch')
  @UseGuards(TestAccessGuard)
  async submitAnswersBatch(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: SubmitAnswersBatchDto,
  ) {
    const userId = req.user.id;
    return this.executionService.submitAnswersBatch(id, userId, dto);
  }

  /**
   * Update highlights for a question — works before and after answer submission.
   * PATCH /api/tests/:id/highlights
   */
  @Patch(':id/highlights')
  @UseGuards(TestAccessGuard)
  async updateHighlights(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateHighlightsDto,
  ) {
    const userId = req.user.id;
    return this.executionService.updateHighlights(id, userId, dto);
  }

  /**
   * Toggle the "marked for review" flag on a question.
   * Independent of answer submission — saves immediately so marks survive
   * crashes, token expiry, closed tabs, etc.
   * PATCH /api/tests/:id/mark
   */
  @Patch(':id/mark')
  @UseGuards(TestAccessGuard)
  async toggleMark(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: ToggleMarkDto,
  ) {
    const userId = req.user.id;
    return this.executionService.toggleMark(id, userId, dto);
  }

  /**
   * Get explanation for a specific question (lazy-loaded after answer submission)
   * GET /api/tests/:id/questions/:questionId/explanation
   */
  @Get(':id/questions/:questionId/explanation')
  @UseGuards(TestAccessGuard)
  async getQuestionExplanation(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Request() req,
  ) {
    const userId = req.user.id;
    const explanation = await this.executionService.getQuestionExplanation(
      id,
      questionId,
      userId,
    );
    explanation.explanationHtml = await this.securityWatermarkService.watermarkHtml(
      explanation.explanationHtml,
      {
        userId,
        email: req.user.email || null,
        contentId: `test:${id}:question:${questionId}:explanation`,
        kind: "test_explanation",
      },
    );
    explanation.options = await Promise.all(
      (explanation.options || []).map(async (option: any) => ({
        ...option,
        explanationHtml: option.explanationHtml
          ? await this.securityWatermarkService.watermarkHtml(
              option.explanationHtml,
              {
                userId,
                email: req.user.email || null,
                contentId: `test:${id}:question:${questionId}:option:${option.id}:explanation`,
                kind: "test_option_explanation",
              },
            )
          : option.explanationHtml,
      })),
    );
    return explanation;
  }

  /**
   * Request AI Explanation for a question or its explanation
   * POST /api/tests/:id/questions/:questionId/ai-explain
   */
  @Post(':id/questions/:questionId/ai-explain')
  @UseGuards(TestAccessGuard)
  async getAiExplanation(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() body: { type: 'question' | 'explanation'; optionId?: string; lang?: 'en' | 'ar' },
    @Request() req,
  ) {
    return this.testAiService.getExplanation(req.user, questionId, body.type, body.optionId, body.lang || 'en');
  }

  /**
   * Check if cached AI explanations exist for a question (no generation, no quota)
   * GET /api/tests/:id/questions/:questionId/ai-explain/cache
   */
  @Get(':id/questions/:questionId/ai-explain/cache')
  @UseGuards(TestAccessGuard)
  async getAiExplanationCache(
    @Param('questionId') questionId: string,
  ) {
    return this.testAiService.getCachedExplanations(questionId);
  }

  /**
   * Complete a test
   * PUT /api/tests/:id/complete
   */
  @Put(':id/complete')
  @UseGuards(TestAccessGuard)
  async completeTest(
    @Param('id') id: string,
    @Request() req,
    @Body() completeTestDto: CompleteTestDto,
  ) {
    const userId = req.user.id;
    return this.executionService.completeTest(id, userId, completeTestDto);
  }

  /**
   * Suspend a test without completing it
   * PUT /api/tests/:id/suspend
   */
  @Put(':id/suspend')
  @UseGuards(TestAccessGuard)
  async suspendTest(
    @Param('id') id: string,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.executionService.suspendTest(id, userId);
  }

  /**
   * Resume a suspended test
   * PUT /api/tests/:id/resume
   */
  @Put(':id/resume')
  @UseGuards(TestAccessGuard)
  async resumeTest(
    @Param('id') id: string,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.executionService.resumeTest(id, userId);
  }

  /**
   * Submit feedback for a question
   * POST /api/tests/feedback
   */
  @Post('feedback')
  async submitFeedback(@Request() req, @Body() feedbackDto: QuestionFeedbackDto) {
    const userId = req.user.id;
    return this.executionService.submitFeedback(userId, feedbackDto);
  }

  /**
   * Get all subjects (with optional mode for filtered counts)
   * POST /api/tests/metadata/subjects
   */
  @Post('metadata/subjects')
  async getSubjects(@Request() req, @Body() body: GetSubjectsDto) {
    return this.metadataService.getSubjects(
      req.user,
      body.step,
      body.questionBankIds,
      (body.mode as any) || 'all',
      body.difficulty,
    );
  }

  /**
   * Per-tier difficulty counts for the Create Test checkboxes
   * POST /api/tests/metadata/difficulty-counts
   */
  @Post('metadata/difficulty-counts')
  async getDifficultyCounts(@Request() req, @Body() body: GetDifficultyCountsDto) {
    return this.metadataService.getDifficultyCounts(
      req.user,
      body.step,
      body.questionBankIds,
    );
  }

  /**
   * Get all question banks
   * GET /api/tests/metadata/question-banks
   */
  @Get('metadata/question-banks')
  async getQuestionBanks(@Request() req) {
    const { step, mainBankId } = req.query;
    return this.metadataService.getQuestionBanksWithProgress(
      req.user, 
      step ? parseInt(step as string) : undefined,
      mainBankId ? parseInt(mainBankId as string) : undefined
    );
  }

  /**
   * Get main banks (UWorld, Amboss, NBME, etc.)
   * GET /api/tests/metadata/main-banks
   */
  @Get('metadata/main-banks')
  async getMainBanks(@Request() req) {
    const { step } = req.query;
    return this.metadataService.getMainBanks(
      req.user,
      step ? parseInt(step as string) : undefined
    );
  }

  /**
   * Get all systems
   * GET /api/tests/metadata/systems
   */
  @Get('metadata/systems')
  async getSystems() {
    return this.metadataService.getSystems();
  }

  /**
   * Get systems with topics and question counts
   * POST /api/tests/metadata/systems-with-topics
   */
  @Post('metadata/systems-with-topics')
  async getSystemsWithTopics(@Request() req, @Body() body: GetSystemsWithTopicsDto) {
    return this.metadataService.getSystemsWithTopics(req.user, body.step, body.filters);
  }

  /**
   * Get topics by subject/system
   * GET /api/tests/metadata/topics
   */
  @Get('metadata/topics')
  async getTopics(@Request() req) {
    const { subjectId, systemId } = req.query;
    return this.metadataService.getTopics(
      subjectId ? parseInt(subjectId as string) : undefined,
      systemId ? parseInt(systemId as string) : undefined,
    );
  }

  /**
   * Get overall performance analytics
   * GET /api/tests/performance/overview
   */
  @Get('performance/overview')
  async getPerformanceOverview(@Request() req) {
    const userId = req.user.id;
    const { step, qBankId } = req.query;
    return this.analyticsService.getUserPerformance(
      userId,
      step ? parseInt(step as string) : undefined,
      qBankId ? parseInt(qBankId as string) : undefined,
    );
  }

  /**
   * Get test results with analytics
   * GET /api/tests/:id/results
   */
  @Get(':id/results')
  async getTestResults(@Param('id') id: string, @Request() req) {
    const userId = req.user.id;
    return this.analyticsService.getTestResults(id, userId);
  }

  /**
   * Get statistics for a specific QBank and Step
   * GET /api/tests/performance/statistics
   */
  @Get('performance/statistics')
  async getQBankStatistics(@Request() req) {
    const { qBankCode, step } = req.query;
    return this.analyticsService.getQBankStatistics(
      req.user,
      qBankCode as string,
      parseInt(step as string),
    );
  }
}
