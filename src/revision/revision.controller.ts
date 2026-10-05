import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RevisionService } from './revision.service';
import {
  CreateRevisionSessionDto,
  UpdateProgressDto,
} from './dto/revision.dto';

@ApiTags('Revision')
@Controller('revision')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RevisionController {
  constructor(private readonly revisionService: RevisionService) {}

  @Get('overview')
  @ApiOperation({
    summary:
      'Per-subject and per-system marked + remaining counts for the picker',
  })
  async overview(
    @Request() req,
    @Query('qBankId', ParseIntPipe) qBankId: number,
  ) {
    return this.revisionService.getOverview(req.user.id, qBankId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Latest in-progress session for a slice (resume)' })
  async active(
    @Request() req,
    @Query('qBankId', ParseIntPipe) qBankId: number,
    @Query('subjectId', ParseIntPipe) subjectId: number,
    @Query('systemId') systemIdRaw?: string,
  ) {
    const systemId = this.parseOptionalInt(systemIdRaw);
    return this.revisionService.getActiveSession(
      req.user.id,
      qBankId,
      subjectId,
      systemId,
    );
  }

  @Post('sessions')
  @ApiOperation({
    summary: 'Snapshot a new revision session from marked questions',
  })
  async createSession(
    @Request() req,
    @Body() dto: CreateRevisionSessionDto,
  ) {
    return this.revisionService.createSession(req.user.id, dto);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Fetch a session payload shaped for the viewer' })
  async getSession(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.revisionService.getSession(req.user.id, id);
  }

  @Patch('sessions/:id/progress')
  @ApiOperation({ summary: 'Update resume pointer (lastViewedIndex)' })
  async updateProgress(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.revisionService.updateProgress(req.user.id, id, dto.lastViewedIndex);
  }

  @Patch('sessions/:id/complete')
  @ApiOperation({ summary: 'Mark a session as completed' })
  async complete(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.revisionService.completeSession(req.user.id, id);
  }

  @Delete('sessions/history')
  @ApiOperation({
    summary: 'Reset revision history for a slice (delete completed sessions)',
  })
  async resetHistory(
    @Request() req,
    @Query('qBankId', ParseIntPipe) qBankId: number,
    @Query('subjectId', ParseIntPipe) subjectId: number,
    @Query('systemId') systemIdRaw?: string,
  ) {
    const systemId = this.parseOptionalInt(systemIdRaw);
    return this.revisionService.resetHistory(
      req.user.id,
      qBankId,
      subjectId,
      systemId,
    );
  }

  private parseOptionalInt(raw?: string): number | null {
    if (raw === undefined || raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
}
