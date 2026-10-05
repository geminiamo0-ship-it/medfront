import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { AdminGateGuard } from './admin-gate.guard';
import { ImportQuestionGroupingsDto } from './dto/import-question-groupings.dto';
import { AdminQuestionGroupingsService } from './admin-question-groupings.service';
import { AdminHistoryService } from './admin-history.service';

@ApiTags('Admin - Question Groupings')
@Controller('admin/question-groupings')
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminQuestionGroupingsController {
  constructor(
    private readonly service: AdminQuestionGroupingsService,
    private readonly historyService: AdminHistoryService,
  ) {}

  @Post('import')
  @ApiOperation({ summary: 'Import question groupings for a bank' })
  async importGroupings(@Request() req: any, @Body() dto: ImportQuestionGroupingsDto) {
    const result = await this.service.importGroupings(dto);

    // Only record real writes (not dry-runs)
    if (!dto.dryRun) {
      const adminEmail = req?.user?.email || req?.user?.id?.toString() || 'admin';
      const targetId = String((result as any)?.questionBankId || dto.questionBankId || dto.questionBankCode || 'unknown');
      await this.historyService.record(
        adminEmail,
        'IMPORT_QUESTION_GROUPINGS',
        'QuestionBank',
        targetId,
        {
          questionBankCode: (result as any)?.questionBankCode || dto.questionBankCode,
          questionBankId: (result as any)?.questionBankId || dto.questionBankId,
          replaceExisting: dto.replaceExisting !== false,
          groupsReceived: (result as any)?.groupsReceived,
          groupsImported: (result as any)?.groupsImported,
          externalIdsReceived: (result as any)?.externalIdsReceived,
          externalIdsMissing: (result as any)?.externalIdsMissing,
          upsertedRows: (result as any)?.upsertedRows,
          deletedRows: (result as any)?.deletedRows,
          updatedParentSetIds: (result as any)?.updatedParentSetIds,
          clearedParentSetIds: (result as any)?.clearedParentSetIds,
        },
        'Question Groupings',
      );
    }

    return result;
  }
}
