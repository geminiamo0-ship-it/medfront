import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestsController } from './tests.controller';
import { Test } from '../entities/test.entity';
import { TestQuestion } from '../entities/test-question.entity';
import { Question } from '../entities/question.entity';
import { QuestionSubmission } from '../entities/question-submission.entity';
import { QuestionInteraction } from '../entities/question-interaction.entity';
import { QuestionFeedback } from '../entities/question-feedback.entity';
import { Subject } from '../entities/subject.entity';
import { System } from '../entities/system.entity';
import { Topic } from '../entities/topic.entity';
import { QuestionBank } from '../entities/question-bank.entity';
import { MainBank } from '../entities/main-bank.entity';
import { TestAnalyticsSnapshot } from '../entities/test-analytics-snapshot.entity';
import { UserAnalyticsStats } from '../entities/user-analytics-stats.entity';
import { UserDimensionStats } from '../entities/user-dimension-stats.entity';
import { AdminHistory } from '../entities/admin-history.entity';
import { QuestionGrouping } from '../entities/question-grouping.entity';
import { AiUsageLog } from '../entities/ai-usage-log.entity';
import { AiUserAccessLog } from '../entities/ai-user-access-log.entity';
import { UserDailyStats } from '../entities/user-daily-stats.entity';
import { User } from '../entities/user.entity';
import { UserQuestionHighlight } from '../entities/user-question-highlight.entity';
import { UserQuestionMark } from '../entities/user-question-mark.entity';
import { QuestionBankSubjectOrder } from '../entities/question-bank-subject-order.entity';
import { QuestionBankSystemOrder } from '../entities/question-bank-system-order.entity';

import { TestMetadataService } from './services/test-metadata.service';
import { TestAnalyticsService } from './services/test-analytics.service';
import { TestCreationService } from './services/test-creation.service';
import { TestExecutionService } from './services/test-execution.service';
import { TestRetrievalService } from './services/test-retrieval.service';
import { AnalyticsAggregationService } from './services/analytics-aggregation.service';
import { QuestionSearchService } from './services/question-search.service';
import { BlockGenerationService } from './services/block-generation.service';
import { TestAiService } from './services/test-ai.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TestAccessGuard } from './guards/test-access.guard';
import { SecurityModule } from '../security/security.module';
import { LibraryModule } from '../library/library.module';
import { QuestionAiExplanation } from '../entities/question-ai-explanation.entity';
import { SettingsModule } from '../settings/settings.module';
import { TelegramService } from '../integrations/telegram.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Test,
      TestQuestion,
      Question,
      QuestionSubmission,
      QuestionInteraction,
      QuestionFeedback,
      Subject,
      System,
      Topic,
      QuestionBank,
      MainBank,
      TestAnalyticsSnapshot,
      UserAnalyticsStats,
      UserDimensionStats,
      AdminHistory,
      QuestionGrouping,
      QuestionAiExplanation,
      AiUsageLog,
      AiUserAccessLog,
      UserDailyStats,
      User,
      UserQuestionHighlight,
      UserQuestionMark,
      QuestionBankSubjectOrder,
      QuestionBankSystemOrder,
    ]),
    SubscriptionsModule,
    SecurityModule,
    LibraryModule,
    SettingsModule,
  ],
  controllers: [TestsController],
  providers: [
    TestMetadataService,
    TestAnalyticsService,
    TestCreationService,
    TestExecutionService,
    TestRetrievalService,
    QuestionSearchService,
    AnalyticsAggregationService,
    BlockGenerationService,
    TestAccessGuard,
    TestAiService,
    TelegramService,
  ],
  exports: [
    TestMetadataService,
    TestAnalyticsService,
    TestCreationService,
    TestExecutionService,
    TestRetrievalService,
    AnalyticsAggregationService,
    BlockGenerationService,
    TestAiService,
  ],
})
export class TestsModule {}
