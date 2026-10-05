import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { LibraryService } from './library.service';
import { CreateLibraryArticleDto, UpdateLibraryArticleDto } from './dto/admin-library.dto';
import { AdminHistoryService } from '../admin/admin-history.service';
import { AdminGateGuard } from '../admin/admin-gate.guard';

@ApiTags('Admin - Library')
@ApiBearerAuth()
@Controller('admin/library')
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminLibraryController {
  constructor(
    private readonly libraryService: LibraryService,
    private readonly historyService: AdminHistoryService,
  ) {}

  @Get('structure')
  @ApiOperation({ summary: 'Get library structure for admin' })
  async getStructure() {
    const data = await this.libraryService.getAdminStructure();
    return { success: true, data };
  }

  @Get('articles/:id')
  @ApiOperation({ summary: 'Get library article (admin)' })
  async getArticle(@Param('id', ParseIntPipe) id: number) {
    const data = await this.libraryService.getAdminArticle(id);
    return { success: true, data };
  }

  @Post('articles')
  @ApiOperation({ summary: 'Create library article (admin)' })
  async createArticle(@Body() body: CreateLibraryArticleDto, @Request() req) {
    const article = await this.libraryService.createAdminArticle(body);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'CREATE_LIBRARY_ARTICLE',
      'LibraryArticle',
      article.id.toString(),
      { title: article.name, category: article.category },
      'Medical Library',
    );
    return { success: true, data: article };
  }

  @Patch('articles/:id')
  @ApiOperation({ summary: 'Update library article (admin)' })
  async updateArticle(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateLibraryArticleDto,
    @Request() req,
  ) {
    const article = await this.libraryService.updateAdminArticle(id, body);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'UPDATE_LIBRARY_ARTICLE',
      'LibraryArticle',
      id.toString(),
      body,
      'Medical Library',
    );
    return { success: true, data: article };
  }

  @Delete('articles/:id')
  @ApiOperation({ summary: 'Delete library article (admin)' })
  async deleteArticle(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const result = await this.libraryService.deleteAdminArticle(id);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'DELETE_LIBRARY_ARTICLE',
      'LibraryArticle',
      id.toString(),
      undefined,
      'Medical Library',
    );
    return result;
  }

  @Delete('cache')
  @ApiOperation({ summary: 'Purge ALL library cache entries from Redis' })
  async purgeAllCache(@Request() req) {
    const result = await this.libraryService.purgeCache();
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'PURGE_LIBRARY_CACHE',
      'LibraryCache',
      'all',
      { deleted: result.deleted },
      'Medical Library',
    );
    return { success: true, ...result };
  }

  @Delete('cache/:source')
  @ApiOperation({ summary: 'Purge cache entries for one library source (call after import)' })
  async purgeSourceCache(@Param('source') source: string, @Request() req) {
    const result = await this.libraryService.purgeCache(source);
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'PURGE_LIBRARY_CACHE',
      'LibraryCache',
      result.source,
      { deleted: result.deleted },
      'Medical Library',
    );
    return { success: true, ...result };
  }

  @Post('cache/warm/:source')
  @ApiOperation({ summary: 'Trigger cache warmup for one source (runs in background). Always forces a full re-scan.' })
  async warmSourceCache(@Param('source') source: string, @Request() req) {
    // Fire-and-forget — warmup can take minutes on big sources; caller gets
    // an immediate ack. Progress visible in server logs. force=true bypasses
    // the idempotency marker so an admin can rewarm without a preceding purge.
    this.libraryService
      .warmLibraryCache(source, { force: true })
      .catch((err) =>
        console.error(`[AdminLibraryController] warm failed for ${source}`, err),
      );
    await this.historyService.record(
      req.user.email || req.user.id.toString(),
      'WARM_LIBRARY_CACHE',
      'LibraryCache',
      source,
      undefined,
      'Medical Library',
    );
    return { success: true, message: `Warmup started for ${source}` };
  }
}
