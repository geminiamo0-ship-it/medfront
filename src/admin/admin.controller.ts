import { BadRequestException, Controller, Get, Post, Patch, Delete, Body, Query, Param, UseGuards, Request, Header, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { AdminStatsService } from './admin-stats.service';
import { AdminQuestionsService } from './admin-questions.service';
import { AdminHistoryService } from './admin-history.service';
import { UsersService } from '../users/users.service';
import { TicketsService } from '../tickets/tickets.service';
import { AdminGateGuard } from './admin-gate.guard';
import { SettingsService } from '../settings/settings.service';
import { AdminUserNotesService } from './admin-user-notes.service';
import { InjectRepository } from '@nestjs/typeorm';
import { UpdateFlagsDto } from '../subscriptions/admin-settings.controller';
import { Repository } from 'typeorm';
import { Partner } from '../entities/partner.entity';
import { AdminQuestionFeedbackService } from './admin-question-feedback.service';
import { AdminBadgesService } from './admin-badges.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(
    private statsService: AdminStatsService,
    private questionsService: AdminQuestionsService,
    private historyService: AdminHistoryService,
    private usersService: UsersService,
    private ticketsService: TicketsService,
    private settingsService: SettingsService,
    private adminUserNotesService: AdminUserNotesService,
    @InjectRepository(Partner)
    private partnersRepo: Repository<Partner>,
    private feedbackService: AdminQuestionFeedbackService,
    private badgesService: AdminBadgesService,
  ) {}

  @Get('stats')
  async getStats() {
    return this.statsService.getGlobalStats();
  }

  @Get('settings/flags')
  async getFeatureFlags() {
    const rawTelegramAlerts = await this.settingsService.getString(
      'ENABLE_TELEGRAM_PAYMENT_ALERTS',
      'false',
    );
    const enableTelegramPaymentAlerts = rawTelegramAlerts.toLowerCase() === 'true';

    const payoutPeriodFrom = await this.settingsService.getString('PAYOUT_PERIOD_FROM', '');
    const payoutPeriodTo = await this.settingsService.getString('PAYOUT_PERIOD_TO', '');

    const rawMaintenanceMode = await this.settingsService.getString('MAINTENANCE_MODE', 'false');
    const maintenanceMode = rawMaintenanceMode.toLowerCase() === 'true';

    const maintenanceMessage = await this.settingsService.getString(
      'MAINTENANCE_MESSAGE',
      "We're currently upgrading our servers to improve your experience. MedPark will be back online shortly. Thank you for your patience!",
    );
    const maintenanceRedirectUrl = await this.settingsService.getString('MAINTENANCE_REDIRECT_URL', '');
    const rawShowRedirect = await this.settingsService.getString('MAINTENANCE_SHOW_REDIRECT', 'false');
    const maintenanceShowRedirect = rawShowRedirect.toLowerCase() === 'true';

    return {
      success: true,
      data: {
        enableTelegramPaymentAlerts,
        payoutPeriodFrom,
        payoutPeriodTo,
        maintenanceMode,
        maintenanceMessage,
        maintenanceRedirectUrl,
        maintenanceShowRedirect,
      },
    };
  }

  @Patch('settings/flags')
  async updateFeatureFlags(
    @Body() flags: UpdateFlagsDto,
    @Request() req,
  ) {
    if (flags.enableTelegramPaymentAlerts !== undefined) {
      await this.settingsService.setString(
        'ENABLE_TELEGRAM_PAYMENT_ALERTS',
        flags.enableTelegramPaymentAlerts.toString(),
        req.user.email,
      );
    }
    if (flags.payoutPeriodFrom !== undefined) {
      await this.settingsService.setString('PAYOUT_PERIOD_FROM', flags.payoutPeriodFrom, req.user.email);
    }
    if (flags.payoutPeriodTo !== undefined) {
      await this.settingsService.setString('PAYOUT_PERIOD_TO', flags.payoutPeriodTo, req.user.email);
    }
    if (flags.maintenanceMode !== undefined) {
      await this.settingsService.setString('MAINTENANCE_MODE', flags.maintenanceMode.toString(), req.user.email);
    }
    if (flags.maintenanceMessage !== undefined) {
      await this.settingsService.setString('MAINTENANCE_MESSAGE', flags.maintenanceMessage, req.user.email);
    }
    if (flags.maintenanceRedirectUrl !== undefined) {
      const safeUrl = this.validateMaintenanceRedirectUrl(flags.maintenanceRedirectUrl);
      await this.settingsService.setString('MAINTENANCE_REDIRECT_URL', safeUrl, req.user.email);
    }
    if (flags.maintenanceShowRedirect !== undefined) {
      await this.settingsService.setString('MAINTENANCE_SHOW_REDIRECT', flags.maintenanceShowRedirect.toString(), req.user.email);
    }
    
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'UPDATE_FEATURE_FLAGS',
      'Settings',
      'GLOBAL',
      flags,
      'Settings',
    );

    return {
      success: true,
      data: flags,
    };
  }

  /**
   * Hardens admin-settable maintenance redirects against being weaponized into
   * a stored open redirect. Accepts:
   *   - empty string  (clears the setting)
   *   - absolute https:// URLs whose host is on the MedPark allowlist
   * Rejects: javascript:, data:, http:, protocol-relative URLs, other hosts.
   */
  private validateMaintenanceRedirectUrl(input: string): string {
    const trimmed = (input || '').trim();
    if (trimmed === '') return '';

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException('Maintenance redirect URL must be a valid absolute URL.');
    }

    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('Maintenance redirect URL must use https://.');
    }

    const allowedHostSuffixes = ['medpark.io', 'medpark.live', 't.me'];
    const host = parsed.hostname.toLowerCase();
    const isAllowed = allowedHostSuffixes.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    );
    if (!isAllowed) {
      throw new BadRequestException(
        `Maintenance redirect URL host "${host}" is not in the allowlist.`,
      );
    }

    return parsed.toString();
  }

  @Get('users')
  async getUsers(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('search') search?: string,
    @Query('subscription') subscription?: string,
    @Query('activeOnly') activeOnly?: string,
    @Query('status') status?: string,
  ) {
    const activeOnlyBool = activeOnly === 'true';
    return this.usersService.findAll(
      limit,
      offset,
      search,
      subscription,
      activeOnlyBool,
      status === 'active' || status === 'inactive' ? status : undefined,
    );
  }

  @Get('users/:id/notes')
  async getUserNotes(
    @Param('id', ParseIntPipe) userId: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.adminUserNotesService.getNotes(
      userId,
      Number(limit) || 10,
      Number(offset) || 0,
    );
  }

  @Post('users/:id/notes')
  async createUserNote(
    @Request() req,
    @Param('id', ParseIntPipe) userId: number,
    @Body() body: { note: string },
  ) {
    const adminId = Number(req.user.id || req.user.userId || null);
    const result = await this.adminUserNotesService.createNote(
      userId,
      Number.isFinite(adminId) ? adminId : null,
      body?.note || '',
    );

    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'CREATE_USER_NOTE',
      'User',
      userId.toString(),
      { note: body?.note },
      'User Hub',
    );

    return result;
  }

  @Delete('users/:id/notes/:noteId')
  async deleteUserNote(
    @Request() req,
    @Param('id', ParseIntPipe) userId: number,
    @Param('noteId', ParseIntPipe) noteId: number,
  ) {
    const result = await this.adminUserNotesService.deleteNote(noteId);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'DELETE_USER_NOTE',
      'User',
      userId.toString(),
      { noteId },
      'User Hub',
    );
    return result;
  }

  @Get('questions')
  async getQuestions(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('search') search?: string,
    @Query('step') step?: number,
    @Query('searchType') searchType?: string,
  ) {
    return this.questionsService.findAll(limit, offset, search, step, searchType);
  }

  @Get('questions/:id')
  async getQuestion(@Param('id') id: number) {
    return this.questionsService.findOne(id);
  }

  @Post('questions')
  async createQuestion(@Body() data: any, @Request() req) {
    const result = await this.questionsService.create(data);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'CREATE_QUESTION',
      'Question',
      (result as any).data.id.toString(),
      undefined,
      'Content Builder',
    );
    return result;
  }

  @Patch('questions/:id')
  async updateQuestion(@Param('id') id: number, @Body() data: any, @Request() req) {
    const result = await this.questionsService.update(id, data);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'UPDATE_QUESTION',
      'Question',
      id.toString(),
      data,
      'Content Builder',
    );
    return result;
  }

  @Delete('questions/:id')
  async deleteQuestion(@Param('id') id: number, @Request() req) {
    const result = await this.questionsService.delete(id);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'DELETE_QUESTION',
      'Question',
      id.toString(),
      undefined,
      'Content Builder',
    );
    return result;
  }

  @Get('history')
  async getHistory(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('topic') topic?: string,
  ) {
    return this.historyService.findAll(limit, offset, topic);
  }

  @Get('tickets')
  async getTickets(@Query('status') status?: string) {
    const tickets = await this.ticketsService.findAll(status);
    return {
      success: true,
      data: tickets,
    };
  }

  @Get('tickets/:id')
  async getTicketDetail(@Param('id') id: string) {
    const ticket = await this.ticketsService.findOne(id);
    return {
      success: true,
      data: ticket,
    };
  }

  @Post('tickets/:id/reply')
  async replyToTicket(@Param('id') id: string, @Body('content') content: string, @Request() req) {
    const result = await this.ticketsService.addMessage(id, req.user.id, content, undefined, req.user.role);
    // Auto-open ticket if it was new
    const ticket = await this.ticketsService.findOne(id);
    if (ticket.status === 'new') {
      await this.ticketsService.updateStatus(id, 'open');
    }
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'REPLY_TICKET',
      'SupportTicket',
      id.toString(),
      undefined,
      'Support',
    );
    return {
      success: true,
      data: result,
    };
  }

  @Patch('tickets/:id/status')
  async updateTicketStatus(
    @Param('id') id: string, 
    @Body('status') status: string, 
    @Body('priority') priority: string,
    @Request() req
  ) {
    if (status) await this.ticketsService.updateStatus(id, status, req.user.id);
    if (priority) await this.ticketsService.updatePriority(id, priority);
    
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'UPDATE_TICKET',
      'SupportTicket',
      id.toString(),
      { status, priority },
      'Support',
    );

    return { success: true };
  }

  @Patch('users/:id/status')
  async toggleUserStatus(
    @Param('id') id: number,
    @Body() body: { unblockLinkedIp?: boolean } | undefined,
    @Request() req,
  ) {
    const result = await this.usersService.toggleUserStatus(id, {
      unblockLinkedIp: body?.unblockLinkedIp === true,
      adminEmail: req.user.email || req.user.id?.toString() || null,
    });
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'TOGGLE_USER_STATUS',
      'User',
      id.toString(),
      { 
        newStatus: result.data.isActive,
        targetUser: { name: result.data.userName, email: result.data.userEmail },
        unblockLinkedIp: body?.unblockLinkedIp === true,
        unblockedIp: result.data.unblockedIp || null,
        unblockedIpId: result.data.unblockedIpId || null,
      },
      'User Management',
    );
    return result;
  }

  @Post('users/:id/deactivate-and-block-ip')
  async deactivateAndBlockLatestIp(@Param('id') id: number, @Request() req) {
    const adminEmail = req.user.email || req.user.id?.toString() || null;
    const result = await this.usersService.deactivateAndBlockLatestIp(
      id,
      adminEmail,
    );
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'DEACTIVATE_AND_BLOCK_IP',
      'User',
      id.toString(),
      {
        newStatus: result.data.isActive,
        targetUser: { name: result.data.userName, email: result.data.userEmail },
        blockedIp: result.data.blockedIp,
        blockedIpId: result.data.blockedIpId,
        ipAlreadyBlocked: result.data.ipAlreadyBlocked,
      },
      'User Management',
    );
    return result;
  }

  @Post('users/:id/reset-password')
  async resetUserPassword(@Param('id') id: number, @Request() req) {
    const result = await this.usersService.resetUserPassword(id);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'RESET_USER_PASSWORD',
      'User',
      id.toString(),
      { targetUser: { name: result.data.userName, email: result.data.userEmail } },
      'User Management',
    );
    return result;
  }

  // ─── Partners CRUD ───────────────────────────────────────────────────────────

  @Get('partners')
  async getPartners() {
    const partners = await this.partnersRepo.find({ order: { displayOrder: 'ASC', id: 'ASC' } });
    return { success: true, data: partners };
  }

  @Post('partners')
  async createPartner(@Body() body: { name: string; imageUrl: string; websiteUrl: string; displayOrder?: number }, @Request() req) {
    const partner = this.partnersRepo.create({
      name: body.name,
      imageUrl: body.imageUrl,
      websiteUrl: body.websiteUrl,
      displayOrder: body.displayOrder ?? 0,
      isActive: true,
    });
    const saved = await this.partnersRepo.save(partner);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'CREATE_PARTNER', 'Partner', saved.id.toString(), body, 'Partners',
    );
    return { success: true, data: saved };
  }

  @Patch('partners/:id')
  async updatePartner(@Param('id') id: number, @Body() body: Partial<{ name: string; imageUrl: string; websiteUrl: string; displayOrder: number; isActive: boolean }>, @Request() req) {
    await this.partnersRepo.update(id, body);
    const updated = await this.partnersRepo.findOne({ where: { id } });
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'UPDATE_PARTNER', 'Partner', id.toString(), body, 'Partners',
    );
    return { success: true, data: updated };
  }

  @Delete('partners/:id')
  async deletePartner(@Param('id') id: number, @Request() req) {
    await this.partnersRepo.delete(id);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'DELETE_PARTNER', 'Partner', id.toString(), undefined, 'Partners',
    );
    return { success: true };
  }

  // ─── Allowed Email Domains ─────────────────────────────────────────────────

  @Get('settings/allowed-domains')
  async getAllowedDomains() {
    const raw = await this.settingsService.getString(
      'ALLOWED_EMAIL_DOMAINS',
      '["gmail.com","yahoo.com","outlook.com","hotmail.com","live.com","msn.com","icloud.com","me.com","mac.com","proton.me","protonmail.com"]',
    );
    let domains: string[];
    try {
      domains = JSON.parse(raw);
    } catch {
      domains = [];
    }
    return { success: true, data: { domains } };
  }

  @Patch('settings/allowed-domains')
  async updateAllowedDomains(
    @Body() body: { domains: string[] },
    @Request() req,
  ) {
    const domains = (body.domains || [])
      .map(d => d.trim().toLowerCase())
      .filter(d => d.length > 0);

    await this.settingsService.setString(
      'ALLOWED_EMAIL_DOMAINS',
      JSON.stringify(domains),
      req.user.email,
    );

    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'UPDATE_ALLOWED_EMAIL_DOMAINS',
      'Settings',
      'GLOBAL',
      { domains },
      'Settings',
    );

    return { success: true, data: { domains } };
  }

  // ─── Question Feedbacks ───────────────────────────────────────────────────

  @Get('question-feedbacks')
  async getQuestionFeedbacks(@Query() query: any) {
    return this.feedbackService.findAllFeedbacks(query);
  }

  @Patch('question-feedbacks/:id/resolve')
  async resolveFeedback(
    @Param('id') id: string,
    @Body('isResolved') isResolved: boolean,
    @Request() req: any
  ) {
    const adminId = req.user?.userId || req.user?.id || 0;
    return this.feedbackService.resolveFeedback(+id, isResolved, adminId);
  }

  // ─── Badge thresholds ─────────────────────────────────────────────────────

  @Get('settings/badge-thresholds')
  async getBadgeThresholds() {
    return { success: true, data: await this.badgesService.getBadgeThresholds() };
  }

  @Patch('settings/badge-thresholds')
  async updateBadgeThresholds(
    @Body() body: { bronze?: number; silver?: number; gold?: number },
    @Request() req,
  ) {
    const data = await this.badgesService.updateBadgeThresholds(body, req.user.email ?? req.user.id.toString());
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'UPDATE_BADGE_THRESHOLDS',
      'Settings',
      'GLOBAL',
      body,
      'Badges',
    );
    return { success: true, data };
  }

  // ─── Special badge types ──────────────────────────────────────────────────

  @Get('badge-types')
  async listBadgeTypes(@Query('all') all?: string) {
    return { success: true, data: await this.badgesService.listBadgeTypes(all === 'true') };
  }

  @Post('badge-types')
  async createBadgeType(@Body() body: any, @Request() req) {
    const data = await this.badgesService.createBadgeType(body);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'CREATE_BADGE_TYPE',
      'BadgeType',
      data.id.toString(),
      { key: data.key, label: data.label },
      'Badges',
    );
    return { success: true, data };
  }

  @Patch('badge-types/:id')
  async updateBadgeType(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Request() req,
  ) {
    const data = await this.badgesService.updateBadgeType(id, body);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'UPDATE_BADGE_TYPE',
      'BadgeType',
      id.toString(),
      body,
      'Badges',
    );
    return { success: true, data };
  }

  @Delete('badge-types/:id')
  async deleteBadgeType(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const data = await this.badgesService.deleteBadgeType(id);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'DELETE_BADGE_TYPE',
      'BadgeType',
      id.toString(),
      undefined,
      'Badges',
    );
    return data;
  }

  // ─── User special badges ──────────────────────────────────────────────────

  @Get('users/:id/special-badges')
  async getUserSpecialBadges(@Param('id', ParseIntPipe) userId: number) {
    return { success: true, data: await this.badgesService.getUserBadges(userId) };
  }

  @Post('users/:id/special-badges')
  async awardBadge(
    @Param('id', ParseIntPipe) userId: number,
    @Body() body: { badgeTypeId: number; note?: string },
    @Request() req,
  ) {
    const data = await this.badgesService.awardBadge(userId, body, req.user.name ?? req.user.email ?? 'Admin');
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'AWARD_BADGE',
      'User',
      userId.toString(),
      { badgeTypeId: body.badgeTypeId, note: body.note },
      'Badges',
    );
    return { success: true, data };
  }

  @Delete('users/:id/special-badges/:badgeId')
  async revokeBadge(
    @Param('id', ParseIntPipe) userId: number,
    @Param('badgeId', ParseIntPipe) badgeId: number,
    @Request() req,
  ) {
    const data = await this.badgesService.revokeBadge(userId, badgeId);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'REVOKE_BADGE',
      'User',
      userId.toString(),
      { badgeId },
      'Badges',
    );
    return data;
  }
}
