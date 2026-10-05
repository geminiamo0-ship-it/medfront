import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Question } from '../entities/question.entity';
import { QuestionOption } from '../entities/question-option.entity';
import {
  questionAnswerCacheKey,
  staticQuestionContentCacheKey,
  questionExplanationCacheKey,
  bankTotalsCacheKey,
  difficultyCountsEpochCacheKey,
  DIFFICULTY_COUNTS_EPOCH_TTL_MS,
} from '../cache/cache-keys.util';
import { safeCacheDel, safeCacheSet } from '../cache/safe-cache.util';

@Injectable()
export class AdminQuestionsService {
  private readonly logger = new Logger(AdminQuestionsService.name);

  constructor(
    @InjectRepository(Question)
    private questionRepo: Repository<Question>,
    @InjectRepository(QuestionOption)
    private optionRepo: Repository<QuestionOption>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async findAll(
    limit: number = 100,
    offset: number = 0,
    search?: string,
    step?: number,
    searchType?: string,
  ) {
    const trimmedSearch = search?.trim();
    if (!trimmedSearch) {
      return {
        success: true,
        data: [],
        total: 0,
      };
    }

    const normalizedType = (searchType || 'text').toLowerCase();
    const queryBuilder = this.questionRepo.createQueryBuilder('q')
      .leftJoinAndSelect('q.options', 'options')
      .orderBy('q.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (trimmedSearch) {
      const searchLike = `%${trimmedSearch}%`;
      const searchAsNumber = parseInt(trimmedSearch);
      const isNumeric = !isNaN(searchAsNumber) && searchAsNumber.toString() === trimmedSearch;

      if (normalizedType === 'id' || normalizedType === 'questionid') {
        if (!isNumeric) {
          return { success: true, data: [], total: 0 };
        }
        queryBuilder.andWhere('q.id = :id', { id: searchAsNumber });
      } else if (normalizedType === 'external' || normalizedType === 'externalid') {
        queryBuilder.andWhere('q.externalId = :externalId', { externalId: trimmedSearch });
      } else {
        queryBuilder.andWhere('q.textHtml ILIKE :search', { search: searchLike });
      }
    }

    if (step) {
      queryBuilder.andWhere('q.step = :step', { step });
    }

    // Get total count separately for better performance
    const totalQuery = this.questionRepo.createQueryBuilder('q');
    
    if (trimmedSearch) {
      const searchLike = `%${trimmedSearch}%`;
      const searchAsNumber = parseInt(trimmedSearch);
      const isNumeric = !isNaN(searchAsNumber) && searchAsNumber.toString() === trimmedSearch;

      if (normalizedType === 'id' || normalizedType === 'questionid') {
        if (!isNumeric) {
          return { success: true, data: [], total: 0 };
        }
        totalQuery.andWhere('q.id = :id', { id: searchAsNumber });
      } else if (normalizedType === 'external' || normalizedType === 'externalid') {
        totalQuery.andWhere('q.externalId = :externalId', { externalId: trimmedSearch });
      } else {
        totalQuery.andWhere('q.textHtml ILIKE :search', { search: searchLike });
      }
    }
    
    if (step) {
      totalQuery.andWhere('q.step = :step', { step });
    }

    const [questions, total] = await Promise.all([
      queryBuilder.getMany(),
      totalQuery.getCount()
    ]);

    const questionsWithCount = questions.map((q) => ({
      ...q,
      difficulty: q.difficulty,
      options: Array(q.options?.length || 0).fill({ id: 1 })
    }));

    return {
      success: true,
      data: questionsWithCount,
      total,
    };
  }

  async findOne(id: number) {
    const question = await this.questionRepo.findOne({
      where: { id },
      relations: ['options']
    });
    return {
      success: true,
      data: question
    };
  }

  async create(data: any) {
    const { options, difficulty: _difficulty, ...questionData } = data;
    
    // Create question first
    const question = this.questionRepo.create(questionData as Partial<Question>);
    const savedQuestion = await this.questionRepo.save(question) as Question;

    // Handle options
    if (options && Array.isArray(options)) {
      const optionEntities: QuestionOption[] = options.map(opt => {
        const { id: _, ...optWithoutId } = opt;
        return this.optionRepo.create({
          ...optWithoutId,
          questionId: savedQuestion.id,
          question: savedQuestion
        } as Partial<QuestionOption>);
      });
      savedQuestion.options = await this.optionRepo.save(optionEntities);
    }

    await this.invalidateQuestionCaches(savedQuestion.id);

    return {
      success: true,
      data: savedQuestion
    };
  }

  async update(id: number, data: any) {
    const question = await this.questionRepo.findOne({
      where: { id },
      relations: ['options']
    });

    if (!question) {
      throw new Error('Question not found');
    }

    // Extract options from data
    const { options, difficulty: _difficulty, ...rawQuestionData } = data;

    const allowedFields = new Set([
      'questionBankId',
      'externalId',
      'textHtml',
      'explanationHtml',
      'subjectId',
      'systemId',
      'topicId',
      'step',
      'source',
      'imageUrls',
      'videoUrl',
      'estimatedTimeSeconds',
      'isActive',
      'parentSetId',
    ]);

    const questionData = Object.fromEntries(
      Object.entries(rawQuestionData).filter(([key]) => allowedFields.has(key))
    );

    // Ensure required question fields are not null if explicitly provided
    if ('textHtml' in questionData && questionData.textHtml === null) {
      questionData.textHtml = '';
    }
    if ('explanationHtml' in questionData && questionData.explanationHtml === null) {
      questionData.explanationHtml = '';
    }

    // Update question metadata
    Object.assign(question, questionData);

    const clampUworld = (value: any) => {
      if (value === null || value === undefined || value === '') return undefined;
      const parsed = Number(value);
      if (Number.isNaN(parsed)) return undefined;
      return Math.max(0, Math.min(100, Math.round(parsed)));
    };

    // Handle options update (in-place, never delete)
    if (options && Array.isArray(options)) {
      const validOptions = options.filter((opt: any) => {
        if (!opt) return false;
        return (
          opt.id ||
          opt.textHtml ||
          opt.text ||
          typeof opt.isCorrect !== 'undefined' ||
          typeof opt.uworldChosenBy !== 'undefined' ||
          typeof opt.explanationHtml !== 'undefined' ||
          typeof opt.explanation !== 'undefined' ||
          typeof opt.displayOrder !== 'undefined'
        );
      });

      // Save question first to update its own fields
      await this.questionRepo.save(question);

      if (validOptions.length > 0) {
        const existingById = new Map(
          (question.options || []).map(opt => [opt.id, opt])
        );

        const toSave: QuestionOption[] = [];

        validOptions.forEach((opt: any) => {
          const textHtml = opt.textHtml ?? opt.text;
          const explanationHtml = opt.explanationHtml ?? opt.explanation;
          const uworldChosenBy = clampUworld(opt.uworldChosenBy);

          if (opt.id && existingById.has(opt.id)) {
            const existing = existingById.get(opt.id)!;

            if (typeof textHtml !== 'undefined') {
              existing.textHtml = textHtml || '';
            }
            if (typeof explanationHtml !== 'undefined') {
              existing.explanationHtml = explanationHtml || '';
            }
            if (typeof opt.displayOrder !== 'undefined') {
              existing.displayOrder = opt.displayOrder || existing.displayOrder || 'A';
            }
            if (typeof opt.isCorrect !== 'undefined') {
              existing.isCorrect = !!opt.isCorrect;
            }
            if (typeof opt.uworldChosenBy !== 'undefined') {
              existing.uworldChosenBy = uworldChosenBy ?? null;
            }

            toSave.push(existing);
          } else {
            const created = this.optionRepo.create({
              questionId: id,
              question,
              textHtml: textHtml || '',
              explanationHtml: explanationHtml || '',
              displayOrder: opt.displayOrder || 'A',
              isCorrect: !!opt.isCorrect,
              uworldChosenBy: typeof opt.uworldChosenBy !== 'undefined' ? (uworldChosenBy ?? null) : null,
            } as Partial<QuestionOption>);
            toSave.push(created);
          }
        });

        if (toSave.length > 0) {
          await this.optionRepo.save(toSave);
        }
        question.options = await this.optionRepo.find({ where: { questionId: id } });
      }
    } else {
      // If no options provided, just save the question metadata
      await this.questionRepo.save(question);
    }

    // Return the updated state
    await this.invalidateQuestionCaches(id);

    return {
      success: true,
      data: (await this.questionRepo.findOne({
        where: { id },
        relations: ['options']
      })) as any
    };
  }

  async delete(id: number) {
    const result = await this.questionRepo.delete(id);
    if (result.affected) {
      await this.invalidateQuestionCaches(id);
    }
    return {
      success: true,
      message: result.affected ? 'Question deleted' : 'Question not found'
    };
  }

  private async invalidateQuestionCaches(questionId: number) {
    // safeCacheDel swallows Redis errors per-key — one failed eviction
    // doesn't cascade into the others, and a Redis outage won't make
    // admin question saves fail.
    const tasks: Promise<unknown>[] = [
      safeCacheDel(this.cacheManager, staticQuestionContentCacheKey(questionId)),
      safeCacheDel(this.cacheManager, questionAnswerCacheKey(questionId)),
      // Fix #5: explanation cache (4h TTL).
      safeCacheDel(this.cacheManager, questionExplanationCacheKey(questionId)),
      // Fix #4: bank totals — see KNOWN GAP comment below.
      safeCacheDel(this.cacheManager, bankTotalsCacheKey()),
      // Difficulty-counts epoch bump: an option edit can change the stored
      // questions.difficulty (via the DB trigger), so orphan every cached
      // per-bank difficulty distribution in one write.
      safeCacheSet(
        this.cacheManager,
        difficultyCountsEpochCacheKey(),
        Date.now().toString(),
        DIFFICULTY_COUNTS_EPOCH_TTL_MS,
      ),
    ];
    for (const step of [1, 2, 3, 4, 5]) {
      tasks.push(safeCacheDel(this.cacheManager, bankTotalsCacheKey(step)));
    }
    await Promise.all(tasks);
    // KNOWN GAP: bank-total entries keyed by a specific `mainBankId`
    // (e.g. step=2, mainBank=42) are NOT evicted here — we don't know
    // which mainBank a question's bank belongs to without an extra read,
    // and we don't track which variants exist. Those entries rely on
    // the 1h BANK_TOTALS_TTL_MS to expire. Display-only impact (counts
    // off by 1–N for ≤1h); the actual test creation always queries
    // fresh, so users never get a broken question set.
  }
}
