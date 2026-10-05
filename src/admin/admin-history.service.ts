import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { AdminHistory } from '../entities/admin-history.entity';

@Injectable()
export class AdminHistoryService {
  constructor(
    @InjectRepository(AdminHistory)
    private historyRepo: Repository<AdminHistory>,
  ) {}

  async record(
    adminEmail: string,
    action: string,
    targetEntity: string,
    targetId: string,
    details?: any,
    topic?: string,
  ) {
    const entry = this.historyRepo.create({
      adminEmail,
      action,
      targetEntity,
      targetId,
      topic,
      details,
    });
    return this.historyRepo.save(entry);
  }

  async findAll(limit: number = 25, offset: number = 0, topic?: string) {
    const where = topic ? { topic } : { topic: Not('Delete Hub') };
    const [data, total] = await this.historyRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return {
      success: true,
      data,
      total,
      limit,
      offset,
    };
  }
}
