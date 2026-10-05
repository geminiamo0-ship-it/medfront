import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { AUTH_THROTTLE } from "../rate-limit/rate-limit.constants";

import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({
    status: 201,
    description: "User registered successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - validation error",
  })
  @ApiResponse({
    status: 409,
    description: "Email already exists",
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post("login")
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login user" })
  @ApiResponse({
    status: 200,
    description: "Login successful",
  })
  @ApiResponse({
    status: 401,
    description: "Invalid credentials",
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post("send-verification")
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send OTP verification email" })
  @ApiResponse({
    status: 200,
    description: "Verification OTP sent successfully",
  })
  async sendVerification(@Body() body: import('./dto/send-verification.dto').SendVerificationDto) {
    return this.authService.sendVerification(body.email);
  }

  @Post("verify-otp")
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify OTP code" })
  @ApiResponse({
    status: 200,
    description: "Email verified successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid or expired OTP",
  })
  async verifyOtp(@Body() body: import('./dto/verify-otp.dto').VerifyOtpDto) {
    return this.authService.verifyOtp(body.email, body.code);
  }

  @Post("forgot-password")
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Request password reset OTP" })
  @ApiResponse({
    status: 200,
    description: "Reset code sent if email exists",
  })
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.email);
  }

  @Post("reset-password")
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset password using OTP" })
  @ApiResponse({
    status: 200,
    description: "Password reset successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid or expired reset code",
  })
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Logout user" })
  @ApiResponse({
    status: 200,
    description: "Logged out successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async logout(@Request() req) {
    const token = req.headers.authorization?.split(" ")[1];
    return this.authService.logout(req.user.id, token);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user information" })
  @ApiResponse({
    status: 200,
    description: "User information retrieved successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async getCurrentUser(@Request() req) {
    return this.authService.getCurrentUser(req.user.id);
  }
}
