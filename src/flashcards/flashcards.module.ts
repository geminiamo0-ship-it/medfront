import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { Flashcard } from '../entities/flashcard.entity';
import { FlashcardDeck } from '../entities/flashcard-deck.entity';
import { FlashcardStats } from '../entities/flashcard-stats.entity';
import { FlashcardReview } from '../entities/flashcard-review.entity';
import { Question } from '../entities/question.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Flashcard,
      FlashcardDeck,
      FlashcardStats,
      FlashcardReview,
      Question,
    ]),
  ],
  controllers: [FlashcardsController],
  providers: [FlashcardsService],
  exports: [FlashcardsService],
})
export class FlashcardsModule {}
