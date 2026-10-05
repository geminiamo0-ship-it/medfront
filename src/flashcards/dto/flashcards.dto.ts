import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { FlashcardContentType } from '../../entities/flashcard.entity';
import { FlashcardStudyRating } from '../../entities/flashcard-review.entity';

export enum FlashcardSide {
  FRONT = 'front',
  BACK = 'back',
}

export class FlashcardContentBlockDto {
  @IsEnum(FlashcardContentType)
  type: FlashcardContentType;

  @IsString()
  @IsNotEmpty()
  value: string;
}

export class CreateFlashcardDeckDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateFlashcardDeckDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class InlineDeckDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class CreateFlashcardDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deckId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  questionId?: number;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlashcardContentBlockDto)
  frontContent?: FlashcardContentBlockDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlashcardContentBlockDto)
  backContent?: FlashcardContentBlockDto[];

  @IsOptional()
  @IsBoolean()
  isMarked?: boolean;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  markColor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => InlineDeckDto)
  createDeck?: InlineDeckDto;
}

export class UpdateFlashcardDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deckId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  questionId?: number;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlashcardContentBlockDto)
  frontContent?: FlashcardContentBlockDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlashcardContentBlockDto)
  backContent?: FlashcardContentBlockDto[];

  @IsOptional()
  @IsBoolean()
  isMarked?: boolean;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  markColor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}

export class AppendFlashcardContentDto {
  @IsEnum(FlashcardSide)
  side: FlashcardSide;

  @ValidateNested()
  @Type(() => FlashcardContentBlockDto)
  content: FlashcardContentBlockDto;
}

export class FlashcardDeckQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}

export class FlashcardQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deckId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  questionId?: number;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  markColor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isMarked?: boolean;
}

export class FlashcardStudyDeckQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class RateStudyCardDto {
  @Type(() => Number)
  @IsInt()
  cardId: number;

  @IsEnum(FlashcardStudyRating)
  rating: FlashcardStudyRating;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  elapsedMs?: number;
}

export class StudyCardActionDto {
  @Type(() => Number)
  @IsInt()
  cardId: number;
}

export enum FlashcardRescheduleMode {
  NEW = 'new',
  REVIEW = 'review',
}

export class RescheduleFlashcardDto {
  @IsEnum(FlashcardRescheduleMode)
  mode: FlashcardRescheduleMode;

  @ValidateIf((dto: RescheduleFlashcardDto) => dto.mode === FlashcardRescheduleMode.REVIEW)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;
}

