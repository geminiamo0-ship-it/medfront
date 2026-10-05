import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { RevisionSession } from '../entities/revision-session.entity';
import { UserQuestionMark } from '../entities/user-question-mark.entity';
import { Question } from '../entities/question.entity';
import { Subject } from '../entities/subject.entity';
import { System } from '../entities/system.entity';
import { QuestionBank } from '../entities/question-bank.entity';
import { resolveDifficultyFromCorrectOptionRate } from '../utils/question-difficulty.util';
import { CreateRevisionSessionDto } from './dto/revision.dto';

export interface SliceCounts {
  marked: number;
  remaining: number;
}

export interface SubjectOverviewRow extends SliceCounts {
  subjectId: number;
  subjectName: string;
  systems: Array<SliceCounts & { systemId: number; systemName: string }>;
}

@Injectable()
export class RevisionService {
  private static readonly MAX_CHUNK_SIZE = 40;

  constructor(
    @InjectRepository(RevisionSession)
    private revisionRepo: Repository<RevisionSession>,
    @InjectRepository(UserQuestionMark)
    private markRepo: Repository<UserQuestionMark>,
    @InjectRepository(Question)
    private questionRepo: Repository<Question>,
    @InjectRepository(Subject)
    private subjectRepo: Repository<Subject>,
    @InjectRepository(System)
    private systemRepo: Repository<System>,
    @InjectRepository(QuestionBank)
    private questionBankRepo: Repository<QuestionBank>,
  ) {}

  // ── Overview ────────────────────────────────────────────────────────────
  //
  // Returns per-subject counts plus per-system breakdown inside each subject.
  // "marked" = total marked questions in the slice for this user/qBank.
  // "remaining" = marked questions whose ID is NOT already in any completed
  //               revision session under the same subject (any slice). This
  //               ensures a question seen in a subject-level session is also
  //               excluded from system-level remaining counts and vice versa.
  async getOverview(userId: number, qBankId: number): Promise<SubjectOverviewRow[]> {
    // 1. All marked question IDs in this qBank with their subject/system.
    const markedRows: Array<{
      questionId: number;
      subjectId: number;
      systemId: number | null;
      subjectName: string;
      systemName: string | null;
    }> = await this.markRepo
      .createQueryBuilder('m')
      .innerJoin(Question, 'q', 'q.id = m.questionId')
      .innerJoin(Subject, 's', 's.id = q.subjectId')
      .leftJoin(System, 'sy', 'sy.id = q.systemId')
      .select('m.questionId', 'questionId')
      .addSelect('q.subjectId', 'subjectId')
      .addSelect('q.systemId', 'systemId')
      .addSelect('s.name', 'subjectName')
      .addSelect('sy.name', 'systemName')
      .where('m.userId = :userId', { userId })
      .andWhere('q.questionBankId = :qBankId', { qBankId })
      .getRawMany();

    if (markedRows.length === 0) return [];

    // 2. Pull every completed session for this user/qBank in one query so we
    //    can build per-slice "already snapshotted" sets in memory.
    const completedSessions = await this.revisionRepo.find({
      where: {
        userId,
        qBankId,
        completedAt: Not(IsNull()),
      },
      select: ['subjectId', 'systemId', 'questionIds'],
    });

    // Exclusion semantics: the question IDs to subtract for ANY slice under
    // subject X are the union of question IDs from every completed session
    // under subject X — regardless of whether that past session was
    // subject-level or system-level. A question already shown in a
    // subject-level session must not reappear in a system-level session under
    // the same subject (and vice versa).
    const subjectCompletedIds = new Map<number, Set<number>>();
    for (const s of completedSessions) {
      if (!subjectCompletedIds.has(s.subjectId)) {
        subjectCompletedIds.set(s.subjectId, new Set());
      }
      const subSet = subjectCompletedIds.get(s.subjectId)!;
      for (const id of s.questionIds) subSet.add(id);
    }

    // 3. Group marked rows by subject → system.
    const bySubject = new Map<
      number,
      {
        subjectId: number;
        subjectName: string;
        markedIds: Set<number>;
        bySystem: Map<
          string,
          {
            systemId: number | null;
            systemName: string | null;
            markedIds: Set<number>;
          }
        >;
      }
    >();

    for (const row of markedRows) {
      if (!bySubject.has(row.subjectId)) {
        bySubject.set(row.subjectId, {
          subjectId: row.subjectId,
          subjectName: row.subjectName,
          markedIds: new Set(),
          bySystem: new Map(),
        });
      }
      const subj = bySubject.get(row.subjectId)!;
      subj.markedIds.add(row.questionId);

      const sysKey = row.systemId === null ? 'null' : String(row.systemId);
      if (!subj.bySystem.has(sysKey)) {
        subj.bySystem.set(sysKey, {
          systemId: row.systemId,
          systemName: row.systemName,
          markedIds: new Set(),
        });
      }
      subj.bySystem.get(sysKey)!.markedIds.add(row.questionId);
    }

    // 4. Build the final response with marked + remaining counts.
    const result: SubjectOverviewRow[] = [];
    for (const subj of bySubject.values()) {
      const subjectCompleted = subjectCompletedIds.get(subj.subjectId) ?? new Set<number>();
      const subjectRemaining = [...subj.markedIds].filter((id) => !subjectCompleted.has(id)).length;

      const systems: SubjectOverviewRow['systems'] = [];
      for (const sys of subj.bySystem.values()) {
        if (sys.systemId === null) continue; // skip questions with no system at the system level
        // Exclude any question already shown in ANY completed session under
        // this subject (subject-level or any system-level), not just exact-slice.
        const remaining = [...sys.markedIds].filter((id) => !subjectCompleted.has(id)).length;
        systems.push({
          systemId: sys.systemId,
          systemName: sys.systemName ?? 'Unknown',
          marked: sys.markedIds.size,
          remaining,
        });
      }
      systems.sort((a, b) => a.systemName.localeCompare(b.systemName));

      result.push({
        subjectId: subj.subjectId,
        subjectName: subj.subjectName,
        marked: subj.markedIds.size,
        remaining: subjectRemaining,
        systems,
      });
    }

    result.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
    return result;
  }

  // ── Active session lookup (for resume) ──────────────────────────────────
  async getActiveSession(
    userId: number,
    qBankId: number,
    subjectId: number,
    systemId: number | null,
  ) {
    const session = await this.revisionRepo.findOne({
      where: {
        userId,
        qBankId,
        subjectId,
        systemId: systemId === null ? IsNull() : systemId,
        completedAt: IsNull(),
      },
      order: { startedAt: 'DESC' },
    });
    if (!session) return null;
    return {
      sessionId: session.id,
      total: session.questionIds.length,
      lastViewedIndex: session.lastViewedIndex,
      startedAt: session.startedAt,
    };
  }

  // ── Create session ──────────────────────────────────────────────────────
  async createSession(userId: number, dto: CreateRevisionSessionDto) {
    const chunkSize = Math.min(
      RevisionService.MAX_CHUNK_SIZE,
      Math.max(1, Math.floor(dto.chunkSize)),
    );

    // Wrap snapshot read + insert in a transaction and serialize concurrent
    // creates against the same slice using a Postgres advisory lock. Without
    // this, two simultaneous createSession calls could read the same "seen"
    // set and snapshot overlapping question IDs (violating the no-repeat
    // invariant). The advisory lock is released automatically when the
    // transaction ends.
    return this.revisionRepo.manager.transaction(async (manager) => {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`${userId}:${dto.qBankId}:${dto.subjectId}:${dto.systemId ?? 'all'}`],
      );

      const sessionRepo = manager.getRepository(RevisionSession);

      // Marked question IDs in this slice, sorted ASC for stable snapshots.
      const markedRowsQb = manager
        .createQueryBuilder(UserQuestionMark, 'm')
        .innerJoin(Question, 'q', 'q.id = m.questionId')
        .select('m.questionId', 'questionId')
        .where('m.userId = :userId', { userId })
        .andWhere('q.questionBankId = :qBankId', { qBankId: dto.qBankId })
        .andWhere('q.subjectId = :subjectId', { subjectId: dto.subjectId });
      if (dto.systemId !== undefined && dto.systemId !== null) {
        markedRowsQb.andWhere('q.systemId = :systemId', { systemId: dto.systemId });
      }
      const markedRows = await markedRowsQb
        .orderBy('m.questionId', 'ASC')
        .getRawMany();
      const markedIds: number[] = markedRows.map((r) => Number(r.questionId));

      if (markedIds.length === 0) {
        throw new BadRequestException('No marked questions in this selection');
      }

      // IDs already snapshotted in ANY completed session under this subject —
      // not just the exact slice. A question seen in a subject-level session
      // must not reappear in a later system-level session under the same
      // subject (or vice versa).
      const completedSessions = await sessionRepo.find({
        where: {
          userId,
          qBankId: dto.qBankId,
          subjectId: dto.subjectId,
          completedAt: Not(IsNull()),
        },
        select: ['questionIds'],
      });
      const seen = new Set<number>();
      for (const s of completedSessions) {
        for (const id of s.questionIds) seen.add(id);
      }

      const remaining = markedIds.filter((id) => !seen.has(id));
      if (remaining.length === 0) {
        return { sessionId: null, questionIds: [], allRevised: true };
      }

      const snapshot = remaining.slice(0, chunkSize);

      const session = sessionRepo.create({
        userId,
        qBankId: dto.qBankId,
        subjectId: dto.subjectId,
        systemId: dto.systemId ?? null,
        questionIds: snapshot,
        lastViewedIndex: 0,
      });
      const saved = await sessionRepo.save(session);

      return {
        sessionId: saved.id,
        questionIds: snapshot,
        allRevised: false,
      };
    });
  }

  // ── Fetch session payload shaped for the test-runner display ────────────
  async getSession(userId: number, sessionId: number) {
    const session = await this.revisionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Revision session not found');
    if (session.userId !== userId) {
      throw new ForbiddenException('You do not have access to this revision session');
    }

    const [qBank, subject, system, questions] = await Promise.all([
      this.questionBankRepo.findOne({ where: { id: session.qBankId } }),
      this.subjectRepo.findOne({ where: { id: session.subjectId } }),
      session.systemId !== null
        ? this.systemRepo.findOne({ where: { id: session.systemId } })
        : Promise.resolve(null),
      this.loadQuestionsWithRelations(session.questionIds),
    ]);

    // Preserve snapshot order.
    const questionsById = new Map(questions.map((q) => [q.id, q]));
    const orderedQuestions = session.questionIds
      .map((id, idx) => {
        const q = questionsById.get(id);
        if (!q) return null;
        return this.shapeQuestionForRevision(q, idx);
      })
      .filter((q) => q !== null);

    return {
      sessionId: session.id,
      qBankId: session.qBankId,
      qBankName: qBank?.name ?? null,
      subjectId: session.subjectId,
      subjectName: subject?.name ?? null,
      systemId: session.systemId,
      systemName: system?.name ?? null,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      lastViewedIndex: session.lastViewedIndex,
      total: orderedQuestions.length,
      questions: orderedQuestions,
    };
  }

  async updateProgress(userId: number, sessionId: number, lastViewedIndex: number) {
    const session = await this.revisionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Revision session not found');
    if (session.userId !== userId) {
      throw new ForbiddenException('You do not have access to this revision session');
    }
    const max = Math.max(0, session.questionIds.length - 1);
    session.lastViewedIndex = Math.max(0, Math.min(lastViewedIndex, max));
    await this.revisionRepo.save(session);
    return { ok: true, lastViewedIndex: session.lastViewedIndex };
  }

  async completeSession(userId: number, sessionId: number) {
    const session = await this.revisionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Revision session not found');
    if (session.userId !== userId) {
      throw new ForbiddenException('You do not have access to this revision session');
    }
    if (session.completedAt === null) {
      session.completedAt = new Date();
      await this.revisionRepo.save(session);
    }
    return { ok: true, completedAt: session.completedAt };
  }

  async resetHistory(
    userId: number,
    qBankId: number,
    subjectId: number,
    systemId: number | null,
  ) {
    // Wipe the slate fully for this slice: deletes every revision session
    // (completed AND in-progress) so all marked questions become available
    // again. When systemId is null we treat that as a subject-level reset
    // and remove ALL sessions under the subject (any stored systemId) so
    // the unified-exclusion semantics in createSession/getOverview have
    // nothing left to subtract. When systemId is given we only touch
    // sessions whose stored systemId matches exactly.
    const where: {
      userId: number;
      qBankId: number;
      subjectId: number;
      systemId?: number;
    } = { userId, qBankId, subjectId };
    if (systemId !== null) {
      where.systemId = systemId;
    }
    const result = await this.revisionRepo.delete(where);
    return { ok: true, deleted: result.affected ?? 0 };
  }

  // ── Internals ───────────────────────────────────────────────────────────
  private async loadQuestionsWithRelations(questionIds: number[]) {
    if (questionIds.length === 0) return [];
    return this.questionRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.options', 'options')
      .leftJoinAndSelect('q.subject', 'subject')
      .leftJoinAndSelect('q.system', 'system')
      .leftJoinAndSelect('q.topic', 'topic')
      .leftJoinAndSelect('q.questionBank', 'questionBank')
      .where('q.id IN (:...ids)', { ids: questionIds })
      .getMany();
  }

  // Shapes a question for the revision viewer. All answers + explanations are
  // ALWAYS revealed (read-only review). No user submission data — revision is
  // a pure read of the question content, not a scored attempt.
  private shapeQuestionForRevision(question: any, index: number) {
    const correctOption = question?.options?.find((o: any) => o?.isCorrect);
    const difficulty = resolveDifficultyFromCorrectOptionRate(correctOption?.uworldChosenBy);
    const options = (question.options ?? [])
      .slice()
      .sort((a: any, b: any) => a.displayOrder - b.displayOrder)
      .map((opt: any) => ({
        id: Number(opt.id),
        textHtml: opt.textHtml,
        displayOrder: opt.displayOrder,
        isCorrect: opt.isCorrect,
        explanationHtml: opt.explanationHtml,
        uworldChosenBy: opt.uworldChosenBy,
      }));

    return {
      id: Number(question.id),
      externalId: question.externalId ? String(question.externalId) : null,
      displayOrder: index + 1,
      textHtml: question.textHtml,
      explanationHtml: question.explanationHtml,
      difficulty,
      estimatedTimeSeconds: Number(question.estimatedTimeSeconds ?? 0),
      subject: question.subject,
      system: question.system,
      topic: question.topic,
      questionBank: question.questionBank,
      articleId: question.articleId ? Number(question.articleId) : undefined,
      libraryName: question.libraryName ? String(question.libraryName) : undefined,
      options,
      isMarked: true,
      isAnswered: false,
      isOmitted: false,
      status: 'revision',
    };
  }
}
