import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email of the user requesting password reset',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
