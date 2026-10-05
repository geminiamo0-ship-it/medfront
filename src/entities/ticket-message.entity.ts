import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SupportTicket } from './support-ticket.entity';
import { User } from './user.entity';

@Entity('ticket_messages')
export class TicketMessage {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  ticketId: string;

  @Column()
  senderId: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ nullable: true })
  attachmentUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('SupportTicket', 'messages')
  @JoinColumn({ name: 'ticketId' })
  ticket: SupportTicket;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'senderId' })
  sender: User;
}
