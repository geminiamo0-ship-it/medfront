import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TicketsService } from './tickets.service';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Post()
  async create(@Request() req, @Body() data: any) {
    const result = await this.ticketsService.create(req.user.id, data);
    return { success: true, data: result };
  }

  @Get('my')
  async getMyTickets(@Request() req, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const result = await this.ticketsService.findMyTickets(
      req.user.id,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 10,
    );
    return { success: true, data: result.items, total: result.total, page: result.page, pageSize: result.pageSize };
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @Request() req) {
    const result = await this.ticketsService.findOneForUser(id, req.user.id);
    return { success: true, data: result };
  }

  @Post(':id/messages')
  async addMessage(@Param('id') id: string, @Request() req, @Body() data: any) {
    const result = await this.ticketsService.addMessage(
      id,
      req.user.id,
      data.content,
      data.attachmentUrl,
      req.user.role,
    );
    return { success: true, data: result };
  }

  @Patch(':id')
  async updateTicket(@Param('id') id: string, @Request() req, @Body() data: any) {
    const result = await this.ticketsService.updateTicketForUser(id, req.user.id, data);
    return { success: true, data: result };
  }

  @Delete(':id')
  async deleteTicket(@Param('id') id: string, @Request() req) {
    const result = await this.ticketsService.deleteTicketForUser(id, req.user.id);
    return { success: true, data: result };
  }
}
