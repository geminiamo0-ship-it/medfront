import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLibraryArticleDto {
  @ApiProperty({ description: 'Article title' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ description: 'Category / topic' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  category: string;

  @ApiProperty({ description: 'HTML content' })
  @IsString()
  @IsNotEmpty()
  contentHtml: string;

  @ApiPropertyOptional({ description: 'Optional question bank label' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  qbank?: string;
}

export class UpdateLibraryArticleDto {
  @ApiPropertyOptional({ description: 'Article title' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Category / topic' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  category?: string;

  @ApiPropertyOptional({ description: 'HTML content' })
  @IsOptional()
  @IsString()
  contentHtml?: string;

  @ApiPropertyOptional({ description: 'Optional question bank label' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  qbank?: string;
}
