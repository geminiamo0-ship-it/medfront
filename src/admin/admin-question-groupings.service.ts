import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { QuestionGrouping } from '../entities/question-grouping.entity';
import { QuestionBank } from '../entities/question-bank.entity';
import { Question } from '../entities/question.entity';
import { ImportQuestionGroupingsDto } from './dto/import-question-groupings.dto';

type ImportReport = {
  success: boolean;
  data: {
    questionBankId: number;
    questionBankCode: string;
    dryRun: boolean;
    replaceExisting: boolean;
    groupsReceived: number;
    groupsImported: number;
    externalIdsReceived: number;
    externalIdsMissing: string[];
    upsertedRows: number;
    deletedRows: number;
    updatedParentSetIds: number;
    clearedParentSetIds: number;
  };
};

function normalizeExternalId(value: string | number): string {
  const raw = typeof value === 'number' ? String(value) : String(value ?? '');
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new BadRequestException(`Invalid externalId: ${raw}`);
  }
  return trimmed;
}

function computeGroupKey(externalIds: string[]): string {
  let min = Number.POSITIVE_INFINITY;
  for (const id of externalIds) {
    const n = Number(id);
    if (!Number.isFinite(n)) continue;
    if (n < min) min = n;
  }
  if (!Number.isFinite(min)) {
    throw new BadRequestException('Failed to compute groupKey');
  }
  return String(min);
}

@Injectable()
export class AdminQuestionGroupingsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(QuestionGrouping)
    private readonly groupingRepo: Repository<QuestionGrouping>,
    @InjectRepository(QuestionBank)
    private readonly bankRepo: Repository<QuestionBank>,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
  ) {}

  async importGroupings(dto: ImportQuestionGroupingsDto): Promise<ImportReport> {
    const dryRun = Boolean(dto.dryRun);
    const replaceExisting = dto.replaceExisting !== false;

    const bank = await this.resolveBank(dto);
    const bankId = bank.id;

    const { groups, uniqueGroups, receivedExternalIds } = this.normalizeGroups(dto.groups);
    if (uniqueGroups.length === 0) {
      throw new BadRequestException('No valid groups to import');
    }

    const existingQuestions = await this.questionRepo.find({
      where: {
        questionBankId: bankId,
        externalId: In(receivedExternalIds),
        isActive: true,
      },
      select: ['id', 'externalId'],
    });
    const existingSet = new Set(existingQuestions.map((q) => String(q.externalId)));
    const missingExternalIds = receivedExternalIds.filter((id) => !existingSet.has(id));

    // Skip groups that are incomplete in DB to avoid broken sequences
    const importableGroups = uniqueGroups.filter((g) => g.every((id) => existingSet.has(id)));

    const incomingExternalIds = Array.from(
      new Set(importableGroups.flatMap((g) => g)),
    );

    // Build upsert payload
    const rows: Array<Partial<QuestionGrouping>> = [];
    const parentSetByExternalId = new Map<string, number>();

    for (const group of importableGroups) {
      const groupKey = computeGroupKey(group);
      const groupKeyNum = Number(groupKey);
      for (let i = 0; i < group.length; i++) {
        const externalId = group[i];
        rows.push({
          externalId,
          questionBankId: bankId,
          groupKey,
          position: i + 1,
        });
        parentSetByExternalId.set(externalId, groupKeyNum);
      }
    }

    if (dryRun) {
      return {
        success: true,
        data: {
          questionBankId: bankId,
          questionBankCode: bank.code,
          dryRun,
          replaceExisting,
          groupsReceived: groups.length,
          groupsImported: importableGroups.length,
          externalIdsReceived: receivedExternalIds.length,
          externalIdsMissing: missingExternalIds,
          upsertedRows: rows.length,
          deletedRows: 0,
          updatedParentSetIds: parentSetByExternalId.size,
          clearedParentSetIds: 0,
        },
      };
    }

    return this.dataSource.transaction(async (manager) => {
      const groupingRepo = manager.getRepository(QuestionGrouping);
      const questionRepo = manager.getRepository(Question);

      // Compute stale before we overwrite (for clearing cache)
      let staleExternalIds: string[] = [];
      if (replaceExisting) {
        const existing = await groupingRepo.find({
          where: { questionBankId: bankId },
          select: ['externalId'],
        });
        const existingIds = existing.map((g) => g.externalId);
        const incomingSet = new Set(incomingExternalIds);
        staleExternalIds = existingIds.filter((id) => !incomingSet.has(String(id)));
      }

      // Upsert groupings
      if (rows.length > 0) {
        await groupingRepo.upsert(rows as any, ['externalId', 'questionBankId']);
      }

      // Delete stale groupings if requested
      let deletedRows = 0;
      if (replaceExisting && staleExternalIds.length > 0) {
        const deleteRes = await groupingRepo.delete({
          questionBankId: bankId,
          externalId: In(staleExternalIds),
        });
        deletedRows = deleteRes.affected || 0;
      }

      // Sync parentSetId cache: update for incoming, clear for stale
      const updatedParentSetIds = await this.bulkUpdateParentSetIds(
        questionRepo,
        bankId,
        parentSetByExternalId,
      );

      let clearedParentSetIds = 0;
      if (staleExternalIds.length > 0) {
        const clearRes = await questionRepo
          .createQueryBuilder()
          .update(Question)
          .set({ parentSetId: null })
          .where('questionBankId = :bankId', { bankId })
          .andWhere('externalId IN (:...extIds)', { extIds: staleExternalIds })
          .execute();
        clearedParentSetIds = clearRes.affected || 0;
      }

      return {
        success: true,
        data: {
          questionBankId: bankId,
          questionBankCode: bank.code,
          dryRun,
          replaceExisting,
          groupsReceived: groups.length,
          groupsImported: importableGroups.length,
          externalIdsReceived: receivedExternalIds.length,
          externalIdsMissing: missingExternalIds,
          upsertedRows: rows.length,
          deletedRows,
          updatedParentSetIds,
          clearedParentSetIds,
        },
      };
    });
  }

  private async resolveBank(dto: ImportQuestionGroupingsDto): Promise<QuestionBank> {
    const bankId = dto.questionBankId != null ? Number(dto.questionBankId) : null;
    const bankCode = dto.questionBankCode ? String(dto.questionBankCode).trim() : null;
    if (!bankId && !bankCode) {
      throw new BadRequestException('questionBankId or questionBankCode is required');
    }
    const bank = await this.bankRepo.findOne({
      where: bankId ? { id: bankId } : { code: bankCode! },
      select: ['id', 'code', 'name'],
    });
    if (!bank) {
      throw new NotFoundException('Question bank not found');
    }
    return bank;
  }

  private normalizeGroups(groups: Array<Array<string | number>>) {
    const normalized: string[][] = [];
    const uniqueKeySet = new Set<string>();
    const receivedExternalIds: string[] = [];

    for (const rawGroup of groups || []) {
      if (!Array.isArray(rawGroup) || rawGroup.length < 2) continue;
      const seen = new Set<string>();
      const group: string[] = [];
      for (const rawId of rawGroup) {
        const id = normalizeExternalId(rawId);
        if (seen.has(id)) {
          throw new BadRequestException(`Duplicate externalId in group: ${id}`);
        }
        seen.add(id);
        group.push(id);
      }
      const key = group.join('|');
      if (uniqueKeySet.has(key)) continue;
      uniqueKeySet.add(key);
      normalized.push(group);
      receivedExternalIds.push(...group);
    }

    return {
      groups,
      uniqueGroups: normalized,
      receivedExternalIds: Array.from(new Set(receivedExternalIds)),
    };
  }

  private async bulkUpdateParentSetIds(
    questionRepo: Repository<Question>,
    bankId: number,
    parentSetByExternalId: Map<string, number>,
  ): Promise<number> {
    const entries = [...parentSetByExternalId.entries()];
    if (entries.length === 0) return 0;

    // Chunk to avoid huge SQL statements
    const chunkSize = 800;
    let affected = 0;

    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      const extIds = chunk.map(([extId]) => extId);
      const cases = chunk
        .map(([extId, setId]) => `WHEN '${extId.replace(/'/g, "''")}' THEN ${Number(setId)}`)
        .join(' ');

      const sql = `
        UPDATE "questions"
        SET "parentSetId" = CASE "externalId" ${cases} ELSE "parentSetId" END
        WHERE "questionBankId" = $1 AND "externalId" = ANY($2)
      `;
      const res = await questionRepo.query(sql, [bankId, extIds]);
      // In pg, query() doesn't expose affected reliably; count via select might be expensive.
      // We approximate with extIds length as the maximum possible.
      affected += extIds.length;
    }

    return affected;
  }
}

