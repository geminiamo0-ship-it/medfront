import { IsString, IsNotEmpty, IsEnum, IsNumber, IsDateString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { USMLEStep } from '../../entities/question-bank.entity';
import { ContestType, ContestStatus } from '../../entities/contest.entity';
import { QuestionDifficulty } from '../../entities/question.entity';

class ContestRulesDto {
  @IsBoolean()
  @IsOptional()
  allowCalculator?: boolean;

  @IsBoolean()
  @IsOptional()
  allowNotes?: boolean;

  @IsNumber()
  @IsOptional()
  penaltyForWrongAnswer?: number;

  @IsBoolean()
  @IsOptional()
  bonusForSpeed?: boolean;

  @IsBoolean()
  @IsOptional()
  showLeaderboardDuringContest?: boolean;
}

class ContestScoringDto {
  @IsNumber()
  correctAnswerPoints: number;

  @IsNumber()
  wrongAnswerPenalty: number;

  @IsNumber()
  speedBonusMultiplier: number;

  @IsNumber()
  noAnswerPenalty: number;
}

export class CreateContestDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(USMLEStep)
  step: USMLEStep;

  @IsEnum(ContestType)
  type: ContestType;

  @IsNumber()
  totalQuestions: number;

  @IsNumber()
  durationMinutes: number;

  @IsDateString()
  registrationOpenTime: string;

  @IsDateString()
  registrationDeadline: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @IsEnum(ContestStatus)
  @IsOptional()
  status?: ContestStatus;

  @IsNumber()
  @IsOptional()
  maxParticipants?: number;

  @IsBoolean()
  @IsOptional()
  isPremium?: boolean;

  @IsString()
  @IsOptional()
  prizeDescription?: string;

  @IsString()
  @IsOptional()
  bannerUrl?: string;

  @ValidateNested()
  @Type(() => ContestRulesDto)
  @IsOptional()
  rules?: ContestRulesDto;

  @ValidateNested()
  @Type(() => ContestScoringDto)
  @IsOptional()
  scoring?: ContestScoringDto;
}

export class AddExistingQuestionDto {
  @IsNumber()
  questionId: number;

  @IsNumber()
  displayOrder: number;

  @IsNumber()
  @IsOptional()
  points?: number;
}

class QuestionOptionDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsBoolean()
  isCorrect: boolean;

  @IsString()
  @IsOptional()
  explanation?: string;
}

export class CreateContestQuestionDto {
  @IsString()
  @IsNotEmpty()
  textHtml: string;

  @IsString()
  @IsNotEmpty()
  explanationHtml: string;

  @IsNumber()
  subjectId: number;

  @IsNumber()
  @IsOptional()
  systemId?: number;

  @IsNumber()
  @IsOptional()
  topicId?: number;

  @IsEnum(QuestionDifficulty)
  difficulty: QuestionDifficulty;

  @IsNumber()
  step: USMLEStep;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options: QuestionOptionDto[];

  @IsNumber()
  displayOrder: number;

  @IsNumber()
  @IsOptional()
  points?: number;
}

export class RegisterContestDto {
  @IsNumber()
  contestId: number;
}

export class SubmitContestAnswerDto {
  @IsNumber()
  questionId: number;

  @IsNumber()
  selectedOptionId: number;

  @IsNumber()
  timeSpentSeconds: number;
}
