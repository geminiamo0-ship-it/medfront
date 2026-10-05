import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import JSZip from 'jszip';
import { InjectRepository } from '@nestjs/typeorm';
import * as sqlite3 from 'sqlite3';
import { In, Repository } from 'typeorm';
import {
  Flashcard,
  FlashcardContentBlock,
  FlashcardContentType,
} from '../entities/flashcard.entity';
import { FlashcardDeck } from '../entities/flashcard-deck.entity';
import { FlashcardStats } from '../entities/flashcard-stats.entity';
import {
  FlashcardReview,
  FlashcardStudyRating,
  FlashcardStudyState,
} from '../entities/flashcard-review.entity';
import { Question } from '../entities/question.entity';
import {
  AppendFlashcardContentDto,
  CreateFlashcardDeckDto,
  CreateFlashcardDto,
  FlashcardDeckQueryDto,
  FlashcardRescheduleMode,
  FlashcardQueryDto,
  FlashcardStudyDeckQueryDto,
  FlashcardSide,
  RateStudyCardDto,
  RescheduleFlashcardDto,
  UpdateFlashcardDeckDto,
  UpdateFlashcardDto,
} from './dto/flashcards.dto';

type StudyQueueBucket = 'new' | 'learning' | 'review';

interface StudyQueueItem {
  card: Flashcard;
  review: FlashcardReview;
  bucket: StudyQueueBucket;
}

interface AnkiMediaAsset {
  sourceUrl: string;
  fileName: string;
  zipKey: string;
  data: Buffer;
}

interface AnkiMediaState {
  assets: AnkiMediaAsset[];
  bySource: Map<string, AnkiMediaAsset>;
}

@Injectable()
export class FlashcardsService {
  constructor(
    @InjectRepository(Flashcard)
    private readonly flashcardsRepository: Repository<Flashcard>,
    @InjectRepository(FlashcardDeck)
    private readonly decksRepository: Repository<FlashcardDeck>,
    @InjectRepository(FlashcardStats)
    private readonly statsRepository: Repository<FlashcardStats>,
    @InjectRepository(FlashcardReview)
    private readonly reviewsRepository: Repository<FlashcardReview>,
    @InjectRepository(Question)
    private readonly questionsRepository: Repository<Question>,
  ) {}

  async getDecks(userId: number, query: FlashcardDeckQueryDto) {
    const qb = this.decksRepository
      .createQueryBuilder('deck')
      .where('deck.userId = :userId', { userId });

    if (query.search) {
      qb.andWhere('(deck.name ILIKE :search OR deck.description ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    return qb.orderBy('deck.updatedAt', 'DESC').getMany();
  }

  async createDeck(userId: number, dto: CreateFlashcardDeckDto) {
    const deck = this.decksRepository.create({
      userId,
      name: dto.name,
      description: dto.description,
      isPublic: dto.isPublic ?? false,
      cardCount: 0,
    });

    return this.decksRepository.save(deck);
  }

  async updateDeck(userId: number, id: number, dto: UpdateFlashcardDeckDto) {
    const deck = await this.getOwnedDeck(userId, id);

    if (dto.name !== undefined) deck.name = dto.name;
    if (dto.description !== undefined) deck.description = dto.description;
    if (dto.isPublic !== undefined) deck.isPublic = dto.isPublic;

    return this.decksRepository.save(deck);
  }

  async deleteDeck(userId: number, id: number) {
    const deck = await this.getOwnedDeck(userId, id);
    await this.decksRepository.remove(deck);
    return { success: true };
  }

  async exportDeckApkg(userId: number, id: number) {
    const deck = await this.getOwnedDeck(userId, id);
    const cards = await this.flashcardsRepository.find({
      where: { userId, deckId: deck.id },
      order: { updatedAt: 'ASC' },
    });

    if (!cards.length) {
      throw new BadRequestException('Cannot export an empty deck');
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdpark-apkg-'));
    const collectionPath = path.join(tempDir, 'collection.anki2');

    try {
      const mediaAssets = await this.buildAnkiCollectionDatabase(
        userId,
        deck,
        cards,
        collectionPath,
      );

      const zip = new JSZip();
      zip.file('collection.anki2', await fs.readFile(collectionPath));

      const mediaMap: Record<string, string> = {};
      for (const asset of mediaAssets) {
        zip.file(asset.zipKey, asset.data);
        mediaMap[asset.zipKey] = asset.fileName;
      }
      zip.file('media', JSON.stringify(mediaMap));

      const buffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      return {
        fileName: `${this.slugifyFileName(deck.name)}.apkg`,
        buffer,
      };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  async getFlashcards(userId: number, query: FlashcardQueryDto) {
    const qb = this.flashcardsRepository
      .createQueryBuilder('flashcard')
      .leftJoinAndSelect('flashcard.deck', 'deck')
      .where('flashcard.userId = :userId', { userId });

    if (query.search) {
      qb.andWhere(
        '(flashcard.frontPlainText ILIKE :search OR flashcard.backPlainText ILIKE :search OR deck.name ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.deckId) {
      qb.andWhere('flashcard.deckId = :deckId', { deckId: query.deckId });
    }

    if (query.questionId) {
      qb.andWhere('flashcard.questionId = :questionId', {
        questionId: query.questionId,
      });
    }

    if (query.color) {
      qb.andWhere('flashcard.color = :color', { color: query.color });
    }

    if (query.markColor) {
      qb.andWhere('flashcard.markColor = :markColor', {
        markColor: query.markColor,
      });
    }

    if (query.rating) {
      qb.andWhere('flashcard.rating = :rating', { rating: query.rating });
    }

    if (query.isMarked !== undefined) {
      qb.andWhere('flashcard.isMarked = :isMarked', { isMarked: query.isMarked });
    }
    const cards = await qb.orderBy('flashcard.updatedAt', 'DESC').getMany();
    if (!cards.length) return cards;

    const cardIds = cards.map((card) => card.id);
    await this.ensureReviewRows(userId, cardIds);
    const reviews = await this.reviewsRepository.find({
      where: { userId, cardId: In(cardIds) },
    });

    const reviewMap = new Map<number, FlashcardReview>();
    reviews.forEach((row) => reviewMap.set(row.cardId, row));

    return cards.map((card) => {
      const review = reviewMap.get(card.id);
      return {
        ...card,
        studyState: this.normalizeStudyState((review?.state as any) ?? FlashcardStudyState.NEW),
        studyDueAt: review?.dueAt ?? null,
        studyBuriedUntil: review?.buriedUntil ?? null,
      };
    });
  }

  async getQuestionFlashcards(userId: number, questionId: number, search?: string) {
    return this.getFlashcards(userId, {
      questionId,
      search,
    });
  }

  async getFlashcardById(userId: number, id: number) {
    return this.getOwnedFlashcard(userId, id);
  }

  async getQuestionPreviewForCard(userId: number, cardId: number) {
    const card = await this.getOwnedFlashcard(userId, cardId);
    if (!card.questionId) {
      throw new BadRequestException('This flashcard is not linked to a question');
    }

    const question = await this.questionsRepository.findOne({
      where: { id: card.questionId },
      relations: ['options', 'subject', 'system', 'topic', 'questionBank'],
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const sortedOptions = [...(question.options || [])].sort((a: any, b: any) => {
      return String(a.displayOrder || '').localeCompare(String(b.displayOrder || ''));
    });

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

  async createFlashcard(userId: number, dto: CreateFlashcardDto) {
    const deckId = await this.resolveDeckForCreation(userId, dto);

    const frontContent = this.sanitizeBlocks(dto.frontContent);
    const backContent = this.sanitizeBlocks(dto.backContent);
    this.assertCardHasContent(frontContent, backContent);
    this.assertAllowedBlockTypes(dto.questionId ?? null, frontContent, backContent);

    const flashcard = this.flashcardsRepository.create({
      userId,
      deckId,
      questionId: dto.questionId,
      color: dto.color,
      frontContent,
      backContent,
      frontPlainText: this.toPlainText(frontContent),
      backPlainText: this.toPlainText(backContent),
      isMarked: dto.isMarked ?? false,
      markColor: dto.markColor,
      rating: dto.rating,
    });

    const saved = await this.flashcardsRepository.save(flashcard);
    await this.updateDeckCardCount(deckId);
    await this.incrementTotalCardsCreated(userId);

    return this.getOwnedFlashcard(userId, saved.id);
  }

  async updateFlashcard(userId: number, id: number, dto: UpdateFlashcardDto) {
    const flashcard = await this.getOwnedFlashcard(userId, id);
    const previousDeckId = flashcard.deckId;

    if (dto.deckId !== undefined && dto.deckId !== flashcard.deckId) {
      const targetDeck = await this.getOwnedDeck(userId, dto.deckId);
      flashcard.deckId = targetDeck.id;
    }

    if (dto.questionId !== undefined) flashcard.questionId = dto.questionId;
    if (dto.color !== undefined) flashcard.color = dto.color;
    if (dto.isMarked !== undefined) flashcard.isMarked = dto.isMarked;
    if (dto.markColor !== undefined) flashcard.markColor = dto.markColor;
    if (dto.rating !== undefined) flashcard.rating = dto.rating;

    if (dto.frontContent !== undefined) {
      flashcard.frontContent = this.sanitizeBlocks(dto.frontContent);
    }

    if (dto.backContent !== undefined) {
      flashcard.backContent = this.sanitizeBlocks(dto.backContent);
    }

    this.assertCardHasContent(flashcard.frontContent, flashcard.backContent);
    this.assertAllowedBlockTypes(
      flashcard.questionId ?? null,
      flashcard.frontContent,
      flashcard.backContent,
    );

    flashcard.frontPlainText = this.toPlainText(flashcard.frontContent);
    flashcard.backPlainText = this.toPlainText(flashcard.backContent);

    const updated = await this.flashcardsRepository.save(flashcard);

    if (previousDeckId !== flashcard.deckId) {
      await Promise.all([
        this.updateDeckCardCount(previousDeckId),
        this.updateDeckCardCount(flashcard.deckId),
      ]);
    }

    return this.getOwnedFlashcard(userId, updated.id);
  }

  async appendContent(userId: number, id: number, dto: AppendFlashcardContentDto) {
    const flashcard = await this.getOwnedFlashcard(userId, id);

    const [content] = this.sanitizeBlocks([dto.content]);
    if (!content) {
      throw new BadRequestException('Content block is required');
    }
    this.assertAllowedBlockTypes(flashcard.questionId ?? null, [content], []);

    if (dto.side === FlashcardSide.FRONT) {
      flashcard.frontContent = [...(flashcard.frontContent ?? []), content];
      flashcard.frontPlainText = this.toPlainText(flashcard.frontContent);
    } else {
      flashcard.backContent = [...(flashcard.backContent ?? []), content];
      flashcard.backPlainText = this.toPlainText(flashcard.backContent);
    }

    await this.flashcardsRepository.save(flashcard);
    return this.getOwnedFlashcard(userId, id);
  }

  async deleteFlashcard(userId: number, id: number) {
    const flashcard = await this.getOwnedFlashcard(userId, id);
    const deckId = flashcard.deckId;

    await this.flashcardsRepository.remove(flashcard);
    await this.updateDeckCardCount(deckId);

    return { success: true };
  }

  async getStudyDecks(userId: number, query: FlashcardStudyDeckQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const qb = this.decksRepository
      .createQueryBuilder('deck')
      .where('deck.userId = :userId', { userId });

    if (query.search) {
      qb.andWhere('deck.name ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    const total = await qb.getCount();
    const decks = await qb
      .orderBy('deck.updatedAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    if (!decks.length) {
      return {
        data: [],
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      };
    }

    const deckIds = decks.map((deck) => deck.id);
    const deckCards = await this.flashcardsRepository.find({
      where: { userId, deckId: In(deckIds) },
      select: ['id', 'deckId'],
    });

    const cardIds = deckCards.map((card) => card.id);
    await this.ensureReviewRows(userId, cardIds);

    const reviews = cardIds.length
      ? await this.reviewsRepository.find({
          where: { userId, cardId: In(cardIds) },
        })
      : [];

    const now = new Date();
    const cardToDeckId = new Map<number, number>();
    deckCards.forEach((card) => cardToDeckId.set(card.id, card.deckId));

    const summaries = new Map<
      number,
      {
        deckId: number;
        name: string;
        newCards: number;
        learning: number;
        toReview: number;
        lastUsed: Date | null;
        totalCards: number;
      }
    >();

    decks.forEach((deck) =>
      summaries.set(deck.id, {
        deckId: deck.id,
        name: deck.name,
        newCards: 0,
        learning: 0,
        toReview: 0,
        lastUsed: null,
        totalCards: 0,
      }),
    );

    deckCards.forEach((card) => {
      const summary = summaries.get(card.deckId);
      if (summary) summary.totalCards += 1;
    });

    reviews.forEach((review) => {
      const deckId = cardToDeckId.get(review.cardId);
      if (!deckId) return;

      const summary = summaries.get(deckId);
      if (!summary) return;

      if (
        review.lastReviewedAt &&
        (!summary.lastUsed || review.lastReviewedAt > summary.lastUsed)
      ) {
        summary.lastUsed = review.lastReviewedAt;
      }

      const isBuried = !!(review.buriedUntil && review.buriedUntil > now);
      if (review.state === FlashcardStudyState.SUSPENDED || isBuried) return;

      if (review.state === FlashcardStudyState.NEW) {
        summary.newCards += 1;
        return;
      }

      const isDue = !review.dueAt || review.dueAt <= now;
      if (!isDue) return;

      if (review.state === FlashcardStudyState.LEARNING) {
        summary.learning += 1;
        return;
      }

      if (review.state === FlashcardStudyState.REVIEW) {
        summary.toReview += 1;
      }
    });

    return {
      data: decks.map((deck) => summaries.get(deck.id)!),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async getStudySession(userId: number, deckId: number) {
    const deck = await this.getOwnedDeck(userId, deckId);

    const cards = await this.flashcardsRepository.find({
      where: { userId, deckId },
      order: { id: 'ASC' },
    });

    const cardIds = cards.map((card) => card.id);
    await this.ensureReviewRows(userId, cardIds);

    const reviews = cardIds.length
      ? await this.reviewsRepository.find({
          where: { userId, cardId: In(cardIds) },
        })
      : [];

    const reviewMap = new Map<number, FlashcardReview>();
    reviews.forEach((review) => reviewMap.set(review.cardId, review));

    const queue = this.buildStudyQueue(cards, reviewMap, new Date());
    const current = queue[0];

    const newCount = queue.filter((item) => item.bucket === 'new').length;
    const learningCount = queue.filter((item) => item.bucket === 'learning').length;
    const reviewCount = queue.filter((item) => item.bucket === 'review').length;

    return {
      deck: {
        id: deck.id,
        name: deck.name,
      },
      progress: {
        newCards: newCount,
        learning: learningCount,
        toReview: reviewCount,
        remaining: queue.length,
      },
      currentCard: current ? this.toStudyCardPayload(current.card, current.review) : null,
      completed: !current,
    };
  }

  async rateStudyCard(userId: number, deckId: number, dto: RateStudyCardDto) {
    const card = await this.flashcardsRepository.findOne({
      where: { id: dto.cardId, userId, deckId },
    });

    if (!card) {
      throw new NotFoundException('Flashcard not found in this deck');
    }

    const review = await this.getOrCreateReviewRow(userId, card.id);
    if (review.state === FlashcardStudyState.SUSPENDED) {
      throw new BadRequestException('Card is suspended from study');
    }

    this.applyRating(review, dto.rating, new Date());
    await this.reviewsRepository.save(review);
    await this.incrementStudyStats(userId, dto.elapsedMs ?? 0);

    return this.getStudySession(userId, deckId);
  }

  async buryStudyCard(userId: number, deckId: number, cardId: number) {
    const card = await this.flashcardsRepository.findOne({
      where: { id: cardId, userId, deckId },
    });

    if (!card) {
      throw new NotFoundException('Flashcard not found in this deck');
    }

    const review = await this.getOrCreateReviewRow(userId, card.id);
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    review.buriedUntil = tomorrow;
    await this.reviewsRepository.save(review);

    return this.getStudySession(userId, deckId);
  }

  async suspendStudyCard(userId: number, deckId: number, cardId: number) {
    const card = await this.flashcardsRepository.findOne({
      where: { id: cardId, userId, deckId },
    });

    if (!card) {
      throw new NotFoundException('Flashcard not found in this deck');
    }

    const review = await this.getOrCreateReviewRow(userId, card.id);
    review.state = FlashcardStudyState.SUSPENDED;
    review.buriedUntil = null;
    await this.reviewsRepository.save(review);

    return this.getStudySession(userId, deckId);
  }

  async unsuspendFlashcard(userId: number, cardId: number) {
    const card = await this.getOwnedFlashcard(userId, cardId);
    const review = await this.getOrCreateReviewRow(userId, card.id);

    if (this.normalizeStudyState(review.state as any) === FlashcardStudyState.SUSPENDED) {
      if ((review.intervalDays || 0) > 0 || (review.reps || 0) > 0) {
        review.state = FlashcardStudyState.REVIEW;
      } else if ((review.learningStep || 0) > 0) {
        review.state = FlashcardStudyState.LEARNING;
      } else {
        review.state = FlashcardStudyState.NEW;
      }

      const now = new Date();
      review.buriedUntil = null;
      if (review.state === FlashcardStudyState.NEW) {
        review.dueAt = null;
      } else if (!review.dueAt || review.dueAt > now) {
        review.dueAt = now;
      }

      await this.reviewsRepository.save(review);
    }

    return {
      success: true,
      cardId: card.id,
      state: this.normalizeStudyState(review.state as any),
      dueAt: review.dueAt,
    };
  }

  async rescheduleFlashcard(
    userId: number,
    cardId: number,
    dto: RescheduleFlashcardDto,
  ) {
    const card = await this.getOwnedFlashcard(userId, cardId);
    const review = await this.getOrCreateReviewRow(userId, card.id);

    const now = new Date();
    review.buriedUntil = null;

    if (dto.mode === FlashcardRescheduleMode.NEW) {
      review.state = FlashcardStudyState.NEW;
      review.learningStep = 0;
      review.intervalDays = 0;
      review.dueAt = null;
    } else {
      const days = Math.max(1, dto.days ?? 1);
      review.state = FlashcardStudyState.REVIEW;
      review.learningStep = 0;
      review.intervalDays = days;
      review.dueAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    }

    await this.reviewsRepository.save(review);

    return {
      success: true,
      cardId: card.id,
      state: review.state,
      dueAt: review.dueAt,
      intervalDays: review.intervalDays,
    };
  }

  async getFlashcardStudyState(userId: number, cardId: number) {
    const card = await this.getOwnedFlashcard(userId, cardId);
    const review = await this.getOrCreateReviewRow(userId, card.id);

    return {
      cardId: card.id,
      state: this.normalizeStudyState(review.state as any),
      dueAt: review.dueAt,
      buriedUntil: review.buriedUntil,
    };
  }

  private buildStudyQueue(
    cards: Flashcard[],
    reviewMap: Map<number, FlashcardReview>,
    now: Date,
  ): StudyQueueItem[] {
    const learning: StudyQueueItem[] = [];
    const review: StudyQueueItem[] = [];
    const newCards: StudyQueueItem[] = [];

    cards.forEach((card) => {
      const reviewRow = reviewMap.get(card.id);
      if (!reviewRow) return;

      if (reviewRow.state === FlashcardStudyState.SUSPENDED) return;
      if (reviewRow.buriedUntil && reviewRow.buriedUntil > now) return;

      if (reviewRow.state === FlashcardStudyState.NEW) {
        newCards.push({ card, review: reviewRow, bucket: 'new' });
        return;
      }

      const isDue = !reviewRow.dueAt || reviewRow.dueAt <= now;
      if (!isDue) return;

      if (reviewRow.state === FlashcardStudyState.LEARNING) {
        learning.push({ card, review: reviewRow, bucket: 'learning' });
        return;
      }

      if (reviewRow.state === FlashcardStudyState.REVIEW) {
        review.push({ card, review: reviewRow, bucket: 'review' });
      }
    });

    learning.sort(
      (a, b) => (a.review.dueAt?.getTime() ?? 0) - (b.review.dueAt?.getTime() ?? 0),
    );
    review.sort(
      (a, b) => (a.review.dueAt?.getTime() ?? 0) - (b.review.dueAt?.getTime() ?? 0),
    );

    return [...learning, ...review, ...newCards];
  }

  private toStudyCardPayload(card: Flashcard, review: FlashcardReview) {
    return {
      id: card.id,
      questionId: card.questionId,
      frontContent: card.frontContent,
      backContent: card.backContent,
      state: review.state,
      availableRatings: this.getAvailableRatings(review),
    };
  }

  private getAvailableRatings(review: FlashcardReview) {
    const ratings =
      review.state === FlashcardStudyState.NEW
        ? [
            FlashcardStudyRating.AGAIN,
            FlashcardStudyRating.GOOD,
            FlashcardStudyRating.EASY,
          ]
        : [
            FlashcardStudyRating.AGAIN,
            FlashcardStudyRating.HARD,
            FlashcardStudyRating.GOOD,
            FlashcardStudyRating.EASY,
          ];

    return ratings.map((rating) => ({
      rating,
      intervalLabel: this.describeInterval(
        this.estimateNextIntervalMs(review, rating),
      ),
    }));
  }

  private estimateNextIntervalMs(
    review: FlashcardReview,
    rating: FlashcardStudyRating,
  ): number {
    const minute = 60 * 1000;
    const day = 24 * 60 * minute;

    if (review.state === FlashcardStudyState.NEW) {
      if (rating === FlashcardStudyRating.AGAIN) return minute;
      if (rating === FlashcardStudyRating.GOOD) return 10 * minute;
      return 4 * day;
    }

    if (review.state === FlashcardStudyState.LEARNING) {
      if (rating === FlashcardStudyRating.AGAIN) return 10 * minute;
      if (rating === FlashcardStudyRating.HARD) return 30 * minute;
      if (rating === FlashcardStudyRating.GOOD) return day;
      return 4 * day;
    }

    const intervalDays = Math.max(1, review.intervalDays || 1);
    const ease = Math.max(1.3, review.easeFactor || 2.5);

    if (rating === FlashcardStudyRating.AGAIN) return 10 * minute;
    if (rating === FlashcardStudyRating.HARD)
      return Math.max(1, Math.round(intervalDays * 1.2)) * day;
    if (rating === FlashcardStudyRating.GOOD)
      return Math.max(1, Math.round(intervalDays * ease)) * day;

    return Math.max(1, Math.round(intervalDays * ease * 1.3)) * day;
  }

  private describeInterval(ms: number): string {
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (ms <= minute) return '<1m';
    if (ms <= 10 * minute) return '<10m';
    if (ms <= 30 * minute) return '<30m';
    if (ms < day) return `<${Math.max(1, Math.round(ms / hour))}h`;
    return `${Math.max(1, Math.round(ms / day))}d`;
  }

  private applyRating(
    review: FlashcardReview,
    rating: FlashcardStudyRating,
    now: Date,
  ) {
    const minute = 60 * 1000;
    const day = 24 * 60 * minute;
    const baseEase = Math.max(1.3, review.easeFactor || 2.5);

    if (review.state === FlashcardStudyState.NEW) {
      if (rating === FlashcardStudyRating.AGAIN) {
        review.state = FlashcardStudyState.LEARNING;
        review.learningStep = 0;
        review.intervalDays = 0;
        review.dueAt = new Date(now.getTime() + minute);
      } else if (rating === FlashcardStudyRating.GOOD || rating === FlashcardStudyRating.HARD) {
        review.state = FlashcardStudyState.LEARNING;
        review.learningStep = 1;
        review.intervalDays = 0;
        review.dueAt = new Date(now.getTime() + 10 * minute);
      } else {
        review.state = FlashcardStudyState.REVIEW;
        review.learningStep = 0;
        review.intervalDays = 4;
        review.dueAt = new Date(now.getTime() + 4 * day);
        review.reps += 1;
      }
    } else if (review.state === FlashcardStudyState.LEARNING) {
      if (rating === FlashcardStudyRating.AGAIN) {
        review.learningStep = 0;
        review.dueAt = new Date(now.getTime() + 10 * minute);
      } else if (rating === FlashcardStudyRating.HARD) {
        review.learningStep = 1;
        review.dueAt = new Date(now.getTime() + 30 * minute);
      } else if (rating === FlashcardStudyRating.GOOD) {
        review.state = FlashcardStudyState.REVIEW;
        review.learningStep = 0;
        review.intervalDays = 1;
        review.dueAt = new Date(now.getTime() + day);
        review.reps += 1;
      } else {
        review.state = FlashcardStudyState.REVIEW;
        review.learningStep = 0;
        review.intervalDays = 4;
        review.dueAt = new Date(now.getTime() + 4 * day);
        review.reps += 1;
      }
    } else {
      const intervalDays = Math.max(1, review.intervalDays || 1);
      if (rating === FlashcardStudyRating.AGAIN) {
        review.state = FlashcardStudyState.LEARNING;
        review.learningStep = 0;
        review.intervalDays = 0;
        review.easeFactor = Math.max(1.3, baseEase - 0.2);
        review.lapses += 1;
        review.dueAt = new Date(now.getTime() + 10 * minute);
      } else if (rating === FlashcardStudyRating.HARD) {
        review.state = FlashcardStudyState.REVIEW;
        review.learningStep = 0;
        review.intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
        review.easeFactor = Math.max(1.3, baseEase - 0.05);
        review.reps += 1;
        review.dueAt = new Date(now.getTime() + review.intervalDays * day);
      } else if (rating === FlashcardStudyRating.GOOD) {
        review.state = FlashcardStudyState.REVIEW;
        review.learningStep = 0;
        review.intervalDays = Math.max(
          1,
          Math.round(intervalDays * baseEase),
        );
        review.reps += 1;
        review.dueAt = new Date(now.getTime() + review.intervalDays * day);
      } else {
        const adjustedEase = Math.min(3.0, baseEase + 0.15);
        review.state = FlashcardStudyState.REVIEW;
        review.learningStep = 0;
        review.easeFactor = adjustedEase;
        review.intervalDays = Math.max(
          1,
          Math.round(intervalDays * adjustedEase * 1.3),
        );
        review.reps += 1;
        review.dueAt = new Date(now.getTime() + review.intervalDays * day);
      }
    }

    review.lastReviewedAt = now;
    review.lastRating = rating;
    review.buriedUntil = null;
    if (!review.easeFactor || review.easeFactor < 1.3) {
      review.easeFactor = 2.5;
    }
  }

  private async ensureReviewRows(userId: number, cardIds: number[]) {
    if (!cardIds.length) return;

    const existingRows = await this.reviewsRepository.find({
      where: { userId, cardId: In(cardIds) },
      select: ['cardId'],
    });

    const existingCardIds = new Set(existingRows.map((row) => row.cardId));
    const missing = cardIds.filter((cardId) => !existingCardIds.has(cardId));
    if (!missing.length) return;

    const newRows = missing.map((cardId) =>
      this.reviewsRepository.create({
        userId,
        cardId,
        state: FlashcardStudyState.NEW,
        intervalDays: 0,
        easeFactor: 2.5,
        learningStep: 0,
        reps: 0,
        lapses: 0,
      }),
    );

    await this.reviewsRepository.save(newRows);
  }

  private async getOrCreateReviewRow(
    userId: number,
    cardId: number,
  ): Promise<FlashcardReview> {
    await this.ensureReviewRows(userId, [cardId]);
    const review = await this.reviewsRepository.findOne({
      where: { userId, cardId },
    });

    if (!review) {
      throw new NotFoundException('Study row not found for card');
    }

    return review;
  }

  private async incrementStudyStats(userId: number, elapsedMs: number) {
    const now = new Date();
    const stats = await this.statsRepository.findOne({ where: { userId } });

    if (!stats) {
      const created = this.statsRepository.create({
        userId,
        totalCardsCreated: 0,
        totalReviews: 1,
        currentStreak: 1,
        longestStreak: 1,
        lastReviewDate: now,
        cardsReviewedToday: 1,
        totalStudyTimeMs: Math.max(0, elapsedMs || 0),
      });
      await this.statsRepository.save(created);
      return;
    }

    const sameDay = stats.lastReviewDate
      ? this.isSameUtcDay(stats.lastReviewDate, now)
      : false;

    if (sameDay) {
      stats.cardsReviewedToday = (stats.cardsReviewedToday || 0) + 1;
    } else {
      const consecutive = stats.lastReviewDate
        ? this.isConsecutiveUtcDay(stats.lastReviewDate, now)
        : false;
      stats.currentStreak = consecutive ? (stats.currentStreak || 0) + 1 : 1;
      stats.cardsReviewedToday = 1;
    }

    stats.longestStreak = Math.max(stats.longestStreak || 0, stats.currentStreak || 0);
    stats.totalReviews = (stats.totalReviews || 0) + 1;
    stats.totalStudyTimeMs = (stats.totalStudyTimeMs || 0) + Math.max(0, elapsedMs || 0);
    stats.lastReviewDate = now;

    await this.statsRepository.save(stats);
  }

  private async buildAnkiCollectionDatabase(
    userId: number,
    deck: FlashcardDeck,
    cards: Flashcard[],
    outputPath: string,
  ): Promise<AnkiMediaAsset[]> {
    const db = await this.openSqliteDatabase(outputPath);
    const nowMs = Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    const createdDays = Math.floor(nowSec / 86400);
    const modelId = this.buildAnkiNumericId(`model:${userId}:mdpark-flashcard`);
    const deckId = this.buildAnkiNumericId(`deck:${userId}:${deck.id}`);
    const baseUrl = this.getFlashcardsBaseUrl();
    const mediaState: AnkiMediaState = {
      assets: [],
      bySource: new Map<string, AnkiMediaAsset>(),
    };

    const schemaStatements = [
      `CREATE TABLE col (
        id integer primary key,
        crt integer not null,
        mod integer not null,
        scm integer not null,
        ver integer not null,
        dty integer not null,
        usn integer not null,
        ls integer not null,
        conf text not null,
        models text not null,
        decks text not null,
        dconf text not null,
        tags text not null
      )`,
      `CREATE TABLE notes (
        id integer primary key,
        guid text not null,
        mid integer not null,
        mod integer not null,
        usn integer not null,
        tags text not null,
        flds text not null,
        sfld text not null,
        csum integer not null,
        flags integer not null,
        data text not null
      )`,
      `CREATE TABLE cards (
        id integer primary key,
        nid integer not null,
        did integer not null,
        ord integer not null,
        mod integer not null,
        usn integer not null,
        type integer not null,
        queue integer not null,
        due integer not null,
        ivl integer not null,
        factor integer not null,
        reps integer not null,
        lapses integer not null,
        left integer not null,
        odue integer not null,
        odid integer not null,
        flags integer not null,
        data text not null
      )`,
      `CREATE TABLE revlog (
        id integer primary key,
        cid integer not null,
        usn integer not null,
        ease integer not null,
        ivl integer not null,
        lastIvl integer not null,
        factor integer not null,
        time integer not null,
        type integer not null
      )`,
      `CREATE TABLE graves (
        usn integer not null,
        oid integer not null,
        type integer not null
      )`,
      `CREATE INDEX ix_notes_usn on notes (usn)`,
      `CREATE INDEX ix_cards_usn on cards (usn)`,
      `CREATE INDEX ix_cards_nid on cards (nid)`,
      `CREATE INDEX ix_cards_sched on cards (did, queue, due)`,
      `CREATE INDEX ix_revlog_usn on revlog (usn)`,
    ];

    try {
      for (const statement of schemaStatements) {
        await this.runSqlite(db, statement);
      }

      const modelName = 'MDPark Flashcard (v1)';
      const fieldNames = [
        'Front',
        'Back',
        'QuestionUrl',
        'CardId',
        'QuestionId',
        'DeckName',
      ];
      const model = {
        id: modelId,
        name: modelName,
        type: 0,
        mod: nowSec,
        usn: 0,
        sortf: 0,
        did: deckId,
        latexPre:
          '\\documentclass[12pt]{article}\n\\special{papertype=letter}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}',
        latexPost: '\\end{document}',
        css: `.card { font-family: Arial, Helvetica, sans-serif; font-size: 20px; text-align: left; color: #111827; background: #ffffff; }
.mdpark-meta { margin-top: 12px; font-size: 12px; color: #6b7280; }
.mdpark-link { margin-top: 10px; font-size: 14px; }`,
        flds: fieldNames.map((name, ord) => ({
          name,
          ord,
          sticky: false,
          rtl: false,
          font: 'Arial',
          size: 20,
          description: '',
        })),
        tmpls: [
          {
            name: 'Card 1',
            ord: 0,
            qfmt:
              '{{Front}}{{#QuestionUrl}}<div class="mdpark-link"><a href="{{QuestionUrl}}">Open Linked Question</a></div>{{/QuestionUrl}}<div class="mdpark-meta">Card #{{CardId}}{{#QuestionId}} | Q#{{QuestionId}}{{/QuestionId}}</div>',
            afmt:
              '{{FrontSide}}<hr id=answer>{{Back}}{{#QuestionUrl}}<div class="mdpark-link"><a href="{{QuestionUrl}}">Open Linked Question</a></div>{{/QuestionUrl}}<div class="mdpark-meta">Deck: {{DeckName}}</div>',
            bqfmt: '',
            bafmt: '',
            did: null,
          },
        ],
        req: [[0, 'all', [0]]],
        tags: [],
        vers: [],
      };

      const deckEntry = this.buildAnkiDeckEntry(deckId, deck.name, nowSec);
      const defaultDeckEntry = this.buildAnkiDeckEntry(1, 'Default', nowSec);
      const decks = {
        '1': defaultDeckEntry,
        [String(deckId)]: deckEntry,
      };

      const deckConfig = {
        id: 1,
        name: 'Default',
        mod: nowSec,
        usn: 0,
        maxTaken: 60,
        autoplay: true,
        timer: 0,
        replayq: true,
        new: {
          bury: true,
          delays: [1, 10],
          initialFactor: 2500,
          ints: [1, 4, 7],
          order: 1,
          perDay: 20,
          separate: true,
        },
        rev: {
          bury: true,
          ease4: 1.3,
          fuzz: 0.05,
          ivlFct: 1,
          maxIvl: 36500,
          perDay: 200,
        },
        lapse: {
          delays: [10],
          leechAction: 0,
          leechFails: 8,
          minInt: 1,
          mult: 0,
        },
      };

      const conf = {
        curDeck: deckId,
        activeDecks: [deckId],
        nextPos: cards.length + 1,
        sortType: 'noteFld',
        sortBackwards: false,
        addToCur: true,
        dueCounts: true,
        estTimes: true,
        newSpread: 0,
        collapseTime: 1200,
        timeLim: 0,
      };

      await this.runSqlite(
        db,
        `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          1,
          createdDays,
          nowSec,
          nowMs,
          11,
          0,
          0,
          0,
          JSON.stringify(conf),
          JSON.stringify({ [String(modelId)]: model }),
          JSON.stringify(decks),
          JSON.stringify({ '1': deckConfig }),
          '{}',
        ],
      );

      const usedNoteIds = new Set<number>();
      const usedCardIds = new Set<number>();
      let due = 1;

      for (const card of cards) {
        const guid = this.buildAnkiGuid(userId, card.id);
        const noteId = this.ensureUniqueId(
          usedNoteIds,
          this.buildAnkiNumericId(`note:${userId}:${card.id}`),
        );
        const cardId = this.ensureUniqueId(
          usedCardIds,
          this.buildAnkiNumericId(`card:${userId}:${card.id}`),
        );

        const frontHtml = await this.renderBlocksForAnki(
          card.frontContent,
          mediaState,
        );
        const backHtml = await this.renderBlocksForAnki(
          card.backContent,
          mediaState,
        );
        const questionUrl = card.questionId
          ? this.buildQuestionPreviewUrl(baseUrl, card.id)
          : '';
        const questionId = card.questionId ? String(card.questionId) : '';
        const sortField =
          this.toPlainText(card.frontContent) ||
          this.toPlainText(card.backContent) ||
          `Card ${card.id}`;

        const flds = [
          frontHtml,
          backHtml,
          questionUrl,
          String(card.id),
          questionId,
          deck.name,
        ]
          .map((value) => this.sanitizeAnkiField(value))
          .join('\u001f');

        const noteMod = Math.floor(new Date(card.updatedAt || nowMs).getTime() / 1000);
        const csum = this.buildAnkiChecksum(sortField);

        await this.runSqlite(
          db,
          `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [noteId, guid, modelId, noteMod, 0, '', flds, sortField, csum, 0, ''],
        );

        await this.runSqlite(
          db,
          `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [cardId, noteId, deckId, 0, noteMod, 0, 0, 0, due++, 0, 2500, 0, 0, 0, 0, 0, 0, ''],
        );
      }
    } finally {
      await this.closeSqliteDatabase(db);
    }

    return mediaState.assets;
  }

  private buildAnkiDeckEntry(deckId: number, name: string, mod: number) {
    return {
      id: deckId,
      name,
      mod,
      usn: 0,
      desc: '',
      dyn: 0,
      collapsed: false,
      browserCollapsed: false,
      extendNew: 0,
      extendRev: 0,
      conf: 1,
      newToday: [0, 0],
      revToday: [0, 0],
      lrnToday: [0, 0],
      timeToday: [0, 0],
    };
  }

  private buildAnkiGuid(userId: number, cardId: number): string {
    return createHash('sha1')
      .update(`mdpark:${userId}:${cardId}`)
      .digest('hex')
      .slice(0, 16);
  }

  private buildAnkiNumericId(seed: string): number {
    return parseInt(createHash('sha1').update(seed).digest('hex').slice(0, 13), 16);
  }

  private ensureUniqueId(used: Set<number>, initial: number): number {
    let value = initial;
    while (used.has(value)) {
      value += 1;
    }
    used.add(value);
    return value;
  }

  private buildAnkiChecksum(input: string): number {
    const hash = createHash('sha1').update(input || '').digest('hex');
    return parseInt(hash.slice(0, 8), 16);
  }

  private sanitizeAnkiField(value: string): string {
    return String(value || '').replace(/[\u0000\u001f\u001e]/g, ' ').trim();
  }

  private async renderBlocksForAnki(
    blocks: FlashcardContentBlock[],
    mediaState: AnkiMediaState,
  ): Promise<string> {
    const html = (blocks || [])
      .map((block) => {
        const value = String(block?.value || '').trim();
        if (!value) return '';

        if (block.type === FlashcardContentType.IMAGE) {
          if (/<img[\s\S]*?>/i.test(value)) {
            return value;
          }
          return `<img src="${this.escapeHtmlAttribute(value)}" alt="Flashcard image" />`;
        }

        if (block.type === FlashcardContentType.TABLE) {
          return value;
        }

        if (/<[a-z][\s\S]*>/i.test(value)) {
          return value;
        }

        return this.escapeHtmlText(value).replace(/\r?\n/g, '<br>');
      })
      .filter((value) => value.length > 0)
      .join('<br>');

    const content = html || '&nbsp;';
    return this.rewriteHtmlImageSourcesForAnki(content, mediaState);
  }

  private async rewriteHtmlImageSourcesForAnki(
    html: string,
    mediaState: AnkiMediaState,
  ): Promise<string> {
    const sources = this.extractImageSourcesFromHtml(html);
    if (!sources.length) {
      return html;
    }

    for (const source of sources) {
      await this.ensureAnkiMediaAsset(source, mediaState);
    }

    return html.replace(
      /<img\b([^>]*?)\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^'"\s>]+))([^>]*?)>/gi,
      (
        match: string,
        preAttrs: string,
        doubleQuoted: string,
        singleQuoted: string,
        unquoted: string,
        postAttrs: string,
      ) => {
        const rawSource = doubleQuoted || singleQuoted || unquoted || '';
        const source = this.normalizeMediaSource(rawSource);
        if (!source) {
          return match;
        }

        const asset = mediaState.bySource.get(source);
        if (!asset) {
          return match;
        }

        return `<img${preAttrs || ''}src="${this.escapeHtmlAttribute(asset.fileName)}"${postAttrs || ''}>`;
      },
    );
  }

  private extractImageSourcesFromHtml(html: string): string[] {
    const sources = new Set<string>();
    const pattern =
      /<img\b([^>]*?)\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^'"\s>]+))([^>]*?)>/gi;
    let match: RegExpExecArray | null = null;

    while ((match = pattern.exec(html)) !== null) {
      const rawSource = match[2] || match[3] || match[4] || '';
      const source = this.normalizeMediaSource(rawSource);
      if (source) {
        sources.add(source);
      }
    }

    return Array.from(sources);
  }

  private async ensureAnkiMediaAsset(
    sourceUrl: string,
    mediaState: AnkiMediaState,
  ): Promise<AnkiMediaAsset | null> {
    const existing = mediaState.bySource.get(sourceUrl);
    if (existing) {
      return existing;
    }

    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        return null;
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) {
        return null;
      }

      const extension = this.resolveImageExtension(
        sourceUrl,
        response.headers.get('content-type'),
      );
      const hash = createHash('sha1')
        .update(sourceUrl)
        .digest('hex')
        .slice(0, 24);
      const fileName = `mdpark_${hash}.${extension}`;
      const asset: AnkiMediaAsset = {
        sourceUrl,
        fileName,
        zipKey: String(mediaState.assets.length),
        data: bytes,
      };

      mediaState.bySource.set(sourceUrl, asset);
      mediaState.assets.push(asset);
      return asset;
    } catch {
      return null;
    }
  }

  private normalizeMediaSource(source: string): string | null {
    const decoded = this.decodeHtmlEntities(String(source || '').trim());
    if (!decoded) {
      return null;
    }

    if (/^https?:\/\//i.test(decoded)) {
      return decoded;
    }

    if (/^\/\//.test(decoded)) {
      return `https:${decoded}`;
    }

    return null;
  }

  private decodeHtmlEntities(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  private resolveImageExtension(
    sourceUrl: string,
    contentType?: string | null,
  ): string {
    const allowedExtensions = new Set([
      'jpg',
      'jpeg',
      'png',
      'gif',
      'webp',
      'bmp',
      'svg',
      'avif',
    ]);

    try {
      const parsedUrl = new URL(sourceUrl);
      const ext = path.extname(parsedUrl.pathname || '').replace(/^\./, '').toLowerCase();
      if (allowedExtensions.has(ext)) {
        return ext === 'jpeg' ? 'jpg' : ext;
      }
    } catch {
      // ignore
    }

    const mimeType = String(contentType || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
      'image/svg+xml': 'svg',
      'image/avif': 'avif',
    };

    return mimeMap[mimeType] || 'png';
  }

  private escapeHtmlText(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeHtmlAttribute(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private slugifyFileName(value: string): string {
    const clean = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return clean || 'flashcards-deck';
  }

  private getFlashcardsBaseUrl(): string {
    const direct =
      process.env.FLASHCARDS_EXPORT_BASE_URL ||
      process.env.FRONTEND_URL ||
      process.env.APP_URL;
    if (direct && /^https?:\/\//i.test(direct.trim())) {
      return direct.trim().replace(/\/+$/, '');
    }

    const corsOrigin = String(process.env.CORS_ORIGIN || '')
      .split(',')
      .map((part) => part.trim())
      .find((part) => /^https?:\/\//i.test(part));

    if (corsOrigin) {
      return corsOrigin.replace(/\/+$/, '');
    }

    return 'http://localhost:5173';
  }

  private buildQuestionPreviewUrl(baseUrl: string, cardId: number): string {
    return `${baseUrl}/dashboard/flashcards?previewCardId=${cardId}`;
  }

  private openSqliteDatabase(filePath: string): Promise<sqlite3.Database> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(filePath, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(db);
      });
    });
  }

  private runSqlite(
    db: sqlite3.Database,
    sql: string,
    params: any[] = [],
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      db.run(sql, params, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private closeSqliteDatabase(db: sqlite3.Database): Promise<void> {
    return new Promise((resolve, reject) => {
      db.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private isSameUtcDay(a: Date, b: Date): boolean {
    return (
      a.getUTCFullYear() === b.getUTCFullYear() &&
      a.getUTCMonth() === b.getUTCMonth() &&
      a.getUTCDate() === b.getUTCDate()
    );
  }

  private isConsecutiveUtcDay(previous: Date, next: Date): boolean {
    const prevDate = Date.UTC(
      previous.getUTCFullYear(),
      previous.getUTCMonth(),
      previous.getUTCDate(),
    );
    const nextDate = Date.UTC(
      next.getUTCFullYear(),
      next.getUTCMonth(),
      next.getUTCDate(),
    );
    return nextDate - prevDate === 24 * 60 * 60 * 1000;
  }

  private normalizeStudyState(state: string): FlashcardStudyState {
    const normalized = String(state || '').toLowerCase();

    if (normalized === FlashcardStudyState.LEARNING) {
      return FlashcardStudyState.LEARNING;
    }
    if (normalized === FlashcardStudyState.REVIEW) {
      return FlashcardStudyState.REVIEW;
    }
    if (normalized === FlashcardStudyState.SUSPENDED) {
      return FlashcardStudyState.SUSPENDED;
    }

    return FlashcardStudyState.NEW;
  }

  private sanitizeBlocks(
    blocks?: Array<{ type: FlashcardContentType; value: string }>,
  ): FlashcardContentBlock[] {
    if (!blocks) return [];

    return blocks
      .filter((block) => block && block.value)
      .map((block) => ({
        type: block.type,
        value: block.value.trim(),
      }))
      .filter((block) => block.value.length > 0);
  }

  private stripHtml(value: string): string {
    return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private toPlainText(content: FlashcardContentBlock[]): string {
    if (!content?.length) return null;

    const text = content
      .filter((block) => block.type !== FlashcardContentType.IMAGE)
      .map((block) => this.stripHtml(block.value))
      .filter((value) => value.length > 0)
      .join(' ')
      .trim();

    return text.length > 0 ? text : null;
  }

  private assertCardHasContent(
    frontContent: FlashcardContentBlock[],
    backContent: FlashcardContentBlock[],
  ) {
    if ((!frontContent || frontContent.length === 0) && (!backContent || backContent.length === 0)) {
      throw new BadRequestException(
        'A flashcard must contain at least one content block on front or back',
      );
    }
  }

  private assertAllowedBlockTypes(
    questionId: number | null | undefined,
    frontContent: FlashcardContentBlock[],
    backContent: FlashcardContentBlock[],
  ) {
    const hasQuestion = questionId !== null && questionId !== undefined;
    const allBlocks = [...(frontContent || []), ...(backContent || [])];

    for (const block of allBlocks) {
      if (block.type === FlashcardContentType.TABLE) {
        throw new BadRequestException('Table blocks are not supported');
      }

      if (block.type === FlashcardContentType.IMAGE && !hasQuestion) {
        throw new BadRequestException(
          'Image blocks are allowed only for flashcards linked to a question',
        );
      }
    }
  }

  private async getOwnedDeck(userId: number, id: number): Promise<FlashcardDeck> {
    const deck = await this.decksRepository.findOne({ where: { id, userId } });

    if (!deck) {
      throw new NotFoundException('Flashcard deck not found');
    }

    return deck;
  }

  private async getOwnedFlashcard(
    userId: number,
    id: number,
  ): Promise<Flashcard> {
    const flashcard = await this.flashcardsRepository.findOne({
      where: { id, userId },
      relations: ['deck'],
    });

    if (!flashcard) {
      throw new NotFoundException('Flashcard not found');
    }

    return flashcard;
  }

  private async updateDeckCardCount(deckId: number) {
    const count = await this.flashcardsRepository.count({ where: { deckId } });
    await this.decksRepository.update({ id: deckId }, { cardCount: count });
  }

  private async incrementTotalCardsCreated(userId: number) {
    await this.statsRepository
      .createQueryBuilder()
      .insert()
      .into(FlashcardStats)
      .values({
        userId,
        totalCardsCreated: 1,
      })
      .onConflict(
        '("userId") DO UPDATE SET "totalCardsCreated" = "flashcard_stats"."totalCardsCreated" + 1, "updatedAt" = now()',
      )
      .execute();
  }

  private async resolveDeckForCreation(
    userId: number,
    dto: CreateFlashcardDto,
  ): Promise<number> {
    if (dto.deckId) {
      const deck = await this.getOwnedDeck(userId, dto.deckId);
      return deck.id;
    }

    if (dto.createDeck?.name) {
      const createdDeck = await this.createDeck(userId, {
        name: dto.createDeck.name,
        description: dto.createDeck.description,
        isPublic: dto.createDeck.isPublic,
      });
      return createdDeck.id;
    }

    throw new BadRequestException(
      'Provide deckId or createDeck when creating a flashcard',
    );
  }
}
