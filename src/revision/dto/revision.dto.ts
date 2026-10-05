import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateRevisionSessionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qBankId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  subjectId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  systemId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  chunkSize: number;
}

export class UpdateProgressDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lastViewedIndex: number;
}
