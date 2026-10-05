import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { AdminGateGuard } from './admin-gate.guard';
import { AdminSignupSourcesService } from './admin-signup-sources.service';

/**
 * Read-only admin endpoint that drives the "Signup Sources" dashboard page.
 *
 * Returns aggregated counts of where users said they heard about MedPark
 * (the `heard_about_us_from` field from registration). Date-range scoped so
 * marketing can answer "how did the Tiktok push compare to the Telegram
 * channel for Q3?" without needing direct DB access.
 */
@Controller('admin/signup-sources')
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminSignupSourcesController {
  constructor(
    private readonly signupSourcesService: AdminSignupSourcesService,
  ) {}

  @Get('overview')
  async getOverview(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tzOffsetMinutes') tzOffsetMinutes?: string,
  ) {
    return this.signupSourcesService.getOverview({
      from,
      to,
      tzOffsetMinutes: tzOffsetMinutes ? Number(tzOffsetMinutes) : 0,
    });
  }

  /**
   * Aggregated by-university breakdown of registered users. The institution
   * field is free-text and full of spelling variants; the service uses an
   * aggressive normalization pipeline to group equivalent spellings before
   * counting (see `normalizeUniversityKey` in the service).
   *
   * `limit` controls how many top universities are returned individually —
   * the rest are collapsed into an "Others" tail so the chart doesn't
   * become unreadable on big datasets.
   */
  @Get('universities')
  async getUniversities(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.signupSourcesService.getUniversities({
      from,
      to,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
