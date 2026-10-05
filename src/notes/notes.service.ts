import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { QuestionNote } from "../entities/question-note.entity";
import { Question } from "../entities/question.entity";
import { CreateNoteDto, UpdateNoteDto } from "./dto/notes.dto";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { Inject } from "@nestjs/common";

@Injectable()
export class NotesService {
  private static readonly NOTE_CACHE_TTL_MS = 300000; // 5 minutes

  constructor(
    @InjectRepository(QuestionNote)
    private notesRepository: Repository<QuestionNote>,
    @InjectRepository(Question)
    private questionsRepository: Repository<Question>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async findAll(userId: number, search?: string) {
    const cacheKey = `user_notes:all:${userId}${search ? `:q:${search}` : ''}`;
    
    if (!search) {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) return cached;
    }

    const query = this.notesRepository
      .createQueryBuilder("note")
      .leftJoinAndSelect("note.question", "question")
      .leftJoinAndSelect("question.subject", "subject")
      .leftJoinAndSelect("question.system", "system")
      .leftJoinAndSelect("question.topic", "topic")
      .leftJoinAndSelect("question.questionBank", "questionBank")
      .where("note.userId = :userId", { userId });

    if (search) {
      query.andWhere(
        "(note.content ILIKE :search OR CAST(note.question_id AS TEXT) ILIKE :search OR question.externalId ILIKE :search OR subject.name ILIKE :search OR system.name ILIKE :search OR topic.name ILIKE :search)",
        { search: `%${search}%` },
      );
    }

    const notes = await query.orderBy("note.updatedAt", "DESC").getMany();

    if (!search) {
      await this.cacheManager.set(cacheKey, notes, 300000); // 5 mins
    }

    return notes;
  }

  async findByQuestionId(userId: number, questionId: number) {
    const cacheKey = `user_notes:q:${userId}:${questionId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached !== undefined) return cached as QuestionNote | null;

    const note = await this.notesRepository.findOne({
      where: { userId, questionId },
    });

    await this.cacheManager.set(
      cacheKey,
      note ?? null,
      NotesService.NOTE_CACHE_TTL_MS,
    );

    return note;
  }

  /**
   * Read-only preview of the question a note was taken on (stem, options with
   * the correct answer, and explanation) — the same shape the flashcard
   * question-preview returns, so the frontend can reuse one modal.
   *
   * Authorization mirrors the flashcard preview (which gates on card
   * ownership): we only expose the question if the requesting user actually
   * owns a note for it. This prevents enumerating questions/answers by ID.
   */
  async getQuestionPreview(userId: number, questionId: number) {
    const note = await this.notesRepository.findOne({
      where: { userId, questionId },
    });
    if (!note) {
      throw new NotFoundException("Note not found");
    }

    const question = await this.questionsRepository.findOne({
      where: { id: questionId },
      relations: ["options", "subject", "system", "topic", "questionBank"],
    });
    if (!question) {
      throw new NotFoundException("Question not found");
    }

    const sortedOptions = [...(question.options || [])].sort((a: any, b: any) =>
      String(a.displayOrder || "").localeCompare(String(b.displayOrder || "")),
    );

    return {
      id: question.id,
      textHtml: question.textHtml,
      explanationHtml: question.explanationHtml,
      difficulty: question.difficulty,
      updatedAt: question.updatedAt,
      subject: question.subject
        ? { id: question.subject.id, name: question.subject.name }
        : null,
      system: question.system
        ? { id: question.system.id, name: question.system.name }
        : null,
      topic: question.topic
        ? { id: question.topic.id, name: question.topic.name }
        : null,
      questionBank: question.questionBank
        ? { id: question.questionBank.id, name: question.questionBank.name }
        : null,
      options: sortedOptions.map((option: any) => ({
        id: option.id,
        displayOrder: option.displayOrder,
        textHtml: option.textHtml,
        isCorrect: !!option.isCorrect,
        explanationHtml: option.explanationHtml,
      })),
    };
  }

  async create(userId: number, createDto: CreateNoteDto) {
    // We use a custom query for upsert to ensure it's atomic and handles race conditions
    // This is especially important for CockroachDB/Postgres unique constraints
    // Atomic upsert logic to prevent duplicate key race conditions
    await this.notesRepository
      .createQueryBuilder()
      .insert()
      .into(QuestionNote)
      .values({
        userId,
        questionId: createDto.questionId,
        content: createDto.content,
      })
      .onConflict(
        '("user_id", "question_id") DO UPDATE SET "content" = EXCLUDED.content, "updatedAt" = now()',
      )
      .execute();

    // 🚀 CACHE INVALIDATION
    await this.cacheManager.del(`user_notes:all:${userId}`);
    await this.cacheManager.del(
      `user_notes:q:${userId}:${createDto.questionId}`,
    );

    return this.findByQuestionId(userId, createDto.questionId);
  }

  async update(userId: number, id: string, updateDto: UpdateNoteDto) {
    const note = await this.notesRepository.findOne({ where: { id, userId } });
    if (!note) throw new NotFoundException("Note not found");

    note.content = updateDto.content;
    const updated = await this.notesRepository.save(note);
    
    // 🚀 CACHE INVALIDATION
    await this.cacheManager.del(`user_notes:all:${userId}`);
    await this.cacheManager.del(
      `user_notes:q:${userId}:${note.questionId}`,
    );
    
    return updated;
  }

  async remove(userId: number, id: string) {
    const note = await this.notesRepository.findOne({ where: { id, userId } });
    if (!note) throw new NotFoundException("Note not found");

    await this.notesRepository.remove(note);
    
    // 🚀 CACHE INVALIDATION
    await this.cacheManager.del(`user_notes:all:${userId}`);
    await this.cacheManager.del(
      `user_notes:q:${userId}:${note.questionId}`,
    );
    
    return { success: true };
  }
}
