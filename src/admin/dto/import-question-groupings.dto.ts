import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportQuestionGroupingsDto {
  @IsOptional()
  @IsString()
  questionBankCode?: string;

  @IsOptional()
  @IsInt()
  @Max(2147483647)
  @Type(() => Number)
  questionBankId?: number;

  @IsArray()
  @IsArray({ each: true })
  groups: Array<Array<string | number>>;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;
}
