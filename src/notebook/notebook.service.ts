import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotebookEntry } from '../entities/notebook-entry.entity';
import { CreateNotebookEntryDto, UpdateNotebookEntryDto } from './dto/notebook.dto';
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { Inject } from "@nestjs/common";

@Injectable()
export class NotebookService {
  constructor(
    @InjectRepository(NotebookEntry)
    private notebookRepository: Repository<NotebookEntry>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async findAll(userId: number) {
    const cacheKey = `user_notebook:all:${userId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const entries = await this.notebookRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });

    await this.cacheManager.set(cacheKey, entries, 300000); // 5 mins
    return entries;
  }

  async findOne(userId: number, id: number) {
    const entry = await this.notebookRepository.findOne({
      where: { id, userId },
    });

    if (!entry) {
      throw new NotFoundException(`Notebook entry with ID ${id} not found`);
    }

    return entry;
  }

  async create(userId: number, createDto: CreateNotebookEntryDto) {
    const entry = this.notebookRepository.create({
      ...createDto,
      userId,
    });
    const saved = await this.notebookRepository.save(entry);
    
    // 🚀 CACHE INVALIDATION
    await this.cacheManager.del(`user_notebook:all:${userId}`);
    
    return saved;
  }

  async update(userId: number, id: number, updateDto: UpdateNotebookEntryDto) {
    const entry = await this.findOne(userId, id);

    Object.assign(entry, updateDto);
    const updated = await this.notebookRepository.save(entry);
    
    // 🚀 CACHE INVALIDATION
    await this.cacheManager.del(`user_notebook:all:${userId}`);
    
    return updated;
  }

  async remove(userId: number, id: number) {
    const entry = await this.findOne(userId, id);
    await this.notebookRepository.remove(entry);
    
    // 🚀 CACHE INVALIDATION
    await this.cacheManager.del(`user_notebook:all:${userId}`);
    
    return { success: true };
  }
}
