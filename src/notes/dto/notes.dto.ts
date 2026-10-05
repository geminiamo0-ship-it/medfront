import { IsString, IsNotEmpty, IsNumber, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateNoteDto {
  @ApiProperty({ example: 1234 })
  @IsNumber()
  @IsNotEmpty()
  questionId: number;

  @ApiProperty({
    example: "This question is about heart failure mechanisms...",
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class UpdateNoteDto {
  @ApiProperty({ example: "Updated note content..." })
  @IsString()
  @IsNotEmpty()
  content: string;
}
