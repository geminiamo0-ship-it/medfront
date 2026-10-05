import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Question } from '../entities/question.entity';
import { SupportTicket } from '../entities/support-ticket.entity';
import { PendingPayment } from '../entities/pending-payment.entity';

@Injectable()
export class AdminStatsService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Question)
    private questionRepo: Repository<Question>,
    @InjectRepository(SupportTicket)
    private ticketRepo: Repository<SupportTicket>,
    @InjectRepository(PendingPayment)
    private paymentRepo: Repository<PendingPayment>,
  ) {}

  async getGlobalStats() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

    // Basic Counts
    const [totalUsers, totalQuestions, openTickets, activeSubscribers, totalRevenueResult, urgentTickets] = await Promise.all([
      this.userRepo.count(),
      this.questionRepo.count(),
      this.ticketRepo.count({ where: { status: 'new' } }),
      this.userRepo.count({ where: { role: UserRole.USER } }), // This logic might need refinement based on subscription table
      this.paymentRepo.createQueryBuilder('p')
        .select('SUM(p.amount)', 'total')
        .where('p.status = :status', { status: 'confirmed' })
        .getRawOne(),
      this.ticketRepo.count({ where: { priority: 'urgent', status: 'new' } })
    ]);

    const totalRevenue = parseFloat(totalRevenueResult?.total || '0');

    // Growth Metrics
    const [newUsers30d, newUsersPrev30d, newQuestions30d, revenue30dResult, revenuePrev30dResult] = await Promise.all([
      this.userRepo.count({ where: { createdAt: MoreThanOrEqual(thirtyDaysAgo) } }),
      this.userRepo.count({ where: { createdAt: Between(sixtyDaysAgo, thirtyDaysAgo) } }),
      
      this.questionRepo.count({ where: { createdAt: MoreThanOrEqual(thirtyDaysAgo) } }),

      this.paymentRepo.createQueryBuilder('p')
        .select('SUM(p.amount)', 'total')
        .where('p.status = :status', { status: 'confirmed' })
        .andWhere('p.confirmedAt >= :date', { date: thirtyDaysAgo })
        .getRawOne(),

      this.paymentRepo.createQueryBuilder('p')
        .select('SUM(p.amount)', 'total')
        .where('p.status = :status', { status: 'confirmed' })
        .andWhere('p.confirmedAt BETWEEN :start AND :end', { start: sixtyDaysAgo, end: thirtyDaysAgo })
        .getRawOne(),
    ]);

    const revenue30d = parseFloat(revenue30dResult?.total || '0');
    const revenuePrev30d = parseFloat(revenuePrev30dResult?.total || '0');

    const calculatePercent = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? `+${curr}` : '0%';
      const pct = ((curr - prev) / prev) * 100;
      return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`;
    };

    return {
      success: true,
      data: {
        totalUsers,
        totalQuestions,
        pendingTickets: openTickets,
        activeSubscribers,
        usersGrowth: calculatePercent(newUsers30d, newUsersPrev30d),
        questionsGrowth: `+${newQuestions30d}`,
        ticketsGrowth: openTickets > 0 ? `+${openTickets}` : '0',
        revenueGrowth: calculatePercent(revenue30d, revenuePrev30d),
        totalRevenue: `$${totalRevenue.toLocaleString()}`,
        urgentTickets,
        sync_mode: "live_typeorm"
      }
    };
  }
}
