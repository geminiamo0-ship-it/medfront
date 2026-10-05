import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  UseGuards,
  Request,
  Param,
  ParseIntPipe,
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
import { UsersService } from "./users.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { SetPasswordDto } from "./dto/set-password.dto";
import {
  UpdateProfileDto as ProfileUpdateDto,
  UpdatePrivacySettingsDto,
} from "./dto/profile.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { PUBLIC_RESOURCE_THROTTLE } from "../rate-limit/rate-limit.constants";

@ApiTags("Users")
@Controller("users")
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Put("profile")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update user profile" })
  @ApiResponse({
    status: 200,
    description: "Profile updated successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 404,
    description: "User not found",
  })
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.id, updateProfileDto);
  }

  @Post("checkin")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Record daily check-in and update login streak" })
  async checkIn(@Request() req) {
    await this.usersService.checkIn(req.user.id);
  }

  @Get("home-stats")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get home page stats: streaks and activity calendar" })
  @ApiResponse({ status: 200, description: "Home stats retrieved" })
  async getHomeStats(@Request() req) {
    return this.usersService.getHomeStats(req.user.id);
  }

  @Get("preferences")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get user preferences" })
  @ApiResponse({
    status: 200,
    description: "Preferences retrieved successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async getPreferences(@Request() req) {
    return this.usersService.getPreferences(req.user.id);
  }

  @Put("preferences")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update user preferences" })
  @ApiResponse({
    status: 200,
    description: "Preferences updated successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async updatePreferences(
    @Request() req,
    @Body() updatePreferencesDto: UpdatePreferencesDto,
  ) {
    return this.usersService.updatePreferences(
      req.user.id,
      updatePreferencesDto,
    );
  }
  @Put("password")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Change user password" })
  @ApiResponse({
    status: 200,
    description: "Password updated successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid current password or new password format",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(req.user.id, changePasswordDto);
  }

  @Post("set-password")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Set password for social login accounts" })
  @ApiResponse({
    status: 200,
    description: "Password set successfully",
  })
  async setPassword(@Request() req, @Body() setPasswordDto: SetPasswordDto) {
    return this.usersService.setPassword(
      req.user.id,
      setPasswordDto.newPassword,
    );
  }

  // Profile System Endpoints
  @Get(":userId/profile")
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle(PUBLIC_RESOURCE_THROTTLE)
  @ApiOperation({ summary: "Get user public profile" })
  @ApiResponse({ status: 200, description: "Profile retrieved successfully" })
  @ApiResponse({
    status: 404,
    description: "User not found or profile is private",
  })
  async getPublicProfile(@Param("userId", ParseIntPipe) userId: number, @Request() req) {
    const requestingUserId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.usersService.getPublicProfile(userId, requestingUserId);
  }

  @Put("profile/details")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update own profile details" })
  @ApiResponse({ status: 200, description: "Profile updated successfully" })
  async updateUserProfile(@Request() req, @Body() updateDto: ProfileUpdateDto) {
    return this.usersService.updateUserProfile(req.user.id, updateDto);
  }

  @Put("profile/privacy")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update privacy settings" })
  @ApiResponse({
    status: 200,
    description: "Privacy settings updated successfully",
  })
  async updatePrivacySettings(
    @Request() req,
    @Body() updateDto: UpdatePrivacySettingsDto,
  ) {
    return this.usersService.updatePrivacySettings(req.user.id, updateDto);
  }

  @Get("leaderboard")
  @Throttle(PUBLIC_RESOURCE_THROTTLE)
  @ApiOperation({ summary: "Get global leaderboard" })
  @ApiResponse({
    status: 200,
    description: "Leaderboard retrieved successfully",
  })
  async getLeaderboard(@Request() req) {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const search = req.query.search as string;
    return this.usersService.getLeaderboard(limit, offset, search);
  }

  @Get(":userId/stats")
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle(PUBLIC_RESOURCE_THROTTLE)
  @ApiOperation({ summary: "Get user statistics" })
  @ApiResponse({
    status: 200,
    description: "Statistics retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "User not found" })
  async getUserStats(@Param("userId", ParseIntPipe) userId: number, @Request() req) {
    const requestingUserId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.usersService.getUserStats(userId, requestingUserId);
  }

  @Get(":userId/contest-history")
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle(PUBLIC_RESOURCE_THROTTLE)
  @ApiOperation({ summary: "Get user contest history" })
  @ApiResponse({
    status: 200,
    description: "Contest history retrieved successfully",
  })
  async getContestHistory(@Param("userId", ParseIntPipe) userId: number, @Request() req) {
    const requestingUserId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.usersService.getContestHistory(userId, requestingUserId);
  }

  @Delete("progress")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset all question bank progress" })
  @ApiResponse({
    status: 200,
    description: "Progress reset successfully",
    schema: {
      example: {
        success: true,
        message: "All progress data has been reset successfully",
        deletedRecords: {
          questionSubmissions: 150,
          questionInteractions: 450,
          questionNotes: 25,
          questionFeedback: 10,
          tests: 8,
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async resetProgress(@Request() req) {
    return this.usersService.resetAllProgress(req.user.id);
  }
}
