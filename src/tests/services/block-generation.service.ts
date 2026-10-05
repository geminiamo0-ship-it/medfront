import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  QuestionBank,
  resolveViewerThemeProfileSnapshot,
} from '../../entities/question-bank.entity';
import { Question } from '../../entities/question.entity';
import { QuestionGrouping } from '../../entities/question-grouping.entity';
import { Test, TestMode, TestStatus, TestType } from '../../entities/test.entity';
import { TestQuestion } from '../../entities/test-question.entity';
import {
  hasPartialBlockGroups,
  normalizeBlockQuestionIds,
} from '../utils/block-group-integrity.util';

@Injectable()
export class BlockGenerationService {
  private readonly defaultBlockSize = 20;
  private readonly secondsPerQuestion = 90;

  constructor(
    @InjectRepository(QuestionBank)
    private questionBankRepository: Repository<QuestionBank>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(QuestionGrouping)
    private questionGroupingRepository: Repository<QuestionGrouping>,
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
    @InjectRepository(TestQuestion)
    private testQuestionRepository: Repository<TestQuestion>,
  ) {}

  async generateBlockTestsForUser(userId: number): Promise<void> {
    const banks = await this.questionBankRepository.find({
      where: { isActive: true, isBlockBank: true },
    });

    for (const bank of banks) {
      await this.generateForBank(userId, bank);
    }
  }

  private async generateForBank(userId: number, bank: QuestionBank): Promise<void> {
    const existingTests = await this.testRepository.find({
      where: { userId, isBlock: true, blockBankId: bank.id },
      select: ['id', 'blockNumber'],
    });

    const existingBlockNumbers = new Set(
      existingTests.map((test) => test.blockNumber).filter((value) => Number.isFinite(value)),
    );

    const existingTestIds = existingTests.map((test) => test.id);
    const usedQuestionIds = new Set<number>();

    if (existingTestIds.length > 0) {
      const usedMappings = await this.testQuestionRepository.find({
        where: { testId: In(existingTestIds) },
        select: ['questionId'],
      });
      usedMappings.forEach((mapping) => usedQuestionIds.add(Number(mapping.questionId)));
    }

    const questionRows = await this.questionRepository
      .createQueryBuilder('question')
      .select(['question.id AS "id"', 'question.externalId AS "externalId"'])
      .where('question.questionBankId = :bankId', { bankId: bank.id })
      .andWhere('question.isActive = :isActive', { isActive: true })
      .andWhere('question.step = :step', { step: bank.step })
      .getRawMany<{ id: number; externalId: string | null }>();

    const allQuestions = questionRows
      .map((row) => ({
        id: Number(row.id),
        externalId: row.externalId ? String(row.externalId).trim() : null,
      }))
      .filter((row) => Number.isFinite(row.id));
    const allQuestionIds = allQuestions.map((row) => row.id);

    if (allQuestionIds.length === 0) {
      return;
    }

    const effectiveBlockSize = bank.blockSize || this.defaultBlockSize;
    const totalBlocks = Math.ceil(allQuestionIds.length / effectiveBlockSize);

    for (let blockNumber = 1; blockNumber <= totalBlocks; blockNumber += 1) {
      if (existingBlockNumbers.has(blockNumber)) {
        continue;
      }

      const expectedCount =
        blockNumber === totalBlocks
          ? Math.max(1, allQuestionIds.length - (totalBlocks - 1) * effectiveBlockSize)
          : effectiveBlockSize;
      const remainingQuestions = allQuestions.filter((row) => !usedQuestionIds.has(row.id));
      const candidateSlice = await this.selectBlockQuestionIdsGrouped({
        questionBankId: bank.id,
        remainingQuestions,
        usedQuestionIds,
        targetCount: Math.min(expectedCount, remainingQuestions.length),
      });

      const slice = await normalizeBlockQuestionIds({
        questionRepository: this.questionRepository,
        questionGroupingRepository: this.questionGroupingRepository,
        questionBankId: bank.id,
        orderedQuestionIds: candidateSlice,
        targetCount: Math.min(expectedCount, remainingQuestions.length),
        blockSize: effectiveBlockSize,
      });

      if (slice.length === 0) {
        break;
      }

      const hasPartialGroups = await hasPartialBlockGroups({
        questionRepository: this.questionRepository,
        questionGroupingRepository: this.questionGroupingRepository,
        questionBankId: bank.id,
        orderedQuestionIds: slice,
      });
      if (hasPartialGroups) {
        throw new Error(`Failed to pre-generate block ${blockNumber} for bank ${bank.id} with complete grouped questions.`);
      }

      slice.forEach((questionId) => usedQuestionIds.add(questionId));

      const timeLimitSeconds = slice.length * this.secondsPerQuestion;
      const test = this.testRepository.create({
        userId,
        title: `${bank.name} Block #${blockNumber}`,
        type: TestType.TIMED,
        mode: TestMode.ALL,
        step: bank.step,
        status: TestStatus.NOT_STARTED,
        totalQuestions: slice.length,
        timeLimitSeconds,
        filters: { questionBankIds: [bank.id] },
        isBlock: true,
        blockNumber,
        blockBankId: bank.id,
        startedAt: null,
        viewerThemeProfileSnapshot: resolveViewerThemeProfileSnapshot([
          bank.viewerThemeProfile,
        ]),
      });

      const savedTest = await this.testRepository.save(test);

      const testQuestions = slice.map((questionId, index) =>
        this.testQuestionRepository.create({
          testId: savedTest.id,
          questionId,
          displayOrder: index + 1,
        }),
      );

      await this.testQuestionRepository.save(testQuestions);
    }
  }

  private shuffleArray<T>(values: T[]) {
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
  }

  private async selectBlockQuestionIdsGrouped(input: {
    questionBankId: number;
    remainingQuestions: Array<{ id: number; externalId: string | null }>;
    usedQuestionIds: Set<number>;
    targetCount: number;
  }): Promise<number[]> {
    const target = Math.max(1, Number(input.targetCount || 0));
    const remainingById = new Set(input.remainingQuestions.map((q) => q.id));

    const allQuestionRows = await this.questionRepository
      .createQueryBuilder('question')
      .select(['question.id AS "id"', 'question.externalId AS "externalId"'])
      .where('question.questionBankId = :bankId', { bankId: input.questionBankId })
      .andWhere('question.isActive = :isActive', { isActive: true })
      .getRawMany<{ id: number; externalId: string | null }>();

    const questionIdByExternalId = new Map<string, number>();
    for (const row of allQuestionRows) {
      const id = Number(row.id);
      if (!Number.isFinite(id)) continue;
      const ext = row.externalId ? String(row.externalId).trim() : '';
      if (!ext) continue;
      if (!questionIdByExternalId.has(ext)) {
        questionIdByExternalId.set(ext, id);
      }
    }

    const groupingRows = await this.questionGroupingRepository
      .createQueryBuilder('g')
      .where('g.questionBankId = :bankId', { bankId: input.questionBankId })
      .orderBy('g.groupKey', 'ASC')
      .addOrderBy('g.position', 'ASC')
      .getMany();

    const groupMembersByKey = new Map<string, number[]>();
    const groupExternalIdsByKey = new Map<string, string[]>();
    for (const g of groupingRows) {
      const groupKey = String(g.groupKey).trim();
      const extId = String(g.externalId).trim();
      if (!groupKey || !extId) continue;
      const existingExt = groupExternalIdsByKey.get(groupKey) || [];
      existingExt.push(extId);
      groupExternalIdsByKey.set(groupKey, existingExt);
    }

    for (const [groupKey, externalIds] of groupExternalIdsByKey.entries()) {
      const members: number[] = [];
      const seen = new Set<number>();
      for (const extId of externalIds) {
        const qid = questionIdByExternalId.get(extId);
        if (!qid) {
          members.length = 0;
          break;
        }
        if (seen.has(qid)) continue;
        seen.add(qid);
        members.push(qid);
      }
      if (members.length >= 2) {
        groupMembersByKey.set(groupKey, members);
      }
    }

    const units: Array<{ key: string; questionIds: number[] }> = [];
    const groupedQuestionIds = new Set<number>();
    const blockedGroupedIds = new Set<number>();

    for (const [groupKey, ids] of groupMembersByKey.entries()) {
      for (const id of ids) groupedQuestionIds.add(id);

      const anyUsed = ids.some((id) => input.usedQuestionIds.has(id));
      const allRemaining = ids.every((id) => remainingById.has(id));

      if (!anyUsed && allRemaining) {
        units.push({ key: `g:${groupKey}`, questionIds: ids });
      } else {
        for (const id of ids) blockedGroupedIds.add(id);
      }
    }

    for (const q of input.remainingQuestions) {
      if (groupedQuestionIds.has(q.id)) continue;
      if (blockedGroupedIds.has(q.id)) continue;
      units.push({ key: `q:${q.id}`, questionIds: [q.id] });
    }

    this.shuffleArray(units);

    const selected: number[] = [];
    const selectedSingles: number[] = [];
    for (const unit of units) {
      if (selected.length >= target) break;
      const remainingSlots = target - selected.length;
      const size = unit.questionIds.length;

      if (size <= remainingSlots) {
        selected.push(...unit.questionIds);
        if (size === 1) selectedSingles.push(unit.questionIds[0]);
        continue;
      }

      if (size > 1) {
        const overflow = size - remainingSlots;
        if (selectedSingles.length < overflow) continue;

        selected.push(...unit.questionIds);

        for (let i = 0; i < overflow; i++) {
          const removeId = selectedSingles.pop();
          if (!removeId) break;
          const idx = selected.indexOf(removeId);
          if (idx >= 0) selected.splice(idx, 1);
        }
      }
    }

    return selected;
  }
}
