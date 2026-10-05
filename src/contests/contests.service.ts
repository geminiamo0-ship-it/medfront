import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Contest, ContestStatus } from '../entities/contest.entity';
import { ContestParticipant, ParticipantStatus } from '../entities/contest-participant.entity';
import { ContestQuestion } from '../entities/contest-question.entity';
import { Question } from '../entities/question.entity';
import { QuestionOption } from '../entities/question-option.entity';
import { CreateContestDto, CreateContestQuestionDto, AddExistingQuestionDto, RegisterContestDto, SubmitContestAnswerDto } from './dto/contest.dto';
import { User, UserRole } from '../entities/user.entity';
import {
  bankTotalsCacheKey,
  questionAnswerCacheKey,
  questionExplanationCacheKey,
  staticQuestionContentCacheKey,
} from '../cache/cache-keys.util';
import { safeCacheDel } from '../cache/safe-cache.util';

@Injectable()
export class ContestsService {
  private readonly logger = new Logger(ContestsService.name);

  constructor(
    @InjectRepository(Contest)
    private contestRepo: Repository<Contest>,
    @InjectRepository(ContestParticipant)
    private participantRepo: Repository<ContestParticipant>,
    @InjectRepository(ContestQuestion)
    private contestQuestionRepo: Repository<ContestQuestion>,
    @InjectRepository(Question)
    private questionRepo: Repository<Question>,
    @InjectRepository(QuestionOption)
    private optionRepo: Repository<QuestionOption>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  // Audit follow-up: contests previously created questions without invalidating
  // any of the cached layers, leaving stale bank totals and stale explanation
  // cache for up to 1h–4h. Same shape as AdminQuestionsService.invalidateQuestionCaches.
  private async invalidateCachesForQuestion(questionId: number): Promise<void> {
    // safeCacheDel swallows Redis errors so a transient cache outage doesn't
    // make contest-question creation fail.
    const tasks: Promise<unknown>[] = [
      safeCacheDel(this.cacheManager, staticQuestionContentCacheKey(questionId)),
      safeCacheDel(this.cacheManager, questionAnswerCacheKey(questionId)),
      safeCacheDel(this.cacheManager, questionExplanationCacheKey(questionId)),
      safeCacheDel(this.cacheManager, bankTotalsCacheKey()),
    ];
    for (const step of [1, 2, 3, 4, 5]) {
      tasks.push(safeCacheDel(this.cacheManager, bankTotalsCacheKey(step)));
    }
    await Promise.all(tasks);
  }

  private async syncContestMetadata(contestId: number) {
    const contest = await this.contestRepo.findOneBy({ id: contestId });
    if (!contest) return;

    // Sync Question Count
    const count = await this.contestQuestionRepo.countBy({ contestId });
    
    // Sync Duration (if dates exist)
    let duration = contest.durationMinutes;
    if (contest.startTime && contest.endTime) {
      const start = new Date(contest.startTime).getTime();
      const end = new Date(contest.endTime).getTime();
      if (!isNaN(start) && !isNaN(end) && end > start) {
        duration = Math.floor((end - start) / 60000);
      }
    }

    await this.contestRepo.update(contestId, {
      totalQuestions: count,
      durationMinutes: duration
    });
  }

  // ADMIN METHODS
  async createContest(createDto: CreateContestDto) {
    const contest = this.contestRepo.create({
      ...createDto,
      status: ContestStatus.DRAFT,
    });
    const saved = await this.contestRepo.save(contest);
    await this.syncContestMetadata(saved.id);
    return saved;
  }

  async updateContest(id: number, updateDto: Partial<CreateContestDto>) {
    const contest = await this.contestRepo.findOneBy({ id });
    if (!contest) throw new NotFoundException('Contest not found');
    Object.assign(contest, updateDto);
    const saved = await this.contestRepo.save(contest);
    await this.syncContestMetadata(saved.id);
    return saved;
  }

  async getAllContests() {
    return this.contestRepo.find({
      order: { startTime: 'DESC' },
    });
  }

  async addExistingQuestion(contestId: number, addDto: AddExistingQuestionDto) {
    const contest = await this.contestRepo.findOneBy({ id: contestId });
    if (!contest) throw new NotFoundException('Contest not found');

    const question = await this.questionRepo.findOneBy({ id: addDto.questionId });
    if (!question) throw new NotFoundException('Question not found');

    const contestQuestion = this.contestQuestionRepo.create({
      contestId,
      questionId: addDto.questionId,
      displayOrder: addDto.displayOrder,
      points: addDto.points || 1,
    });

    const saved = await this.contestQuestionRepo.save(contestQuestion);
    await this.syncContestMetadata(contestId);
    return saved;
  }

  async createAndAddQuestion(contestId: number, createDto: CreateContestQuestionDto) {
    const contest = await this.contestRepo.findOneBy({ id: contestId });
    if (!contest) throw new NotFoundException('Contest not found');

    // 1. Create the base question
    const question = this.questionRepo.create({
      textHtml: createDto.textHtml,
      explanationHtml: createDto.explanationHtml,
      subjectId: createDto.subjectId,
      systemId: createDto.systemId,
      topicId: createDto.topicId,
      difficulty: createDto.difficulty,
      step: createDto.step,
      source: 'contest_created',
      questionBankId: 1, // Default for now
    });

    const savedQuestion = await this.questionRepo.save(question);

    // 2. Create options
    const options = createDto.options.map((opt) =>
      this.optionRepo.create({
        ...opt,
        questionId: savedQuestion.id,
      }),
    );
    await this.optionRepo.save(options);

    // 3. Link to contest
    const contestQuestion = this.contestQuestionRepo.create({
      contestId,
      questionId: savedQuestion.id,
      displayOrder: createDto.displayOrder,
      points: createDto.points || 1,
    });

    const saved = await this.contestQuestionRepo.save(contestQuestion);
    await this.syncContestMetadata(contestId);

    // Audit fix: contest questions are stored in the same `questions` table as
    // regular questions, so they affect bank totals and can have their
    // explanation/answer cached. Invalidate to match AdminQuestionsService.
    await this.invalidateCachesForQuestion(savedQuestion.id);

    return saved;
  }

  async getAdminContestQuestions(contestId: number) {
    return this.contestQuestionRepo.find({
      where: { contestId },
      relations: ['question', 'question.options'],
      order: { displayOrder: 'ASC' },
    });
  }

  async removeQuestion(contestId: number, questionId: number) {
    const result = await this.contestQuestionRepo.delete({ contestId, questionId });
    if (result.affected === 0) {
      throw new NotFoundException('Question not found in this contest');
    }

    // Update total questions count (handled by helper)
    await this.syncContestMetadata(contestId);

    return { success: true };
  }

  async searchQuestions(query: string, subjectId?: number) {
    const qb = this.questionRepo.createQueryBuilder('question')
      .leftJoinAndSelect('question.options', 'options')
      .where('question.isActive = :isActive', { isActive: true });

    if (query) {
      qb.andWhere('question.textHtml ILIKE :query', { query: `%${query}%` });
    }

    if (subjectId) {
      qb.andWhere('question.subjectId = :subjectId', { subjectId });
    }

    return qb.limit(50).getMany();
  }

  // USER METHODS
  async getActiveContests() {
    const now = new Date();
    
    const contests = await this.contestRepo.find({
      where: {
        isActive: true,
        status: ContestStatus.REGISTRATION_OPEN,
      },
      order: { startTime: 'ASC' },
    });

    // Filter out contests that have already ended
    return contests.filter(contest => new Date(contest.endTime) > now);
  }

  async getPastContests() {
    return this.contestRepo.find({
      where: {
        status: ContestStatus.COMPLETED,
      },
      order: { startTime: 'DESC' },
    });
  }

  async getContest(id: number) {
    return this.contestRepo.findOneBy({ id });
  }

  async register(userId: number, contestId: number) {
    const contest = await this.contestRepo.findOneBy({ id: contestId });
    if (!contest) throw new NotFoundException('Contest not found');

    const now = new Date();
    if (now > contest.registrationDeadline) {
      throw new BadRequestException('Registration deadline has passed');
    }

    if (contest.maxParticipants && contest.currentParticipants >= contest.maxParticipants) {
      throw new BadRequestException('Contest is full');
    }

    const existing = await this.participantRepo.findOneBy({ userId, contestId });
    if (existing) throw new BadRequestException('Already registered');

    const participant = this.participantRepo.create({
      userId,
      contestId,
      registeredAt: now,
      status: ParticipantStatus.REGISTERED,
    });

    await this.participantRepo.save(participant);
    
    // Update participant count
    await this.contestRepo.update(contestId, {
      currentParticipants: contest.currentParticipants + 1,
    });

    return { success: true };
  }

  async unregister(userId: number, contestId: number) {
    const contest = await this.contestRepo.findOneBy({ id: contestId });
    if (!contest) throw new NotFoundException('Contest not found');

    const participant = await this.participantRepo.findOneBy({ userId, contestId });
    if (!participant) throw new BadRequestException('Not registered');

    const now = new Date();
    if (now > contest.startTime) {
      throw new BadRequestException('Cannot unregister after contest has started');
    }

    await this.participantRepo.remove(participant);

    // Update participant count
    await this.contestRepo.update(contestId, {
      currentParticipants: Math.max(0, contest.currentParticipants - 1),
    });

    return { success: true };
  }

  async getParticipationStatus(userId: number, contestId: number) {
    return this.participantRepo.findOneBy({ userId, contestId });
  }

  async getContestQuestions(contestId: number, userId: number) {
    const participant = await this.participantRepo.findOneBy({ userId, contestId });
    if (!participant) throw new ForbiddenException('Not registered for this contest');

    if (participant.status === ParticipantStatus.COMPLETED) {
      throw new ForbiddenException('You have already submitted your answers for this contest');
    }

    const contest = await this.contestRepo.findOneBy({ id: contestId });
    const now = new Date();

    if (now < contest.startTime) {
      throw new BadRequestException('Contest has not started yet');
    }

    if (now > contest.endTime) {
        throw new BadRequestException('Contest has ended');
    }

    // Update status to IN_PROGRESS if first time
    if (participant.status === ParticipantStatus.REGISTERED) {
      participant.status = ParticipantStatus.IN_PROGRESS;
      participant.startedAt = now;
      await this.participantRepo.save(participant);
    }

    const questions = await this.contestQuestionRepo.find({
      where: { contestId },
      relations: ['question', 'question.options'],
      order: { displayOrder: 'ASC' },
    });

    return {
      questions,
      participant: {
        answers: participant.answers || {},
        status: participant.status,
        startedAt: participant.startedAt,
      }
    };
  }

  async submitAnswer(userId: number, contestId: number, questionId: number, selectedOptionId: number, timeSpentSeconds?: number) {
    const participant = await this.participantRepo.findOneBy({ userId, contestId });
    if (!participant) throw new ForbiddenException('Not registered for this contest');
    
    // Check if contest is still active
    const contest = await this.contestRepo.findOneBy({ id: contestId });
    const now = new Date();
    if (now > contest.endTime) {
      throw new BadRequestException('Contest has ended');
    }

    // Track answer sequence and total changes without querying the DB
    const previousFinalAnswer = participant.answers?.[questionId];
    if (previousFinalAnswer && Number(previousFinalAnswer) !== Number(selectedOptionId)) {
        participant.totalAnswerChanges = (Number(participant.totalAnswerChanges) || 0) + 1;
    }

    if (!participant.answerSequences) participant.answerSequences = {};
    if (!participant.answerSequences[questionId]) {
        participant.answerSequences[questionId] = [];
    }
    
    // Only push if different from last choice in sequence to avoid duplicates
    const sequence = participant.answerSequences[questionId];
    if (sequence.length === 0 || sequence[sequence.length - 1] !== selectedOptionId) {
        sequence.push(selectedOptionId);
    }

    // Update final answers JSON
    if (!participant.answers) participant.answers = {};
    participant.answers[questionId] = selectedOptionId;
    
    if (!participant.submissionTimes) participant.submissionTimes = {};
    participant.submissionTimes[questionId] = now.toISOString();

    // Increment activity markers
    participant.lastActivityAt = now;
    if (timeSpentSeconds) {
       participant.timeSpentSeconds = (Number(participant.timeSpentSeconds) || 0) + Number(timeSpentSeconds);
    }
    
    return this.participantRepo.save(participant);
}

  async completeContest(userId: number, contestId: number) {
    const participant = await this.participantRepo.findOneBy({ userId, contestId });
    if (!participant) throw new ForbiddenException('Not registered for this contest');

    if (participant.status !== ParticipantStatus.IN_PROGRESS) {
      throw new BadRequestException('Contest is not in progress or already completed');
    }

    participant.status = ParticipantStatus.COMPLETED;
    participant.completedAt = new Date();
    
    return this.participantRepo.save(participant);
  }

  async getContestStandings(contestId: number, page: number = 1, limit: number = 50) {
    const contest = await this.contestRepo.findOneBy({ id: contestId });
    if (!contest) throw new NotFoundException('Contest not found');

    const [participants, total] = await this.participantRepo.findAndCount({
      where: { contestId },
      relations: ['user'],
      order: contest.resultsCalculated 
        ? { rank: 'ASC', totalScore: 'DESC', timeSpentSeconds: 'ASC' }
        : { registeredAt: 'ASC' }, // Before calculation, show by registration order
      skip: (page - 1) * limit,
      take: limit,
    });

    const contestQuestions = await this.contestQuestionRepo.find({
      where: { contestId },
      order: { displayOrder: 'ASC' },
    });

    // Map correct answers
    const correctMap = new Map<number, number>();
    if (contest.resultsCalculated) {
      const qFull = await this.contestQuestionRepo.find({
        where: { contestId },
        relations: ['question', 'question.options']
      });
      qFull.forEach(cq => {
        const corr = cq.question.options.find(o => o.isCorrect);
        if (corr) correctMap.set(cq.questionId, corr.id);
      });
    }

    return {
      contest: {
        title: contest.title,
        resultsCalculated: contest.resultsCalculated,
        startTime: contest.startTime,
        endTime: contest.endTime,
        durationMinutes: contest.durationMinutes,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      questions: contestQuestions.map((cq, idx) => ({
        id: cq.id,
        questionId: cq.questionId,
        label: `${idx + 1}`,
      })),
      standings: participants.map(p => {
        const isCalculated = contest.resultsCalculated;
        const detailAnswers: Record<number, any> = {};
        let earnedPoints = 0;
        let penaltyPoints = 0;

        if (isCalculated) {
          const userAnswers = p.answers || {};
          const times = p.submissionTimes || {};
          const pointsMap = p.pointsEarnedByQuestion || {};

          contestQuestions.forEach(cq => {
            const qId = cq.questionId;
            const selectedId = userAnswers[qId] || userAnswers[qId.toString()];
            if (selectedId) {
              const isCorr = (selectedId == correctMap.get(qId));
              let pts = pointsMap[qId] || pointsMap[qId.toString()] || 0;

              if (pts === 0) {
                if (isCorr) {
                  pts = contest.scoring?.correctAnswerPoints || 5;
                } else {
                  pts = -(contest.scoring?.wrongAnswerPenalty || 0);
                }
              }

              if (pts > 0) earnedPoints += pts;
              if (pts < 0) penaltyPoints += Math.abs(pts);

              detailAnswers[qId] = {
                selectedId,
                submittedAt: times[qId] || times[qId.toString()],
                points: pts,
                isCorrect: isCorr,
              };
            }
          });
        }

        return {
          id: p.id,
          rank: isCalculated ? p.rank : null,
          totalScore: isCalculated ? p.totalScore : 0,
          earnedPoints: isCalculated ? Number(earnedPoints.toFixed(1)) : 0,
          penaltyPoints: isCalculated ? Number(penaltyPoints.toFixed(1)) : 0,
          correctAnswers: isCalculated ? p.correctAnswers : 0,
          wrongAnswers: isCalculated ? p.wrongAnswers : 0,
          ratingBefore: Number(p.oldRating || 0),
          ratingDelta: isCalculated ? Number(p.ratingChange || 0) : 0,
          timeSpentSeconds: isCalculated ? p.timeSpentSeconds : 0,
          status: p.status,
          user: {
            id: p.user.id,
            name: p.user.name,
            country: p.user.country,
          },
          answers: detailAnswers // Empty if not calculated
        };
      })
    };
  }

  async calculateContestResults(contestId: number) {
    const contest = await this.contestRepo.findOneBy({ id: contestId });

    if (!contest) throw new NotFoundException('Contest not found');
    if (new Date() < contest.endTime) {
      throw new BadRequestException('Cannot calculate results before contest ends');
    }
    if (contest.resultsCalculated) {
      throw new BadRequestException('Results already calculated for this contest');
    }

    // 1. Get all questions and correct options
    const contestQuestions = await this.contestQuestionRepo.find({
      where: { contestId },
      relations: ['question', 'question.options'],
    });

    const correctAnswersMap = new Map<number, number>();
    contestQuestions.forEach(cq => {
      const correctOpt = cq.question.options.find(o => o.isCorrect);
      if (correctOpt) correctAnswersMap.set(cq.questionId, correctOpt.id);
    });

    // 2. Get all participants
    const participants = await this.participantRepo.find({
      where: { contestId },
      relations: ['user'],
    });

    const startTime = new Date(contest.startTime).getTime();
    const durationMs = (contest.durationMinutes || 60) * 60 * 1000;

    // 3. Process each participant
    for (const p of participants) {
      let totalScore = 0;
      let correct = 0;
      let wrong = 0;
      let unanswered = 0;
      let timeSpent = 0;
      const pointsByQ: Record<number, number> = {};

      const userAnswers = p.answers || {};
      const subTimes = p.submissionTimes || {};

      contestQuestions.forEach(cq => {
        const qId = cq.questionId;
        const selectedId = userAnswers[qId] || userAnswers[qId.toString()];

        if (!selectedId) {
          unanswered++;
          const penalty = (contest.scoring?.noAnswerPenalty || 0);
          totalScore -= penalty;
          pointsByQ[qId] = -penalty;
        } else if (selectedId == correctAnswersMap.get(qId)) {
          correct++;
          
          // SPEED BONUS (Codeforces Style)
          const subTimeStr = subTimes[qId] || subTimes[qId.toString()];
          const subTime = subTimeStr ? new Date(subTimeStr).getTime() : 0;
          let qScore = (contest.scoring?.correctAnswerPoints || 1);
          
          if (subTime && !isNaN(subTime) && subTime > startTime && (contest.scoring?.speedBonusMultiplier || 1) > 1 && durationMs > 0) {
             const timePassedMs = subTime - startTime;
             const timeRatio = Math.min(1, timePassedMs / durationMs);
             const maxBonus = (contest.scoring.correctAnswerPoints * (contest.scoring.speedBonusMultiplier - 1));
             const currentBonus = maxBonus * (1 - timeRatio);
             if (!isNaN(currentBonus)) qScore += currentBonus;
          }
          
          totalScore += qScore;
          pointsByQ[qId] = Number(qScore.toFixed(2));
        } else {
          wrong++;
          const penalty = (contest.scoring?.wrongAnswerPenalty || 0);
          totalScore -= penalty;
          pointsByQ[qId] = -penalty;
        }
      });

      // 3. Behavioral Analysis (Sequence-based)
      let rtwCount = 0;
      let sequenceChanges = 0;

      if (p.answerSequences) {
          Object.keys(p.answerSequences).forEach(qIdStr => {
              const qId = parseInt(qIdStr);
              const sequence = p.answerSequences[qId] || [];
              const correctOptId = correctAnswersMap.get(qId);

              if (sequence.length > 1) {
                  sequenceChanges += (sequence.length - 1);
                  if (correctOptId) {
                      for (let i = 0; i < sequence.length - 1; i++) {
                          const currentInSeq = Number(sequence[i]);
                          const nextInSeq = Number(sequence[i + 1]);
                          // Transition: Correct -> Incorrect
                          if (currentInSeq === correctOptId && nextInSeq !== correctOptId) {
                              rtwCount++;
                          }
                      }
                  }
              }
          });
      }

      p.totalScore = isNaN(totalScore) ? 0 : Number(totalScore.toFixed(2));
      p.correctAnswers = correct;
      p.wrongAnswers = wrong;
      p.unansweredQuestions = unanswered;
      p.pointsEarnedByQuestion = pointsByQ;
      p.accuracyPercentage = (correct / (contestQuestions.length || 1)) * 100;
      p.rightToWrongChanges = rtwCount;
      p.totalAnswerChanges = sequenceChanges;
      
      // If they never finished, set to timed out
      if (p.status === ParticipantStatus.IN_PROGRESS || p.status === ParticipantStatus.REGISTERED) {
        p.status = ParticipantStatus.TIMED_OUT;
        p.completedAt = contest.endTime;
      }

      // BEHAVIORAL ANALYTICS: Set personality patterns
      if (!p.behaviorSummary) p.behaviorSummary = {};
      
      if (sequenceChanges > (contestQuestions.length * 0.5)) {
          p.behaviorSummary.hesitationPattern = true;
      }
      
      if (rtwCount > 0) {
          p.behaviorSummary.selfDoubtPattern = true;
      }

      if (p.accuracyPercentage > 85 && sequenceChanges < (contestQuestions.length * 0.1)) {
          p.behaviorSummary.consistentPace = true; // High accuracy + low changes = high confidence
      }
    }

    // 4. Sort and assign ranks
    participants.sort((a, b) => {
      const scoreA = a.totalScore || 0;
      const scoreB = b.totalScore || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (a.timeSpentSeconds || 0) - (b.timeSpentSeconds || 0);
    });

    participants.forEach((p, index) => {
      p.rank = index + 1;
      p.percentile = Math.round(((participants.length - p.rank) / (participants.length || 1)) * 100);
    });

    // 6. Calculate Codeforces Ratings
    const allPreRatings = participants.map(p => Number(p.user?.rating || 1200));
    const participantRatingResults = participants.map(p => {
        const oldRating = Number(p.user?.rating || 1200);
        const actualRank = Number(p.rank || 1);

        if (participants.length < 2) {
           return { p, oldRating, newRating: oldRating + 10 }; // Small boost for solo participation
        }

        // Codeforces Math helpers
        const getProb = (ra: number, rb: number) => 1 / (1 + Math.pow(10, (Number(rb) - Number(ra)) / 400));
        const getSeed = (r: number, others: number[]) => 1 + others.reduce((sum, rj) => sum + getProb(Number(rj), Number(r)), 0);
        
        const others = allPreRatings.filter((_, idx) => idx !== participants.indexOf(p));
        const seedValue = getSeed(oldRating, others);
        
        // Geometric Mean Rank
        const m = Math.sqrt(Number(seedValue) * Number(actualRank));
        
        // Binary search for R_perf such that Seed(R_perf) = m
        let low = 1, high = 6000;
        for (let iter = 0; iter < 50; iter++) {
            const mid = (low + high) / 2;
            const seedAtMid = getSeed(mid, others);
            if (seedAtMid < m) {
                high = mid;
            } else {
                low = mid;
            }
        }
        const rPerf = low;
        
        // Rating update formula (move halfway toward performance)
        let ratingChange = Math.round((rPerf - oldRating) / 2);

        // Provisional Boost (first 6 contests)
        if ((p.user?.contestsParticipated || 0) < 6) {
           ratingChange = Math.round(ratingChange * 2);
        }

        const calculatedNew = oldRating + ratingChange;
        const newRating = isNaN(calculatedNew) ? oldRating : Math.max(0, Math.round(calculatedNew));

        return { p, oldRating, newRating };
    });

    // 7. Update Participants and Users
    for (const res of participantRatingResults) {
        const { p, oldRating, newRating } = res;
        
        p.oldRating = oldRating;
        p.ratingChange = newRating - oldRating;
        
        p.user.rating = newRating;
        p.user.updateRatingTier();
        p.user.updateMaxRating();
        p.user.contestsParticipated = (Number(p.user.contestsParticipated) || 0) + 1;
        
        await this.userRepo.save(p.user);
    }

    await this.participantRepo.save(participants);

    // 8. Mark contest as finalized
    contest.resultsCalculated = true;
    contest.status = ContestStatus.COMPLETED;
    await this.contestRepo.save(contest);

    return { 
      success: true, 
      participantsProcessed: participants.length 
    };
  }
}
