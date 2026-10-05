import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../entities/user.entity';
import { UserPreferences } from '../entities/user-preferences.entity';
import { ContestParticipant } from '../entities/contest-participant.entity';
import { QuestionSubmission } from '../entities/question-submission.entity';
import { QuestionInteraction } from '../entities/question-interaction.entity';
import { QuestionNote } from '../entities/question-note.entity';
import { QuestionFeedback } from '../entities/question-feedback.entity';
import { Test } from '../entities/test.entity';
import { TestQuestion } from '../entities/test-question.entity';
import { TestAnalyticsSnapshot } from '../entities/test-analytics-snapshot.entity';
import { UserAnalyticsStats } from '../entities/user-analytics-stats.entity';
import { UserDimensionStats } from '../entities/user-dimension-stats.entity';
import { AdminHistory } from '../entities/admin-history.entity';
import { UserActivityLog } from '../entities/user-activity-log.entity';
import { BlockedIp } from '../entities/blocked-ip.entity';
import { UserDailyStats } from '../entities/user-daily-stats.entity';
import { UserSpecialBadge } from '../entities/user-special-badge.entity';
import { SpecialBadgeType } from '../entities/special-badge-type.entity';

@Module({
  imports: [
    SettingsModule,
    TypeOrmModule.forFeature([
      User,
      UserPreferences,
      ContestParticipant,
      QuestionSubmission,
      QuestionInteraction,
      QuestionNote,
      QuestionFeedback,
      Test,
      TestQuestion,
      TestAnalyticsSnapshot,
      UserAnalyticsStats,
      UserDimensionStats,
      AdminHistory,
      UserActivityLog,
      BlockedIp,
      UserDailyStats,
      UserSpecialBadge,
      SpecialBadgeType,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
