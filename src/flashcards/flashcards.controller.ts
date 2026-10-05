import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FlashcardsService } from './flashcards.service';
import {
  AppendFlashcardContentDto,
  CreateFlashcardDeckDto,
  CreateFlashcardDto,
  FlashcardDeckQueryDto,
  RescheduleFlashcardDto,
  FlashcardStudyDeckQueryDto,
  FlashcardQueryDto,
  RateStudyCardDto,
  StudyCardActionDto,
  UpdateFlashcardDeckDto,
  UpdateFlashcardDto,
} from './dto/flashcards.dto';

@ApiTags('Flashcards')
@Controller('flashcards')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Get('decks')
  @ApiOperation({ summary: 'Get all decks for the current user with optional filters' })
  async getDecks(@Request() req, @Query() query: FlashcardDeckQueryDto) {
    return this.flashcardsService.getDecks(req.user.id, query);
  }

  @Post('decks')
  @ApiOperation({ summary: 'Create a deck' })
  async createDeck(@Request() req, @Body() dto: CreateFlashcardDeckDto) {
    return this.flashcardsService.createDeck(req.user.id, dto);
  }

  @Put('decks/:id')
  @ApiOperation({ summary: 'Update a deck' })
  async updateDeck(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFlashcardDeckDto,
  ) {
    return this.flashcardsService.updateDeck(req.user.id, id, dto);
  }

  @Delete('decks/:id')
  @ApiOperation({ summary: 'Delete a deck' })
  async deleteDeck(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.flashcardsService.deleteDeck(req.user.id, id);
  }

  @Get('decks/:id/export/apkg')
  @ApiOperation({ summary: 'Export a deck as Anki .apkg' })
  async exportDeckApkg(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const result = await this.flashcardsService.exportDeckApkg(req.user.id, id);
    res.setHeader('Content-Type', 'application/apkg');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );
    res.send(result.buffer);
  }

  @Get('study/decks')
  @ApiOperation({
    summary:
      'Get study deck list with spaced-repetition counters (new, learning, to-review, last-used)',
  })
  async getStudyDecks(@Request() req, @Query() query: FlashcardStudyDeckQueryDto) {
    return this.flashcardsService.getStudyDecks(req.user.id, query);
  }

  @Get('study/decks/:deckId/session')
  @ApiOperation({ summary: 'Start or resume a study session for a specific deck' })
  async getStudySession(
    @Request() req,
    @Param('deckId', ParseIntPipe) deckId: number,
  ) {
    return this.flashcardsService.getStudySession(req.user.id, deckId);
  }

  @Post('study/decks/:deckId/rate')
  @ApiOperation({ summary: 'Rate current study card and schedule next review interval' })
  async rateStudyCard(
    @Request() req,
    @Param('deckId', ParseIntPipe) deckId: number,
    @Body() dto: RateStudyCardDto,
  ) {
    return this.flashcardsService.rateStudyCard(req.user.id, deckId, dto);
  }

  @Post('study/decks/:deckId/bury')
  @ApiOperation({ summary: 'Bury card for current study session (until next day)' })
  async buryStudyCard(
    @Request() req,
    @Param('deckId', ParseIntPipe) deckId: number,
    @Body() dto: StudyCardActionDto,
  ) {
    return this.flashcardsService.buryStudyCard(req.user.id, deckId, dto.cardId);
  }

  @Post('study/decks/:deckId/suspend')
  @ApiOperation({ summary: 'Suspend card from current and future study sessions' })
  async suspendStudyCard(
    @Request() req,
    @Param('deckId', ParseIntPipe) deckId: number,
    @Body() dto: StudyCardActionDto,
  ) {
    return this.flashcardsService.suspendStudyCard(req.user.id, deckId, dto.cardId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all flashcards with search and filters' })
  async getFlashcards(@Request() req, @Query() query: FlashcardQueryDto) {
    return this.flashcardsService.getFlashcards(req.user.id, query);
  }

  @Get('question/:questionId')
  @ApiOperation({ summary: 'Get flashcards linked to a specific question' })
  async getQuestionFlashcards(
    @Request() req,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Query('search') search?: string,
  ) {
    return this.flashcardsService.getQuestionFlashcards(req.user.id, questionId, search);
  }

  @Get(':id/study/state')
  @ApiOperation({ summary: 'Get current study state for a flashcard' })
  async getFlashcardStudyState(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.flashcardsService.getFlashcardStudyState(req.user.id, id);
  }

  @Get(':id/question-preview')
  @ApiOperation({ summary: 'Get linked question preview for a flashcard (read-only)' })
  async getQuestionPreviewForCard(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.flashcardsService.getQuestionPreviewForCard(req.user.id, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single flashcard by id' })
  async getFlashcardById(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.flashcardsService.getFlashcardById(req.user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a flashcard' })
  async createFlashcard(@Request() req, @Body() dto: CreateFlashcardDto) {
    return this.flashcardsService.createFlashcard(req.user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a flashcard (includes moving to another deck)' })
  async updateFlashcard(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFlashcardDto,
  ) {
    return this.flashcardsService.updateFlashcard(req.user.id, id, dto);
  }

  @Post(':id/append-content')
  @ApiOperation({ summary: 'Append one content block to front or back of an existing flashcard' })
  async appendContent(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AppendFlashcardContentDto,
  ) {
    return this.flashcardsService.appendContent(req.user.id, id, dto);
  }

  @Post(':id/study/unsuspend')
  @ApiOperation({ summary: 'Unsuspend flashcard for study sessions' })
  async unsuspendFlashcard(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.flashcardsService.unsuspendFlashcard(req.user.id, id);
  }

  @Post(':id/study/reschedule')
  @ApiOperation({ summary: 'Reschedule flashcard into new queue or review queue' })
  async rescheduleFlashcard(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RescheduleFlashcardDto,
  ) {
    return this.flashcardsService.rescheduleFlashcard(req.user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a flashcard' })
  async deleteFlashcard(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.flashcardsService.deleteFlashcard(req.user.id, id);
  }
}
