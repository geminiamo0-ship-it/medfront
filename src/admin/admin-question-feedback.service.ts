import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionFeedback } from '../entities/question-feedback.entity';
import { AdminHistoryService } from './admin-history.service';

@Injectable()
export class AdminQuestionFeedbackService {
  constructor(
    @InjectRepository(QuestionFeedback)
    private readonly feedbackRepo: Repository<QuestionFeedback>,
    private readonly historyService: AdminHistoryService,
  ) {}

  async findAllFeedbacks(query: any) {
    const { 
      page = 1, 
      limit = 50, 
      type, 
      isResolved, 
      search, 
      sortBy = 'createdAt', 
      order = 'DESC',
      startDate,
      endDate 
    } = query;
    
    const queryBuilder = this.feedbackRepo.createQueryBuilder('feedback')
      .leftJoin('feedback.user', 'user')
      .addSelect(['user.id', 'user.name', 'user.email', 'user.avatarUrl'])
      .leftJoinAndSelect('feedback.question', 'question')
      .leftJoinAndSelect('question.options', 'options');

    if (type) {
      queryBuilder.andWhere('feedback.type = :type', { type });
    }

    if (isResolved !== undefined) {
      const resolvedBool = isResolved === 'true' || isResolved === true;
      queryBuilder.andWhere('feedback.isResolved = :isResolved', { isResolved: resolvedBool });
    }

    if (startDate) {
      queryBuilder.andWhere('feedback.createdAt >= :startDate', { startDate: new Date(startDate) });
    }

    if (endDate) {
      queryBuilder.andWhere('feedback.createdAt <= :endDate', { endDate: new Date(endDate) });
    }

    if (search) {
      queryBuilder.andWhere(
        '(feedback.comment ILIKE :search OR user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const allowedSort = ['createdAt', 'type'];
    const safeSort = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    queryBuilder.orderBy(`feedback.${safeSort}`, safeOrder as 'ASC' | 'DESC');

    const [items, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      success: true,
      data: {
        items,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async resolveFeedback(id: number, isResolved: boolean, adminId: number) {
    const feedback = await this.feedbackRepo.findOne({ where: { id } });
    if (!feedback) throw new NotFoundException('Feedback not found');

    feedback.isResolved = isResolved;
    await this.feedbackRepo.save(feedback);

    await this.historyService.record(
      String(adminId),
      isResolved ? 'RESOLVE_FEEDBACK' : 'UNRESOLVE_FEEDBACK',
      'QuestionFeedback',
      String(id),
      { feedbackId: id, isResolved },
      'Question Feedbacks',
    );

    return { success: true, message: 'Feedback status updated' };
  }
}
