import {
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  ValidateIf,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: "John Doe Updated",
    description: "Full name of the user",
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: "CA",
    description: "ISO country code (2 letters)",
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  @Matches(/^[A-Z]{2}$/, {
    message: "Country must be a valid 2-letter ISO code in uppercase",
  })
  country?: string;

  @ApiPropertyOptional({
    example: "JohnD",
    description: "Unique nickname for the user",
  })
  @IsOptional()
  @ValidateIf((o) => o.nickname !== "")
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  nickname?: string;

  @ApiPropertyOptional({
    example: "1995-06-15",
    description: "Date of birth (YYYY-MM-DD format)",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Date of birth must be in YYYY-MM-DD format",
  })
  dateOfBirth?: string;

  @ApiPropertyOptional({
    example: "+1234567890",
    description: "Phone number in international format (e.g., +1234567890)",
  })
  @IsOptional()
  @ValidateIf((o) => o.phoneNumber !== "")
  @IsString()
  @Matches(/^\+?\d{6,17}$/, { message: "Please provide a valid phone number" })
  @MaxLength(20, { message: "Phone number must not exceed 20 characters" })
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: "johndoe",
    description: "Telegram username for communication",
  })
  @IsOptional()
  @ValidateIf((o) => o.telegramUsername !== "")
  @IsString()
  @MaxLength(100)
  telegramUsername?: string;
}
