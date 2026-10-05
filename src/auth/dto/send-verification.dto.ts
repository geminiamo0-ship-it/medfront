import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendVerificationDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address to send the verification OTP to',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
