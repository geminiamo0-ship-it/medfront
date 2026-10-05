import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('affiliate_referrals')
export class AffiliateReferral {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'referrer_id' })
  referrerId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referrer_id' })
  referrer: User;

  @Column({ type: 'int', name: 'referred_user_id', unique: true })
  referredUserId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referred_user_id' })
  referredUser: User;

  @Column({ type: 'boolean', default: false, name: 'has_paid' })
  hasPaid: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'commission_amount' })
  commissionAmount: number | null;

  @Column({ type: 'timestamp', nullable: true, name: 'paid_at' })
  paidAt: Date | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
