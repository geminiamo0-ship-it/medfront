import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from '../../entities/question.entity';
import { QuestionSubmission } from '../../entities/question-submission.entity';
import { SubscriptionService } from '../../subscriptions/subscription.service';
import { User } from '../../entities/user.entity';
import { Test } from '../../entities/test.entity';
import { SecurityPolicyService } from '../../security/security-policy.service';

type SearchMode = 'questionId' | 'uworldId' | 'text';

@Injectable()
export class QuestionSearchService {
  constructor(
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
    @InjectRepository(QuestionSubmission)
    private readonly submissionRepository: Repository<QuestionSubmission>,
    private readonly subscriptionService: SubscriptionService,
    private readonly securityPolicyService: SecurityPolicyService,
  ) {}

  async search(user: User, mode: string, rawValue: string) {
    const searchMode = this.parseMode(mode);
    const searchValue = String(rawValue || '').trim();

    if (!searchValue) {
      throw new BadRequestException('A search value is required.');
    }

    const query = this.questionRepository
      .createQueryBuilder('question')
      .leftJoinAndSelect('question.subject', 'subject')
      .leftJoinAndSelect('question.system', 'system')
      .leftJoinAndSelect('question.topic', 'topic')
      .leftJoinAndSelect('question.questionBank', 'questionBank')
      .where('question.isActive = :isActive', { isActive: true });

    if (searchMode === 'questionId') {
      const questionId = this.parsePositiveInteger(searchValue, 'Question ID');
      query.andWhere('question.id = :questionId', { questionId });
    } else if (searchMode === 'uworldId') {
      query.andWhere('question.externalId = :externalId', { externalId: searchValue });
    } else {
      query
        .innerJoin(
          QuestionSubmission,
          'submission',
          'submission.questionId = question.id AND submission.userId = :userId AND submission.testId IS NOT NULL',
          { userId: user.id },
        )
        .andWhere('question.textHtml ILIKE :searchValue', {
          searchValue: `%${searchValue}%`,
        })
        .distinctOn(['question.id']);
    }

    const questions = await query
      .orderBy(searchMode === 'text' ? 'question.id' : 'question.step', 'ASC')
      .addOrderBy(searchMode === 'text' ? 'question.step' : 'question.id', 'ASC')
      .getMany();

    const questionIds = questions.map((question) => Number(question.id));
    const usageMap = new Map<
      number,
      {
        isUsed: boolean;
        lastSubmittedAt: Date | null;
        lastTest: {
          id: number;
          title: string;
          status: string;
          step: number;
          startedAt: Date | null;
          completedAt: Date | null;
        } | null;
      }
    >();

    if (questionIds.length) {
      const submissions = await this.submissionRepository
        .createQueryBuilder('submission')
        .select('submission.questionId', 'questionId')
        .addSelect('submission.testId', 'testId')
        .addSelect('submission.submittedAt', 'submittedAt')
        .addSelect('test.title', 'testTitle')
        .addSelect('test.status', 'testStatus')
        .addSelect('test.step', 'testStep')
        .addSelect('test.startedAt', 'testStartedAt')
        .addSelect('test.completedAt', 'testCompletedAt')
        .leftJoin(Test, 'test', 'test.id = submission.testId')
        .where('submission.userId = :userId', { userId: user.id })
        .andWhere('submission.questionId IN (:...questionIds)', { questionIds })
        .andWhere('submission.testId IS NOT NULL')
        .orderBy('submission.submittedAt', 'DESC')
        .getRawMany();

      submissions.forEach((row) => {
        const questionId = Number(row.questionId);
        if (usageMap.has(questionId)) return;
        usageMap.set(questionId, {
          isUsed: true,
          lastSubmittedAt: row.submittedAt || null,
          lastTest: row.testId
            ? {
                id: Number(row.testId),
                title: row.testTitle || `Test #${row.testId}`,
                status: row.testStatus,
                step: Number(row.testStep),
                startedAt: row.testStartedAt || null,
                completedAt: row.testCompletedAt || null,
              }
            : null,
        });
      });
    }

    const policy = await this.securityPolicyService.getConfig();
    const limitedQuestions = questions.slice(0, policy.testSearchResultLimit);

    const results = await Promise.all(limitedQuestions.map(async (question) => {
      const bankAccess = this.subscriptionService.evaluateQuestionBankAccess(user, question.questionBank);
      const stepAccess = await this.subscriptionService.hasAccessToStep(user, question.step);
      const hasAccess = bankAccess.hasAccess && stepAccess.hasAccess;
      const denialReason = !stepAccess.hasAccess ? stepAccess.reason : bankAccess.reason;
      const usage = usageMap.get(Number(question.id)) || { isUsed: false, lastSubmittedAt: null, lastTest: null };

      return {
        id: Number(question.id),
        externalId: question.externalId ? String(question.externalId) : null,
        step: Number(question.step),
        source: question.source,
        estimatedTimeSeconds: Number(question.estimatedTimeSeconds),
        difficulty: question.difficulty,
        textHtml: hasAccess ? this.buildPreviewHtml(question.textHtml) : null,
        subject: question.subject
          ? { id: Number(question.subject.id), name: question.subject.name }
          : null,
        system: question.system
          ? { id: Number(question.system.id), name: question.system.name }
          : null,
        topic: question.topic
          ? { id: Number(question.topic.id), name: question.topic.name }
          : null,
        questionBank: question.questionBank
          ? {
              id: Number(question.questionBank.id),
              name: question.questionBank.name,
              code: question.questionBank.code,
              isPremium: Boolean(question.questionBank.isPremium),
            }
          : null,
        access: {
          hasAccess,
          isRestricted: !hasAccess,
          requiresUpgrade: !hasAccess,
          reason: hasAccess ? 'Question preview available.' : denialReason,
        },
        usage: {
          isUsed: usage.isUsed,
          lastSubmittedAt: usage.lastSubmittedAt,
          lastTest: usage.lastTest,
        },
      };
    }));

    return {
      query: {
        mode: searchMode,
        value: searchValue,
      },
      total: results.length,
      totalBeforeLimit: questions.length,
      results,
    };
  }

  private buildPreviewHtml(html: string | null | undefined) {
    if (!html) return html ?? null;
    const stripped = String(html).replace(/\s+/g, ' ').trim();
    if (stripped.length <= 650) {
      return html;
    }
    return `${stripped.slice(0, 650)}...`;
  }

  private parseMode(mode: string): SearchMode {
    if (mode === 'questionId' || mode === 'uworldId' || mode === 'text') {
      return mode;
    }

    throw new BadRequestException('Search mode must be either "questionId", "uworldId", or "text".');
  }

  private parsePositiveInteger(value: string, label: string): number {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException(`${label} must be a positive integer.`);
    }

    return parsed;
  }

  async getPracticeQuestion(user: User, questionId: number) {
    const question = await this.questionRepository.findOne({
      where: { id: questionId, isActive: true },
      relations: ['options', 'questionBank', 'subject', 'system', 'topic'],
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const bankAccess = this.subscriptionService.evaluateQuestionBankAccess(user, question.questionBank);
    const stepAccess = await this.subscriptionService.hasAccessToStep(user, question.step);
    const hasAccess = bankAccess.hasAccess && stepAccess.hasAccess;
    const denialReason = !stepAccess.hasAccess ? stepAccess.reason : bankAccess.reason;

    if (!hasAccess) {
      throw new ForbiddenException(denialReason || 'Access denied. Please upgrade your plan.');
    }

    const sortedOptions = [...(question.options || [])].sort((a: any, b: any) => {
      return String(a.displayOrder || '').localeCompare(String(b.displayOrder || ''));
    });

    return {
      id: Number(question.id),
      textHtml: question.textHtml,
      step: Number(question.step),
      subject: question.subject
        ? { id: Number(question.subject.id), name: question.subject.name }
        : null,
      system: question.system
        ? { id: Number(question.system.id), name: question.system.name }
        : null,
      topic: question.topic
        ? { id: Number(question.topic.id), name: question.topic.name }
        : null,
      questionBank: question.questionBank
        ? {
            id: Number(question.questionBank.id),
            name: question.questionBank.name,
            code: question.questionBank.code,
          }
        : null,
      options: sortedOptions.map((option: any) => ({
        id: Number(option.id),
        displayOrder: option.displayOrder,
        textHtml: option.textHtml,
      })),
    };
  }

  async submitPracticeAnswer(user: User, questionId: number, selectedOptionId: number) {
    // NOTE: Quick practice does NOT persist submissions. This is a stateless correctness check.
    const question = await this.questionRepository.findOne({
      where: { id: questionId, isActive: true },
      relations: ['options', 'questionBank'],
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const bankAccess = this.subscriptionService.evaluateQuestionBankAccess(user, question.questionBank);
    const stepAccess = await this.subscriptionService.hasAccessToStep(user, question.step);
    const hasAccess = bankAccess.hasAccess && stepAccess.hasAccess;
    const denialReason = !stepAccess.hasAccess ? stepAccess.reason : bankAccess.reason;

    if (!hasAccess) {
      throw new ForbiddenException(denialReason || 'Access denied. Please upgrade your plan.');
    }

    const selectedOption = question.options?.find((option: any) => Number(option.id) === selectedOptionId);
    if (!selectedOption) {
      throw new BadRequestException('Selected option does not belong to this question');
    }

    const correctOption = question.options?.find((option: any) => option?.isCorrect);
    const correctOptionId = correctOption ? Number(correctOption.id) : null;

    return {
      isCorrect: correctOptionId ? Number(selectedOptionId) === correctOptionId : false,
      correctOptionId,
    };
  }
}
