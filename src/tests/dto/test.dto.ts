import { IsString, IsEnum, IsInt, IsOptional, IsArray, Min, Max, MaxLength, ValidateNested, IsBoolean, IsIn, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { TestType, TestMode } from '../../entities/test.entity';
import { QuestionDifficultyTier } from '../../entities/question.entity';
import { USMLEStep } from '../../entities/question-bank.entity';

export class TestFiltersDto {
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Max(2147483647, { each: true })
  @Type(() => Number)
  subjectIds?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Max(2147483647, { each: true })
  @Type(() => Number)
  systemIds?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Max(2147483647, { each: true })
  @Type(() => Number)
  topicIds?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Max(2147483647, { each: true })
  @Type(() => Number)
  questionBankIds?: number[];

  @IsOptional()
  @IsArray()
  @IsEnum(QuestionDifficultyTier, { each: true })
  difficulty?: QuestionDifficultyTier[]; // stored questions.difficulty tiers — see QuestionDifficultyTier

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modes?: string[]; // Populated when mode = 'mixed_modes'; each value is a valid TestMode
}

export class CreateTestDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsEnum(TestType)
  type: TestType;

  @IsEnum(TestMode)
  mode: TestMode;

  @IsInt()
  @IsEnum(USMLEStep)
  step: USMLEStep;

  @IsInt()
  @Min(1)
  @Max(200)
  totalQuestions: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => TestFiltersDto)
  filters?: TestFiltersDto;

  @IsOptional()
  @IsInt()
  @Min(60)
  timeLimitSeconds?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Max(2147483647, { each: true })
  customQuestionIds?: number[];

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  sourceTestId?: number;

  @IsOptional()
  @IsBoolean()
  isBlock?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  blockNumber?: number;
}


export class HighlightDto {
  @IsString()
  text: string;

  @IsInt()
  startIndex: number;

  @IsInt()
  endIndex: number;

  @IsString()
  color: string;

  /**
   * Which container the highlight was created in. Used on reload to re-apply a
   * highlight ONLY to its own container — otherwise a question highlight whose
   * text also appears in the explanation would bleed across. Optional for
   * backward-compat with stored highlights / cached bundles that predate it.
   */
  @IsOptional()
  @IsIn(['question', 'explanation'])
  source?: 'question' | 'explanation';
}

export class SelectionHistoryEventDto {
  @IsInt()
  @Max(2147483647)
  optionId: number;

  @IsInt()
  @Min(0)
  @Max(2147483647)
  timestampMs: number;
}

export class UpdateHighlightsDto {
  @IsInt()
  @Max(2147483647)
  questionId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HighlightDto)
  highlights: HighlightDto[];

  /** Pre-rendered question HTML with <span> highlight tags applied. */
  @IsOptional()
  @IsString()
  questionHtml?: string;

  /** Pre-rendered explanation HTML with <span> highlight tags applied. */
  @IsOptional()
  @IsString()
  explanationHtml?: string;
}

export class SubmitAnswerDto {
  @IsInt()
  @Max(2147483647)
  questionId: number;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  selectedOptionId?: number; // null if skipped

  @IsOptional()
  @IsInt()
  @Min(0)
  timeSpentSeconds?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Max(2147483647, { each: true })
  answerSequence?: number[]; // IDs of options selected in order (for behavioral tracking)

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectionHistoryEventDto)
  selectionHistory?: SelectionHistoryEventDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HighlightDto)
  highlights?: HighlightDto[];

  @IsOptional()
  isMarked?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Body for PATCH /api/tests/:id/mark — toggles the user's "marked for review"
 * flag on a question. Independent of answer submission: calling this does
 * NOT create or modify a QuestionSubmission row, so unanswered questions
 * stay genuinely untouched.
 */
export class ToggleMarkDto {
  @IsInt()
  @Max(2147483647)
  questionId: number;

  @IsBoolean()
  isMarked: boolean;
}

export class QuestionFeedbackDto {
  @IsInt()
  @Max(2147483647)
  questionId: number;

  @IsString()
  type: string; // 'error', 'clarity', 'suggestion', 'other'

  @IsString()
  comment: string;
}

export class CompleteTestDto {
  @IsInt()
  @Min(0)
  totalTimeSpentSeconds: number;
}

/**
 * Per-question payload inside SubmitAnswersBatchDto. Carries ONLY answer-state
 * (selectedOptionId, time, sequence/history). Highlights / isMarked / notes
 * are intentionally excluded — they each have their own dedicated endpoints
 * (PATCH /:id/highlights, PATCH /:id/mark) that fire live as the user
 * interacts. Including them here would duplicate writes and race the
 * dedicated tables.
 */
export class TimedBatchItemDto {
  @IsInt()
  @Max(2147483647)
  questionId: number;

  // null/undefined = omitted (user navigated past without picking).
  @IsOptional()
  @IsInt()
  @Max(2147483647)
  selectedOptionId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  timeSpentSeconds?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Max(2147483647, { each: true })
  answerSequence?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SelectionHistoryEventDto)
  selectionHistory?: SelectionHistoryEventDto[];
}

/**
 * Body for POST /api/tests/:id/submit-batch — Timed-mode End-Block / timer=0
 * bulk submit. Persists every answer + flips the test to COMPLETED in one
 * transaction. `complete` must be true today (only End-Block path exists);
 * the field is kept for forward compatibility with a future autosave mode.
 */
export class SubmitAnswersBatchDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TimedBatchItemDto)
  answers: TimedBatchItemDto[];

  @IsBoolean()
  complete: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  totalTimeSpentSeconds?: number;
}

/**
 * Body for POST /api/tests/metadata/difficulty-counts — per-tier question
 * counts for the Create Test difficulty checkboxes. Bank-level content
 * metadata (no user-specific scoping), served from a long-TTL shared cache.
 */
export class GetDifficultyCountsDto {
  @IsInt()
  @IsEnum(USMLEStep)
  step: USMLEStep;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Max(2147483647, { each: true })
  @Type(() => Number)
  questionBankIds?: number[];
}

export class GetQuestionCountsDto {
  @IsInt()
  @IsEnum(USMLEStep)
  step: USMLEStep;

  @IsOptional()
  @ValidateNested()
  @Type(() => TestFiltersDto)
  filters?: TestFiltersDto;
}

export class GetSubjectsDto {
  @IsOptional()
  @IsInt()
  @IsEnum(USMLEStep)
  step?: USMLEStep;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  questionBankIds?: number[];

  @IsOptional()
  @IsEnum(TestMode)
  mode?: TestMode;

  @IsOptional()
  @IsArray()
  @IsEnum(QuestionDifficultyTier, { each: true })
  difficulty?: QuestionDifficultyTier[];
}

export class GetSystemsWithTopicsDto {
  @IsInt()
  @IsEnum(USMLEStep)
  step: USMLEStep;

  @IsOptional()
  filters?: any; // flexible — includes subjectIds, questionBankIds, mode
}

export class UpdateTestNameDto {
  @IsString()
  @MaxLength(200)
  title: string;
}
