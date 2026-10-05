import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { TicketMessage } from './ticket-message.entity';

@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ unique: true })
  ticketSeqId: string; // T-1001

  @Column()
  userId: number;

  @Column()
  subject: string;

  @Column()
  category: string;

  @Column()
  priority: string; // low, medium, high, urgent

  @Column({ default: 'new' })
  status: string; // new, open, pending, resolved, closed

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  resolvedAt: Date;

  @Column({ nullable: true })
  resolvedBy: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany('TicketMessage', 'ticket')
  messages: TicketMessage[];
}
