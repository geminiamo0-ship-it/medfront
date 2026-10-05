import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { typeOrmTimeoutLogger } from "./health/typeorm-timeout-logger";
import { ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { TestsModule } from "./tests/tests.module";

// User Entities
import { User } from "./entities/user.entity";
import { UserPreferences } from "./entities/user-preferences.entity";

// Content Entities
import { Subject } from "./entities/subject.entity";
import { System } from "./entities/system.entity";
import { Topic } from "./entities/topic.entity";
import { QuestionBank } from "./entities/question-bank.entity";
import { Question } from "./entities/question.entity";
import { QuestionOption } from "./entities/question-option.entity";
import { QuestionGrouping } from "./entities/question-grouping.entity";
import { QuestionBankSubjectOrder } from "./entities/question-bank-subject-order.entity";
import { QuestionBankSystemOrder } from "./entities/question-bank-system-order.entity";

// Behavioral Analytics Entities
import { QuestionInteraction } from "./entities/question-interaction.entity";
import { QuestionSubmission } from "./entities/question-submission.entity";

// Contest Entities
import { Contest } from "./entities/contest.entity";
import { ContestParticipant } from "./entities/contest-participant.entity";
import { ContestSubmission } from "./entities/contest-submission.entity";
import { ContestQuestion } from "./entities/contest-question.entity";

// Test Entities
import { Test } from "./entities/test.entity";
import { TestQuestion } from "./entities/test-question.entity";

// Notebook Entities
import { NotebookEntry } from "./entities/notebook-entry.entity";
import { QuestionFeedback } from "./entities/question-feedback.entity";

// Library Entities
import { LibraryArticle } from "./entities/library-article.entity";
import { LibraryArticleLocation } from "./entities/library-article-location.entity";
import { LibraryTooltip } from "./entities/library-tooltip.entity";
import { ArticleProgress } from "./entities/article-progress.entity";
import { ArticleHighlight } from "./entities/article-highlight.entity";
import { ArticleAiSummary } from "./entities/article-ai-summary.entity";
import { AiUsageLog } from "./entities/ai-usage-log.entity";
import { AiUserAccessLog } from "./entities/ai-user-access-log.entity";
import { LibraryBookmarkState } from "./entities/library-bookmark-state.entity";

import { SubscriptionsModule } from "./subscriptions/subscriptions.module";
import { NotebookModule } from "./notebook/notebook.module";
import { ContestsModule } from "./contests/contests.module";
import { MessagesModule } from "./messages/messages.module";
import { Message } from "./entities/message.entity";
import { LibraryModule } from "./library/library.module";
import { NotesModule } from "./notes/notes.module";
import { QuestionNote } from "./entities/question-note.entity";
import { MainBank } from "./entities/main-bank.entity";
import { PendingPayment } from "./entities/pending-payment.entity";
import { PaymentApproval } from "./entities/payment-approval.entity";
import { PromoCode } from "./entities/promo-code.entity";
import { PricingPlan } from "./entities/pricing-plan.entity";
import { AdminHistory } from "./entities/admin-history.entity";
import { AdminUserNote } from "./entities/admin-user-note.entity";
import { Notification } from "./entities/notification.entity";
import { NotificationRead } from "./entities/notification-read.entity";
import { AdminExpense } from "./entities/admin-expense.entity";
import { SupportTicket } from "./entities/support-ticket.entity";
import { TicketMessage } from "./entities/ticket-message.entity";
import { CacheConfigModule } from "./cache/cache.module";
import { AdminModule } from "./admin/admin.module";
import { AffiliateModule } from "./affiliate/affiliate.module";
import { AffiliateReferral } from "./entities/affiliate-referral.entity";
import { LabValue } from "./entities/lab-value.entity";
import { LabValuesModule } from "./lab-values/lab-values.module";
import { FlashcardDeck } from "./entities/flashcard-deck.entity";
import { FlashcardStats } from "./entities/flashcard-stats.entity";
import { Flashcard } from "./entities/flashcard.entity";
import { FlashcardReview } from "./entities/flashcard-review.entity";
import { FlashcardsModule } from "./flashcards/flashcards.module";
import { MediaModule } from "./media/media.module";
import { TestAnalyticsSnapshot } from "./entities/test-analytics-snapshot.entity";
import { UserAnalyticsStats } from "./entities/user-analytics-stats.entity";
import { UserDimensionStats } from "./entities/user-dimension-stats.entity";
import { JobPosting } from "./entities/job-posting.entity";
import { JobApplication } from "./entities/job-application.entity";
import { CareersModule } from "./careers/careers.module";
import { UserActivityLog } from "./entities/user-activity-log.entity";
import { AppSetting } from "./entities/app-setting.entity";
import { AppThrottlerGuard } from "./rate-limit/app-throttler.guard";
import { buildRateLimitOptions } from "./rate-limit/rate-limit.config";
import { ActivityModule } from "./activity/activity.module";
import { SettingsModule } from "./settings/settings.module";
import { Partner } from "./entities/partner.entity";
import { RequestRateLimitAlert } from "./entities/request-rate-limit-alert.entity";
import { SecurityIncident } from "./entities/security-incident.entity";
import { SecurityActorState } from "./entities/security-actor-state.entity";
import { UserQuotaCounter } from "./entities/user-quota-counter.entity";
import { BlockedIp } from "./entities/blocked-ip.entity";
import { BlockedIpAttempt } from "./entities/blocked-ip-attempt.entity";
import { UserDailyStats } from "./entities/user-daily-stats.entity";
import { UserQuestionHighlight } from "./entities/user-question-highlight.entity";
import { UserQuestionMark } from "./entities/user-question-mark.entity";
import { SpecialBadgeType } from "./entities/special-badge-type.entity";
import { UserSpecialBadge } from "./entities/user-special-badge.entity";
import { FinanceSetting } from "./entities/finance-setting.entity";
import { Wallet } from "./entities/wallet.entity";
import { WalletLedgerEntry } from "./entities/wallet-ledger-entry.entity";
import { PayrollEmployee } from "./entities/payroll-employee.entity";
import { PayrollExpense } from "./entities/payroll-expense.entity";
import { FinancePartner } from "./entities/finance-partner.entity";
import { PayrollRun } from "./entities/payroll-run.entity";
import { PayrollRunWalletDeduction } from "./entities/payroll-run-wallet-deduction.entity";
import { PayrollRunPartnerAllocation } from "./entities/payroll-run-partner-allocation.entity";
import { FinanceModule } from "./finance/finance.module";
import { SupportModule } from "./support/support.module";
import { SecurityModule } from "./security/security.module";
import { MaintenanceInterceptor } from "./settings/maintenance.interceptor";
import { QuestionAiExplanation } from "./entities/question-ai-explanation.entity";
import { EmailModule } from "./email/email.module";
import { EncryptionModule } from "./encryption/encryption.module";
import { EncryptionInterceptor } from "./encryption/encryption.interceptor";
import { HealthModule } from "./health/health.module";
import { AllExceptionsFilter } from "./filters/all-exceptions.filter";
import { TelegramService } from "./integrations/telegram.service";
import { RevisionModule } from "./revision/revision.module";
import { RevisionSession } from "./entities/revision-session.entity";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    CacheConfigModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      useFactory: () => buildRateLimitOptions(),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get("DB_HOST"),
        port: configService.get("DB_PORT"),
        username: configService.get("DB_USERNAME"),
        password: configService.get("DB_PASSWORD"),
        database: configService.get("DB_DATABASE"),
        entities: [
          // User Entities
          User,
          UserPreferences,
          // Content Entities
          MainBank,
          Subject,
          System,
          Topic,
          QuestionBank,
          Question,
          QuestionOption,
          QuestionGrouping,
          // Per-bank subject/system order override
          QuestionBankSubjectOrder,
          QuestionBankSystemOrder,
          // Behavioral Analytics
          QuestionInteraction,
          QuestionSubmission,
          // Contest System
          Contest,
          ContestParticipant,
          ContestSubmission,
          ContestQuestion,
          // Test System
          Test,
          TestQuestion,
          // Notebook System
          NotebookEntry,
          QuestionFeedback,
          // Messaging System
          Message,
          // Library System
          LibraryArticle,
          LibraryArticleLocation,
          LibraryTooltip,
          ArticleProgress,
          ArticleHighlight,
          ArticleAiSummary,
          AiUsageLog,
          AiUserAccessLog,
          LibraryBookmarkState,
          QuestionNote,
          PendingPayment,
          PaymentApproval,
          PromoCode,
          PricingPlan,
          AdminHistory,
          AdminUserNote,
          Notification,
          NotificationRead,
          AdminExpense,
          SupportTicket,
          TicketMessage,
          AffiliateReferral,
          LabValue,
          FlashcardDeck,
          FlashcardStats,
          Flashcard,
          FlashcardReview,
          TestAnalyticsSnapshot,
          UserAnalyticsStats,
          UserDimensionStats,
          JobPosting,
          JobApplication,
          UserActivityLog,
          AppSetting,
          Partner,
          RequestRateLimitAlert,
          SecurityIncident,
          SecurityActorState,
          UserQuotaCounter,
          BlockedIp,
          BlockedIpAttempt,
          QuestionAiExplanation,
          UserDailyStats,
          UserQuestionHighlight,
          UserQuestionMark,
          SpecialBadgeType,
          UserSpecialBadge,
          // Finance Suite
          FinanceSetting,
          Wallet,
          WalletLedgerEntry,
          PayrollEmployee,
          PayrollExpense,
          FinancePartner,
          PayrollRun,
          PayrollRunWalletDeduction,
          PayrollRunPartnerAllocation,
          // Revision
          RevisionSession,
        ],
        synchronize: false,
        retryAttempts: 10,
        retryDelay: 3000,
        // Custom logger that counts statement_timeout (SQLSTATE 57014)
        // cancellations. The DatabaseMonitorService reads from it to drive
        // alerting. Other log levels are dropped so we don't spam stdout.
        logging: ["error", "warn"],
        logger: typeOrmTimeoutLogger,
        ssl:
          configService.get("DB_SSL_MODE") === "verify-full"
            ? {
                rejectUnauthorized: false,
              }
            : false,
        extra: {
          // Connection pool sizing
          //
          // Prod Postgres `max_connections = 100`. We allocate 25 per app
          // instance — enough headroom for two backend instances (50 total)
          // plus admin tooling, migrations, and replication slots, while
          // still leaving the DB room to breathe.
          //
          // Was: max=10 — that capped sustained throughput at ~10-15 RPS
          // mixed workload before requests started queueing past the (then
          // 30s) connection-wait timeout and surfacing as 500s to users.
          max: 25,
          // Keep two warm connections idle so the first request after a
          // quiet period doesn't pay the 50-100ms TCP+TLS handshake cost.
          min: 2,
          idleTimeoutMillis: 30000,
          // Wait up to 10s for a free connection before failing the request.
          // 5s was too tight — it would fail legitimate requests during
          // brief saturation bursts and could break migrations running
          // alongside the live app. 10s gives the pool time to recycle
          // without making the user feel the app is hung.
          connectionTimeoutMillis: 10000,
          // Postgres-level kill switch for runaway queries. Any single
          // statement (analytics scan, missing-index full table scan, etc.)
          // running longer than 30s is terminated automatically, freeing
          // the connection back to the pool. Without this, one slow query
          // can lock up a pool slot indefinitely.
          //
          // 30s sits comfortably above:
          //   - The slowest legitimate analytics aggregation we currently see
          //     in pg_stat_statements (~300ms p99).
          //   - Bulk operations like multi-question save during admin work.
          //   - One-off complex report queries.
          // It's still well below "the user has given up and closed the tab"
          // (~60s+), so a truly stuck query still gets killed fast enough to
          // protect the pool.
          statement_timeout: 30000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    TestsModule,
    SubscriptionsModule,
    NotebookModule,
    ContestsModule,
    MessagesModule,
    LibraryModule,
    NotesModule,
    AdminModule,
    AffiliateModule,
    LabValuesModule,
    FlashcardsModule,
    MediaModule,
    CareersModule,
    ActivityModule,
    SettingsModule,
    SecurityModule,
    FinanceModule,
    SupportModule,
    EmailModule,
    EncryptionModule,
    HealthModule,
    RevisionModule,
  ],
  providers: [
    // TelegramService here so AllExceptionsFilter (APP_FILTER) can inject it.
    // Its deps — SettingsService (via SettingsModule), CacheManager, ConfigService — are all available.
    TelegramService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MaintenanceInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: EncryptionInterceptor,
    },
  ],
})
export class AppModule {}
