import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RevisionService } from './revision.service';
import { RevisionController } from './revision.controller';
import { RevisionSession } from '../entities/revision-session.entity';
import { UserQuestionMark } from '../entities/user-question-mark.entity';
import { Question } from '../entities/question.entity';
import { Subject } from '../entities/subject.entity';
import { System } from '../entities/system.entity';
import { QuestionBank } from '../entities/question-bank.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RevisionSession,
      UserQuestionMark,
      Question,
      Subject,
      System,
      QuestionBank,
    ]),
  ],
  controllers: [RevisionController],
  providers: [RevisionService],
  exports: [RevisionService],
})
export class RevisionModule {}
