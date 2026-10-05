import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SupportTicket } from '../entities/support-ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { UserRole } from '../entities/user.entity';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(SupportTicket)
    private ticketRepo: Repository<SupportTicket>,
    @InjectRepository(TicketMessage)
    private messageRepo: Repository<TicketMessage>,
  ) {}

  async create(userId: number, data: any) {
    const ticketCount = await this.ticketRepo.count();
    const ticketSeqId = `T-${1000 + ticketCount + 1}`;
    
    const ticket = this.ticketRepo.create({
      ...data,
      userId,
      ticketSeqId,
    });
    
    const savedTicket = await this.ticketRepo.save(ticket) as any;
    
    if (data.content) {
      await this.addMessage(savedTicket.id, userId, data.content, data.attachmentUrl, UserRole.USER);
    }
    
    return savedTicket;
  }

  async addMessage(
    ticketId: string | number,
    senderId: number,
    content: string,
    attachmentUrl?: string,
    senderRole: UserRole = UserRole.USER,
  ) {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId as any } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const message = this.messageRepo.create({
      ticketId: ticketId as any,
      senderId,
      content,
      attachmentUrl,
    });
    const savedMessage = await this.messageRepo.save(message);

    if (senderRole === UserRole.USER && (ticket.status === 'resolved' || ticket.status === 'closed')) {
      ticket.status = 'open';
    }
    ticket.updatedAt = new Date();
    await this.ticketRepo.save(ticket);
    return savedMessage;
  }

  async findAll(status?: string) {
    let where: any = {};
    if (status === 'unsolved') {
      where.status = In(['new', 'open', 'pending']);
    } else if (status === 'solved') {
      where.status = In(['resolved', 'closed']);
    } else if (status) {
      where.status = status;
    }
    
    return this.ticketRepo.find({
      where,
      relations: ['user', 'messages', 'messages.sender'],
      order: { updatedAt: 'DESC' },
    });
  }

  async findMyTickets(userId: number, page = 1, pageSize = 10) {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.max(1, Math.min(50, Number(pageSize) || 10));
    const [items, total] = await this.ticketRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    });
    return { items, total, page: safePage, pageSize: safePageSize };
  }

  async findOneForUser(id: string | number, userId: number) {
    const ticket = await this.findOne(id);
    if (ticket.userId !== userId) throw new ForbiddenException('You do not have access to this ticket');
    return ticket;
  }

  async findOne(id: string | number) {
    const ticket = await this.ticketRepo.findOne({
      where: { id: id as any },
      relations: ['user', 'messages', 'messages.sender'],
      order: { messages: { createdAt: 'ASC' } as any },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  private async hasStaffReply(ticketId: string | number) {
    const count = await this.messageRepo
      .createQueryBuilder('message')
      .leftJoin('message.sender', 'sender')
      .where('message.ticketId = :ticketId', { ticketId })
      .andWhere('sender.role IS NOT NULL')
      .andWhere('sender.role != :role', { role: UserRole.USER })
      .getCount();
    return count > 0;
  }

  async updateTicketForUser(ticketId: string | number, userId: number, data: any) {
    const ticket = await this.findOneForUser(ticketId, userId);
    if (await this.hasStaffReply(ticket.id)) {
      throw new ForbiddenException('Ticket cannot be edited after a staff reply.');
    }

    if (data.subject) ticket.subject = data.subject;
    if (data.category) ticket.category = data.category;
    if (data.priority) ticket.priority = data.priority;
    await this.ticketRepo.save(ticket);

    if (data.content) {
      const firstMessage = await this.messageRepo.findOne({
        where: { ticketId: ticket.id as any },
        order: { createdAt: 'ASC' },
      });
      if (firstMessage) {
        firstMessage.content = data.content;
        await this.messageRepo.save(firstMessage);
      } else {
        await this.addMessage(ticket.id, userId, data.content, undefined, UserRole.USER);
      }
    }

    return this.findOne(ticket.id);
  }

  async deleteTicketForUser(ticketId: string | number, userId: number) {
    const ticket = await this.findOneForUser(ticketId, userId);
    if (await this.hasStaffReply(ticket.id)) {
      throw new ForbiddenException('Ticket cannot be deleted after a staff reply.');
    }
    await this.ticketRepo.delete(ticket.id);
    return { success: true };
  }

  async updateStatus(id: string | number, status: string, adminId?: number) {
    const ticket = await this.findOne(id);
    ticket.status = status;
    if (status === 'resolved' || status === 'closed') {
      ticket.resolvedAt = new Date();
      if (adminId) ticket.resolvedBy = adminId;
    }
    return this.ticketRepo.save(ticket);
  }

  async updatePriority(id: string | number, priority: string) {
    const ticket = await this.findOne(id);
    ticket.priority = priority;
    return this.ticketRepo.save(ticket);
  }
}
