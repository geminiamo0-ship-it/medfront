import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AdminController } from "./admin.controller";
import { AdminCouponsController } from "./admin-coupons.controller";
import { AdminStatsService } from "./admin-stats.service";
import { AdminQuestionsService } from "./admin-questions.service";
import { AdminHistoryService } from "./admin-history.service";
import { AdminCouponsService } from "./admin-coupons.service";
import { AdminUserNotesService } from "./admin-user-notes.service";
import { AdminNotificationsService } from "./admin-notifications.service";
import { AdminGateController } from "./admin-gate.controller";
import { AdminGateService } from "./admin-gate.service";
import { AdminGateGuard } from "./admin-gate.guard";
import { AdminLabValuesController } from "./admin-lab-values.controller";
import { AdminHistory } from "../entities/admin-history.entity";
import { User } from "../entities/user.entity";
import { Question } from "../entities/question.entity";
import { QuestionOption } from "../entities/question-option.entity";
import { SupportTicket } from "../entities/support-ticket.entity";
import { PendingPayment } from "../entities/pending-payment.entity";
import { AffiliateReferral } from "../entities/affiliate-referral.entity";
import { AdminUserNote } from "../entities/admin-user-note.entity";
import { Notification } from "../entities/notification.entity";
import { NotificationRead } from "../entities/notification-read.entity";
import { AdminExpense } from "../entities/admin-expense.entity";
import { AffiliateModule } from "../affiliate/affiliate.module";
import { UsersModule } from "../users/users.module";
import { TicketsModule } from "../tickets/tickets.module";
import { SettingsModule } from "../settings/settings.module";
import { Partner } from "../entities/partner.entity";
import { AdminNotificationsController } from "./admin-notifications.controller";
import { LabValuesModule } from "../lab-values/lab-values.module";
import { AdminExpensesController } from "./admin-expenses.controller";
import { AdminExpensesService } from "./admin-expenses.service";
import { AdminQuestionGroupingsController } from "./admin-question-groupings.controller";
import { AdminQuestionGroupingsService } from "./admin-question-groupings.service";
import { QuestionGrouping } from "../entities/question-grouping.entity";
import { QuestionBank } from "../entities/question-bank.entity";
import { AiUsageLog } from "../entities/ai-usage-log.entity";
import { AdminAiController } from "./admin-ai.controller";
import { AdminAiService } from "./admin-ai.service";
import { AdminEmailOtpController } from "./admin-email-otp.controller";
import { AdminEmailOtpService } from "./admin-email-otp.service";
import { SecurityModule } from "../security/security.module";
import { QuestionFeedback } from "../entities/question-feedback.entity";
import { AdminQuestionFeedbackService } from "./admin-question-feedback.service";
import { AdminBadgesService } from "./admin-badges.service";
import { SpecialBadgeType } from "../entities/special-badge-type.entity";
import { UserSpecialBadge } from "../entities/user-special-badge.entity";
import { AdminSignupSourcesController } from "./admin-signup-sources.controller";
import { AdminSignupSourcesService } from "./admin-signup-sources.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminHistory,
      User,
      Question,
      QuestionOption,
      SupportTicket,
      PendingPayment,
      AffiliateReferral,
      Partner,
      AdminUserNote,
      Notification,
      NotificationRead,
      AdminExpense,
      QuestionGrouping,
      QuestionBank,
      AiUsageLog,
      QuestionFeedback,
      SpecialBadgeType,
      UserSpecialBadge,
    ]),
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret:
          configService.get<string>("ADMIN_GATE_SECRET") ||
          configService.get<string>("JWT_SECRET"),
      }),
      inject: [ConfigService],
    }),
    AffiliateModule,
    UsersModule,
    TicketsModule,
    SettingsModule,
    LabValuesModule,
    forwardRef(() => SecurityModule),
  ],
  controllers: [
    AdminController,
    AdminCouponsController,
    AdminGateController,
    AdminNotificationsController,
    AdminLabValuesController,
    AdminExpensesController,
    AdminQuestionGroupingsController,
    AdminAiController,
    AdminEmailOtpController,
    AdminSignupSourcesController,
  ],
  providers: [
    AdminStatsService,
    AdminQuestionsService,
    AdminHistoryService,
    AdminCouponsService,
    AdminUserNotesService,
    AdminNotificationsService,
    AdminGateService,
    AdminGateGuard,
    AdminExpensesService,
    AdminQuestionGroupingsService,
    AdminAiService,
    AdminEmailOtpService,
    AdminQuestionFeedbackService,
    AdminBadgesService,
    AdminSignupSourcesService,
  ],
  exports: [
    AdminHistoryService,
    AdminGateGuard,
    JwtModule,
    AdminNotificationsService,
    AdminUserNotesService,
  ],
})
export class AdminModule {}
