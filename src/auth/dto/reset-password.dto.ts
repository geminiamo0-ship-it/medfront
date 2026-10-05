import { IsEmail, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email of the user resetting password',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'A3K7P9',
    description:
      '6-character alphanumeric recovery code sent to email. ' +
      'Case-insensitive on verification (lowercase is accepted).',
  })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiProperty({
    example: 'newpassword123',
    description: 'The new password for the account',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword: string;
}
