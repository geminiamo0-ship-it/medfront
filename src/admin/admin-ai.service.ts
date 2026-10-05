import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiUsageLog } from '../entities/ai-usage-log.entity';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class AdminAiService {
  constructor(
    @InjectRepository(AiUsageLog)
    private aiUsageLogRepo: Repository<AiUsageLog>,
    private settingsService: SettingsService,
  ) {}

  async getAiUsage(date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const [totalStats, usersUsage, globalLimit] = await Promise.all([
      this.aiUsageLogRepo
        .createQueryBuilder('log')
        .select('SUM(log.callCount)', 'totalCalls')
        .addSelect('SUM(log.successCalls)', 'totalSuccess')
        .where('log.usageDate = :date', { date: targetDate })
        .getRawOne(),

      this.aiUsageLogRepo
        .createQueryBuilder('log')
        .leftJoin('log.user', 'user')
        .select('user.id', 'userId')
        .addSelect('user.email', 'userEmail')
        .addSelect('user.name', 'userName')
        .addSelect('SUM(log.callCount)', 'totalCalls')
        .addSelect('SUM(log.successCalls)', 'totalSuccess')
        .where('log.usageDate = :date', { date: targetDate })
        .groupBy('user.id')
        .addGroupBy('user.email')
        .addGroupBy('user.name')
        .orderBy('SUM(log.callCount)', 'DESC')
        .getRawMany(),

      this.settingsService.getNumber('AI_DAILY_GLOBAL_LIMIT', 500),
    ]);

    const totalCalls = parseInt(totalStats?.totalCalls || '0', 10);

    return {
      date: targetDate,
      overview: {
        totalCalls,
        totalSuccess: parseInt(totalStats?.totalSuccess || '0', 10),
        globalLimit,
        usagePercentage: globalLimit > 0 ? Math.round((totalCalls / globalLimit) * 1000) / 10 : 0,
      },
      users: usersUsage.map(u => ({
        userId: u.userId,
        email: u.userEmail,
        name: u.userName,
        totalCalls: parseInt(u.totalCalls || '0', 10),
        totalSuccess: parseInt(u.totalSuccess || '0', 10),
      })),
    };
  }
}
