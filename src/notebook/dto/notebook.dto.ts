import { IsString, IsNotEmpty, IsOptional, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateNotebookEntryDto {
  @ApiProperty({ example: "My Cardiology Notes" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ example: "<p>Key points about heart failure...</p>" })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ example: "Cardiology" })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  category?: string;
}

export class UpdateNotebookEntryDto {
  @ApiPropertyOptional({ example: "Updated Title" })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: "<p>Updated content...</p>" })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ example: "General" })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  category?: string;
}
