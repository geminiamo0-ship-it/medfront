import { Repository } from 'typeorm';
import { Question } from '../../entities/question.entity';
import { QuestionGrouping } from '../../entities/question-grouping.entity';

export async function normalizeBlockQuestionIds(params: {
  questionRepository: Repository<Question>;
  questionGroupingRepository: Repository<QuestionGrouping>;
  questionBankId: number;
  orderedQuestionIds: number[];
  targetCount: number;
  blockSize: number;
}): Promise<number[]> {
  const {
    questionRepository,
    questionGroupingRepository,
    questionBankId,
    orderedQuestionIds,
    targetCount,
    blockSize,
  } = params;

  const existingOrdered = orderedQuestionIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  if (existingOrdered.length === 0) {
    return [];
  }

  const qRows: Array<{ id: number; externalId: string | null }> = await questionRepository
    .createQueryBuilder('q')
    .select(['q.id AS "id"', 'q.externalId AS "externalId"'])
    .where('q.id IN (:...ids)', { ids: existingOrdered })
    .getRawMany();

  const externalIds = qRows
    .map((row) => (row.externalId ? String(row.externalId).trim() : ''))
    .filter(Boolean);
  if (externalIds.length === 0) {
    return existingOrdered;
  }

  const touchedGroupRows: Array<{ groupKey: string }> = await questionGroupingRepository
    .createQueryBuilder('g')
    .select(['g.groupKey AS "groupKey"'])
    .where('g.questionBankId = :bankId', { bankId: questionBankId })
    .andWhere('g.externalId IN (:...externalIds)', { externalIds })
    .groupBy('g.groupKey')
    .getRawMany();

  const touchedKeys = touchedGroupRows.map((row) => String(row.groupKey).trim()).filter(Boolean);
  if (touchedKeys.length === 0) {
    return existingOrdered;
  }

  const groupMemberRows: Array<{ groupKey: string; questionId: number }> =
    await questionGroupingRepository.manager.query(
      `
        select g."groupKey" as "groupKey", q.id as "questionId"
        from question_groupings g
        join questions q
          on q."questionBankId" = g."questionBankId"
         and q."externalId" = g."externalId"
         and q."isActive" = true
        where g."questionBankId" = $1
          and g."groupKey" = any($2)
        order by g."groupKey" asc, g.position asc
      `,
      [questionBankId, touchedKeys],
    );

  const groupMembersByKey = new Map<string, number[]>();
  const questionIdToGroupKey = new Map<number, string>();
  for (const row of groupMemberRows) {
    const groupKey = String(row.groupKey).trim();
    const questionId = Number(row.questionId);
    if (!groupKey || !Number.isFinite(questionId)) continue;
    const existing = groupMembersByKey.get(groupKey) || [];
    existing.push(questionId);
    groupMembersByKey.set(groupKey, existing);
    questionIdToGroupKey.set(questionId, groupKey);
  }

  if (groupMembersByKey.size === 0) {
    return existingOrdered;
  }

  const nextOrdered: number[] = [];
  const expandedGroups = new Set<string>();
  const seen = new Set<number>();

  for (const questionId of existingOrdered) {
    if (seen.has(questionId)) continue;
    const groupKey = questionIdToGroupKey.get(questionId);
    if (!groupKey) {
      nextOrdered.push(questionId);
      seen.add(questionId);
      continue;
    }

    if (expandedGroups.has(groupKey)) {
      continue;
    }

    const members = groupMembersByKey.get(groupKey) || [questionId];
    for (const memberId of members) {
      if (seen.has(memberId)) continue;
      nextOrdered.push(memberId);
      seen.add(memberId);
    }
    expandedGroups.add(groupKey);
  }

  const normalizedTarget = Math.max(1, Math.min(blockSize, Number(targetCount || blockSize)));
  if (nextOrdered.length > normalizedTarget) {
    const protectedIds = new Set<number>();
    for (const members of groupMembersByKey.values()) {
      for (const memberId of members) {
        protectedIds.add(memberId);
      }
    }

    for (let index = nextOrdered.length - 1; index >= 0 && nextOrdered.length > normalizedTarget; index -= 1) {
      const questionId = nextOrdered[index];
      if (protectedIds.has(questionId)) continue;
      nextOrdered.splice(index, 1);
    }
  }

  if (nextOrdered.length > normalizedTarget) {
    throw new Error(
      `Unable to normalize block question groups for bank ${questionBankId} without exceeding target ${normalizedTarget}.`,
    );
  }

  return nextOrdered;
}

export async function hasPartialBlockGroups(params: {
  questionRepository: Repository<Question>;
  questionGroupingRepository: Repository<QuestionGrouping>;
  questionBankId: number;
  orderedQuestionIds: number[];
}): Promise<boolean> {
  const { questionRepository, questionGroupingRepository, questionBankId, orderedQuestionIds } = params;

  const selectedIds = orderedQuestionIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  if (selectedIds.length === 0) {
    return false;
  }

  const selectedRows: Array<{ externalId: string | null }> = await questionRepository
    .createQueryBuilder('q')
    .select(['q.externalId AS "externalId"'])
    .where('q.id IN (:...ids)', { ids: selectedIds })
    .getRawMany();

  const externalIds = selectedRows
    .map((row) => (row.externalId ? String(row.externalId).trim() : ''))
    .filter(Boolean);
  if (externalIds.length === 0) {
    return false;
  }

  const touchedGroupRows: Array<{ groupKey: string }> = await questionGroupingRepository
    .createQueryBuilder('g')
    .select(['g.groupKey AS "groupKey"'])
    .where('g.questionBankId = :bankId', { bankId: questionBankId })
    .andWhere('g.externalId IN (:...externalIds)', { externalIds })
    .groupBy('g.groupKey')
    .getRawMany();

  const touchedKeys = touchedGroupRows.map((row) => String(row.groupKey).trim()).filter(Boolean);
  if (touchedKeys.length === 0) {
    return false;
  }

  const rows: Array<{ groupKey: string; externalId: string; position: number }> =
    await questionGroupingRepository.manager.query(
      `
        select "groupKey" as "groupKey", "externalId" as "externalId", position
        from question_groupings
        where "questionBankId" = $1
          and "groupKey" = any($2)
        order by "groupKey" asc, position asc
      `,
      [questionBankId, touchedKeys],
    );

  const selectedSet = new Set(externalIds);
  const counts = new Map<string, { total: number; present: number }>();
  for (const row of rows) {
    const groupKey = String(row.groupKey).trim();
    const externalId = String(row.externalId).trim();
    const entry = counts.get(groupKey) || { total: 0, present: 0 };
    entry.total += 1;
    if (selectedSet.has(externalId)) {
      entry.present += 1;
    }
    counts.set(groupKey, entry);
  }

  for (const entry of counts.values()) {
    if (entry.present > 0 && entry.present !== entry.total) {
      return true;
    }
  }

  return false;
}
