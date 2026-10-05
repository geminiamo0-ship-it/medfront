import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contest } from '../entities/contest.entity';
import { ContestParticipant } from '../entities/contest-participant.entity';
import { ContestQuestion } from '../entities/contest-question.entity';
import { ContestSubmission } from '../entities/contest-submission.entity';
import { Question } from '../entities/question.entity';
import { QuestionOption } from '../entities/question-option.entity';
import { User } from '../entities/user.entity';
import { ContestsService } from './contests.service';
import { ContestsController } from './contests.controller';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contest,
      ContestParticipant,
      ContestQuestion,
      ContestSubmission,
      Question,
      QuestionOption,
      User,
    ]),
    AdminModule,
  ],
  controllers: [ContestsController],
  providers: [ContestsService],
})
export class ContestsModule {}
