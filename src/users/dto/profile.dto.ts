import { IsString, IsOptional, IsInt, IsUrl, IsBoolean, MaxLength, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Profile avatar URL', maxLength: 500 })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'User bio/about section', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ description: 'Medical institution/school', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  institution?: string;

  @ApiPropertyOptional({ description: 'Expected graduation year', minimum: 2020, maximum: 2040 })
  @IsOptional()
  @IsInt()
  @Min(2020)
  @Max(2040)
  graduationYear?: number;

  @ApiPropertyOptional({ description: 'Specialization interest', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialization?: string;

  @ApiPropertyOptional({ description: 'LinkedIn profile URL', maxLength: 255 })
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  linkedinUrl?: string;

  @ApiPropertyOptional({ description: 'GitHub profile URL', maxLength: 255 })
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  githubUrl?: string;

  @ApiPropertyOptional({ description: 'Portfolio website URL', maxLength: 255 })
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  portfolioUrl?: string;

  @ApiPropertyOptional({ description: 'Location/city', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;
}

export class UpdatePrivacySettingsDto {
  @ApiPropertyOptional({ description: 'Make profile publicly visible' })
  @IsOptional()
  @IsBoolean()
  isProfilePublic?: boolean;

  @ApiPropertyOptional({ description: 'Show email on public profile' })
  @IsOptional()
  @IsBoolean()
  showEmail?: boolean;

  @ApiPropertyOptional({ description: 'Show institution on public profile' })
  @IsOptional()
  @IsBoolean()
  showInstitution?: boolean;

  @ApiPropertyOptional({ description: 'Show contest history on public profile' })
  @IsOptional()
  @IsBoolean()
  showContestHistory?: boolean;
}

export class PublicProfileDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  nickname: string;

  @ApiProperty()
  country: string;

  @ApiProperty()
  rating: number;

  @ApiProperty()
  maxRating: number;

  @ApiProperty()
  ratingTier: string;

  @ApiProperty()
  contestsParticipated: number;

  @ApiPropertyOptional()
  avatarUrl?: string;

  @ApiPropertyOptional()
  bio?: string;

  @ApiPropertyOptional()
  institution?: string;

  @ApiPropertyOptional()
  graduationYear?: number;

  @ApiPropertyOptional()
  specialization?: string;

  @ApiPropertyOptional()
  linkedinUrl?: string;

  @ApiPropertyOptional()
  githubUrl?: string;

  @ApiPropertyOptional()
  portfolioUrl?: string;

  @ApiPropertyOptional()
  location?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiProperty()
  subscriptionPlan: string;

  @ApiProperty()
  createdAt: Date;
}
