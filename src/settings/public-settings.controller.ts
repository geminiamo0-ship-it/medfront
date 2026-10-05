import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Partner } from '../entities/partner.entity';

@ApiTags('Public Settings')
@Controller('settings/public')
export class PublicSettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    @InjectRepository(Partner)
    private readonly partnersRepo: Repository<Partner>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get public configuration and feature flags' })
  @ApiResponse({ status: 200, description: 'Client config returned' })
  async getPublicConfig() {
    const rawMaintenanceMode = await this.settingsService.getString('MAINTENANCE_MODE', 'false');
    const maintenanceMode = rawMaintenanceMode.toLowerCase() === 'true';

    const maintenanceMessage = await this.settingsService.getString(
      'MAINTENANCE_MESSAGE',
      "We're currently upgrading our servers to improve your experience. MedPark will be back online shortly. Thank you for your patience!",
    );

    const maintenanceRedirectUrl = await this.settingsService.getString('MAINTENANCE_REDIRECT_URL', '');

    return {
      success: true,
      data: {
        // `enableGoogleAuth` is intentionally omitted now that Google OAuth
        // has been retired; the frontend no longer renders a Google button
        // so the flag is irrelevant. Kept in DB for historical audit data.
        maintenanceMode,
        maintenanceMessage,
        maintenanceRedirectUrl,
        maintenanceShowRedirect: (await this.settingsService.getString('MAINTENANCE_SHOW_REDIRECT', 'false')).toLowerCase() === 'true',
        // Any other non-sensitive global UI flags can be merged here in the future
      },
    };
  }

  @Get('partners')
  @ApiOperation({ summary: 'Get active partners for display on landing page' })
  @ApiResponse({ status: 200, description: 'Active partners list returned' })
  async getPublicPartners() {
    const partners = await this.partnersRepo.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
    return { success: true, data: partners };
  }
}
