import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, Max, Min, IsBoolean, IsString, IsOptional, IsIn } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminGateGuard } from '../admin/admin-gate.guard';
import { SettingsService } from '../settings/settings.service';
import { AdminHistoryService } from '../admin/admin-history.service';
import { UserRole } from '../entities/user.entity';

export class UpdateFlagsDto {
  /**
   * @deprecated Google sign-in was retired. The field is kept here ONLY so the
   * global ValidationPipe (forbidNonWhitelisted: true) doesn't 400 stale admin
   * bundles still in the browser cache that send `enableGoogleAuth` in the
   * PATCH body. The handler does NOT read this field — it's silently dropped.
   * Remove once we're confident no cached admin sessions remain (~30 days).
   */
  @IsBoolean()
  @IsOptional()
  enableGoogleAuth?: boolean;

  @IsBoolean()
  @IsOptional()
  enableTelegramPaymentAlerts?: boolean;

  @IsString()
  @IsOptional()
  payoutPeriodFrom?: string;

  @IsString()
  @IsOptional()
  payoutPeriodTo?: string;

  @IsBoolean()
  @IsOptional()
  maintenanceMode?: boolean;

  @IsBoolean()
  @IsOptional()
  maintenanceShowRedirect?: boolean;

  @IsString()
  @IsOptional()
  maintenanceMessage?: string;

  @IsString()
  @IsOptional()
  maintenanceRedirectUrl?: string;
}

class UpdateTrialDaysDto {
  @IsInt()
  @Min(0)
  @Max(365)
  @IsNotEmpty()
  trialDays: number;
}

class UpdateSecurityThresholdsDto {
  @IsInt()
  @Min(0)
  @IsNotEmpty()
  medium: number;

  @IsInt()
  @Min(0)
  @IsNotEmpty()
  high: number;

  @IsInt()
  @Min(0)
  @IsNotEmpty()
  highest: number;

  @IsInt()
  @Min(0)
  @IsNotEmpty()
  testCreationThreshold: number;
}

class UpdateAiSettingsDto {
  @IsString()
  @IsIn(['flash', 'pro'])
  @IsOptional()
  model?: 'flash' | 'pro';

  @IsString()
  @IsIn(['non-thinking', 'thinking'])
  @IsOptional()
  thinkingMode?: 'non-thinking' | 'thinking';

  @IsInt()
  @Min(1)
  @Max(100000)
  @IsOptional()
  dailyGlobalLimit?: number;

  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  dailyPerUserFree?: number;

  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  dailyPerUserPremium?: number;
}

@ApiTags('Admin - Settings')
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminSettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly historyService: AdminHistoryService,
  ) {}

  private checkAdminRole(user: any) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
  }

  @Get('trial')
  @ApiOperation({ summary: 'Get current free trial duration in days' })
  @ApiResponse({ status: 200, description: 'Trial days retrieved' })
  async getTrialDays(@Request() req) {
    this.checkAdminRole(req.user);
    const trialDays = await this.settingsService.getNumber('FREE_TRIAL_DAYS', 7);
    return { success: true, data: { trialDays } };
  }

  @Patch('trial')
  @ApiOperation({ summary: 'Update free trial duration (retroactive)' })
  @ApiResponse({ status: 200, description: 'Trial days updated' })
  async updateTrialDays(@Request() req, @Body() body: UpdateTrialDaysDto) {
    this.checkAdminRole(req.user);

    const trialDays = Number(body.trialDays);
    if (isNaN(trialDays) || trialDays < 0 || trialDays > 365) {
      throw new BadRequestException('trialDays must be a number between 0 and 365');
    }

    const adminEmail =
      req.user.email || req.user.userId?.toString() || req.user.id?.toString();

    // Read the current value BEFORE updating so we can log the diff
    const previousTrialDays = await this.settingsService.getNumber('FREE_TRIAL_DAYS', 7);

    await this.settingsService.setNumber('FREE_TRIAL_DAYS', trialDays, adminEmail);

    await this.historyService.record(
      adminEmail,
      'UPDATE_TRIAL_DAYS',
      'AppSetting',
      'FREE_TRIAL_DAYS',
      {
        before: { trialDays: previousTrialDays },
        after:  { trialDays },
      },
      'Settings',
    );

    return { success: true, data: { trialDays } };
  }

  @Get('flags')
  @ApiOperation({ summary: 'Get application feature flags' })
  @ApiResponse({ status: 200, description: 'Return feature flags object' })
  async getFeatureFlags(@Request() req) {
    this.checkAdminRole(req.user);
    const rawTelegramAlerts = await this.settingsService.getString(
      'ENABLE_TELEGRAM_PAYMENT_ALERTS',
      'false',
    );
    const payoutPeriodFrom = await this.settingsService.getString('PAYOUT_PERIOD_FROM', '');
    const payoutPeriodTo = await this.settingsService.getString('PAYOUT_PERIOD_TO', '');
    const rawMaintenanceMode = await this.settingsService.getString('MAINTENANCE_MODE', 'false');
    const maintenanceMessage = await this.settingsService.getString('MAINTENANCE_MESSAGE', "We're currently upgrading our servers to improve your experience. MedPark will be back online shortly. Thank you for your patience!");
    const maintenanceRedirectUrl = await this.settingsService.getString('MAINTENANCE_REDIRECT_URL', '');
    const rawShowRedirect = await this.settingsService.getString('MAINTENANCE_SHOW_REDIRECT', 'false');

    return {
      success: true,
      data: {
        enableTelegramPaymentAlerts: rawTelegramAlerts.toLowerCase() === 'true',
        payoutPeriodFrom,
        payoutPeriodTo,
        maintenanceMode: rawMaintenanceMode.toLowerCase() === 'true',
        maintenanceMessage,
        maintenanceRedirectUrl,
        maintenanceShowRedirect: rawShowRedirect.toLowerCase() === 'true',
      },
    };
  }

  @Patch('flags')
  @ApiOperation({ summary: 'Update application feature flags remotely' })
  @ApiResponse({ status: 200, description: 'Flags updated successfully' })
  async updateFeatureFlags(@Request() req, @Body() body: UpdateFlagsDto) {
    this.checkAdminRole(req.user);

    const adminEmail = req.user.email || req.user.userId?.toString() || req.user.id?.toString();
    const updates: Record<string, any> = {};

    if (body.enableTelegramPaymentAlerts !== undefined) {
      await this.settingsService.setString(
        'ENABLE_TELEGRAM_PAYMENT_ALERTS',
        body.enableTelegramPaymentAlerts ? 'true' : 'false',
        adminEmail
      );
      updates.enableTelegramPaymentAlerts = body.enableTelegramPaymentAlerts;
    }
    
    if (body.payoutPeriodFrom !== undefined) {
      await this.settingsService.setString(
        'PAYOUT_PERIOD_FROM',
        body.payoutPeriodFrom,
        adminEmail
      );
      updates.payoutPeriodFrom = body.payoutPeriodFrom;
    }

    if (body.payoutPeriodTo !== undefined) {
      await this.settingsService.setString(
        'PAYOUT_PERIOD_TO',
        body.payoutPeriodTo,
        adminEmail
      );
      updates.payoutPeriodTo = body.payoutPeriodTo;
    }

    if (body.maintenanceMode !== undefined) {
      await this.settingsService.setString(
        'MAINTENANCE_MODE',
        body.maintenanceMode ? 'true' : 'false',
        adminEmail
      );
      updates.maintenanceMode = body.maintenanceMode;
    }

    if (body.maintenanceMessage !== undefined) {
      await this.settingsService.setString(
        'MAINTENANCE_MESSAGE',
        body.maintenanceMessage,
        adminEmail
      );
      updates.maintenanceMessage = body.maintenanceMessage;
    }

    if (body.maintenanceRedirectUrl !== undefined) {
      await this.settingsService.setString(
        'MAINTENANCE_REDIRECT_URL',
        body.maintenanceRedirectUrl,
        adminEmail
      );
      updates.maintenanceRedirectUrl = body.maintenanceRedirectUrl;
    }

    if (body.maintenanceShowRedirect !== undefined) {
      await this.settingsService.setString(
        'MAINTENANCE_SHOW_REDIRECT',
        body.maintenanceShowRedirect ? 'true' : 'false',
        adminEmail
      );
      updates.maintenanceShowRedirect = body.maintenanceShowRedirect;
    }

    await this.historyService.record(
      adminEmail,
      'UPDATE_FEATURE_FLAGS',
      'AppSetting',
      'FLAGS',
      { updates },
      'Settings',
    );

    return {
      success: true,
      data: updates,
    };
  }

  @Get('security')
  @ApiOperation({ summary: 'Get security thresholds for activity alerts' })
  @ApiResponse({ status: 200, description: 'Security thresholds retrieved' })
  async getSecurityThresholds(@Request() req) {
    this.checkAdminRole(req.user);
    const medium = await this.settingsService.getNumber('SECURITY_ALERT_MEDIUM', 100);
    const high = await this.settingsService.getNumber('SECURITY_ALERT_HIGH', 150);
    const highest = await this.settingsService.getNumber('SECURITY_ALERT_HIGHEST', 200);
    const testCreationThreshold = await this.settingsService.getNumber(
      'SECURITY_TEST_CREATE_THRESHOLD',
      3,
    );
    return { success: true, data: { medium, high, highest, testCreationThreshold } };
  }

  @Patch('security')
  @ApiOperation({ summary: 'Update security thresholds for activity alerts' })
  @ApiResponse({ status: 200, description: 'Security thresholds updated' })
  async updateSecurityThresholds(
    @Request() req,
    @Body() body: UpdateSecurityThresholdsDto,
  ) {
    this.checkAdminRole(req.user);

    const medium = Number(body.medium);
    const high = Number(body.high);
    const highest = Number(body.highest);
    const testCreationThreshold = Number(body.testCreationThreshold);

    if ([medium, high, highest, testCreationThreshold].some((value) => Number.isNaN(value))) {
      throw new BadRequestException('All thresholds must be numbers');
    }

    if (!(medium < high && high < highest)) {
      throw new BadRequestException('Thresholds must be ascending: medium < high < highest');
    }

    const adminEmail =
      req.user.email || req.user.userId?.toString() || req.user.id?.toString();

    const previous = {
      medium: await this.settingsService.getNumber('SECURITY_ALERT_MEDIUM', 100),
      high: await this.settingsService.getNumber('SECURITY_ALERT_HIGH', 150),
      highest: await this.settingsService.getNumber('SECURITY_ALERT_HIGHEST', 200),
      testCreationThreshold: await this.settingsService.getNumber(
        'SECURITY_TEST_CREATE_THRESHOLD',
        3,
      ),
    };

    await this.settingsService.setNumber('SECURITY_ALERT_MEDIUM', medium, adminEmail);
    await this.settingsService.setNumber('SECURITY_ALERT_HIGH', high, adminEmail);
    await this.settingsService.setNumber('SECURITY_ALERT_HIGHEST', highest, adminEmail);
    await this.settingsService.setNumber(
      'SECURITY_TEST_CREATE_THRESHOLD',
      testCreationThreshold,
      adminEmail,
    );

    await this.historyService.record(
      adminEmail,
      'UPDATE_SECURITY_THRESHOLDS',
      'AppSetting',
      'SECURITY_ALERTS',
      {
        before: previous,
        after: { medium, high, highest, testCreationThreshold },
      },
      'Security',
    );

    return { success: true, data: { medium, high, highest, testCreationThreshold } };
  }

  // ── AI Tutor Settings ──────────────────────────────────────────────

  @Get('ai')
  @ApiOperation({ summary: 'Get AI Tutor settings (model, thinking, limits)' })
  @ApiResponse({ status: 200, description: 'AI settings retrieved' })
  async getAiSettings(@Request() req) {
    this.checkAdminRole(req.user);

    const [model, thinkingMode, dailyGlobalLimit, dailyPerUserFree, dailyPerUserPremium] =
      await Promise.all([
        this.settingsService.getString('AI_MODEL', 'flash'),
        this.settingsService.getString('AI_THINKING_MODE', 'non-thinking'),
        this.settingsService.getNumber('AI_DAILY_GLOBAL_LIMIT', 500),
        this.settingsService.getNumber('AI_DAILY_PER_USER_FREE', 5),
        this.settingsService.getNumber('AI_DAILY_PER_USER_PREMIUM', 50),
      ]);

    return {
      success: true,
      data: { model, thinkingMode, dailyGlobalLimit, dailyPerUserFree, dailyPerUserPremium },
    };
  }

  @Patch('ai')
  @ApiOperation({ summary: 'Update AI Tutor settings' })
  @ApiResponse({ status: 200, description: 'AI settings updated' })
  async updateAiSettings(@Request() req, @Body() body: UpdateAiSettingsDto) {
    this.checkAdminRole(req.user);

    const adminEmail =
      req.user.email || req.user.userId?.toString() || req.user.id?.toString();
    const updates: Record<string, any> = {};

    if (body.model !== undefined) {
      await this.settingsService.setString('AI_MODEL', body.model, adminEmail);
      updates.model = body.model;
    }
    if (body.thinkingMode !== undefined) {
      await this.settingsService.setString('AI_THINKING_MODE', body.thinkingMode, adminEmail);
      updates.thinkingMode = body.thinkingMode;
    }
    if (body.dailyGlobalLimit !== undefined) {
      await this.settingsService.setNumber('AI_DAILY_GLOBAL_LIMIT', body.dailyGlobalLimit, adminEmail);
      updates.dailyGlobalLimit = body.dailyGlobalLimit;
    }
    if (body.dailyPerUserFree !== undefined) {
      await this.settingsService.setNumber('AI_DAILY_PER_USER_FREE', body.dailyPerUserFree, adminEmail);
      updates.dailyPerUserFree = body.dailyPerUserFree;
    }
    if (body.dailyPerUserPremium !== undefined) {
      await this.settingsService.setNumber('AI_DAILY_PER_USER_PREMIUM', body.dailyPerUserPremium, adminEmail);
      updates.dailyPerUserPremium = body.dailyPerUserPremium;
    }

    await this.historyService.record(
      adminEmail,
      'UPDATE_AI_SETTINGS',
      'AppSetting',
      'AI_TUTOR',
      { updates },
      'Settings',
    );

    return { success: true, data: updates };
  }
}
