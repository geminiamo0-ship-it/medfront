import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsDateString,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({
    example: "John Doe",
    description: "Full name of the user",
    minLength: 2,
    maxLength: 255,
  })
  @IsNotEmpty({ message: "Name is required" })
  @IsString()
  @MinLength(2, { message: "Name must be at least 2 characters long" })
  @MaxLength(255, { message: "Name must not exceed 255 characters" })
  name: string;

  @ApiProperty({
    example: "JohnD",
    description: "Unique nickname for the user",
    minLength: 2,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "Nickname must be at least 2 characters long" })
  @MaxLength(50, { message: "Nickname must not exceed 50 characters" })
  nickname?: string;

  @ApiProperty({
    example: "john@example.com",
    description: "Email address",
  })
  @IsNotEmpty({ message: "Email is required" })
  @IsEmail({}, { message: "Please provide a valid email address" })
  email: string;

  @ApiProperty({
    example: "SecurePass123!",
    description:
      "Password (minimum 8 characters, must contain uppercase, lowercase, and number/special character)",
    minLength: 8,
    maxLength: 128,
  })
  @IsNotEmpty({ message: "Password is required" })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @MaxLength(128, { message: "Password must not exceed 128 characters" })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      "Password must contain at least one uppercase letter, one lowercase letter, and one number or special character",
  })
  password: string;

  @ApiProperty({
    example: "1995-06-15",
    description: "Date of birth (YYYY-MM-DD format)",
  })
  @IsNotEmpty({ message: "Date of birth is required" })
  @IsDateString(
    {},
    { message: "Date of birth must be a valid date in YYYY-MM-DD format" },
  )
  dateOfBirth: string;

  @ApiPropertyOptional({
    example: "US",
    description: "ISO country code (2 letters, e.g., US, CA, GB)",
    minLength: 2,
    maxLength: 2,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "Country code must be exactly 2 characters" })
  @MaxLength(2, { message: "Country code must be exactly 2 characters" })
  @Matches(/^[A-Z]{2}$/, {
    message:
      "Country must be a valid 2-letter ISO code in uppercase (e.g., US, CA, GB)",
  })
  country?: string;

  @ApiProperty({
    example: "+1234567890",
    description: "Phone number in international format (e.g., +1234567890)",
  })
  @IsNotEmpty({ message: "Phone number is required" })
  @IsString()
  @Matches(/^\+?\d{6,17}$/, {
    message: "Please provide a valid phone number",
  })
  @MaxLength(20, { message: "Phone number must not exceed 20 characters" })
  phoneNumber: string;

  @ApiPropertyOptional({
    example: "Harvard University",
    description: "University or institution of the user",
    minLength: 2,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "University must be at least 2 characters long" })
  @MaxLength(255, { message: "University must not exceed 255 characters" })
  university?: string;

  @ApiPropertyOptional({
    example: "Facebook",
    description: "How the user heard about us",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Source must not exceed 100 characters" })
  heardAboutUsFrom?: string;
}
