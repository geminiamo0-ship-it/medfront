import { IsOptional, IsEnum, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Theme } from '../../entities/user-preferences.entity';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    example: 'dark',
    enum: Theme,
    description: 'UI theme preference',
  })
  @IsOptional()
  @IsEnum(Theme)
  theme?: Theme;

  @ApiPropertyOptional({
    example: true,
    description: 'Enable email notifications',
  })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Enable contest reminders',
  })
  @IsOptional()
  @IsBoolean()
  contestReminders?: boolean;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Default step (1–3 = USMLE, 4 = MRCP Passmedicine 1, 5 = MRCP Passmedicine 2)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  defaultStep?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Default question bank ID',
  })
  @IsOptional()
  @IsInt()
  defaultQuestionBankId?: number;
}
