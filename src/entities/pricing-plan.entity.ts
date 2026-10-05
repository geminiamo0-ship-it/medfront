import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { SubscriptionPlan } from './user.entity';

@Entity('pricing_plans')
@Index(['code'], { unique: true })
export class PricingPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'enum', enum: SubscriptionPlan, default: SubscriptionPlan.PREMIUM })
  tier: SubscriptionPlan;

  @Column({ type: 'int', name: 'duration_months' })
  durationMonths: number;

  @Column({ type: 'varchar', length: 20, name: 'duration_label' })
  durationLabel: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'real_price' })
  realPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'discounted_price' })
  discountedPrice: number;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({ type: 'text', array: true })
  benefits: string[];

  @Column({ type: 'jsonb', nullable: true, name: 'regional_prices', default: [] })
  regionalPrices: { currency: string; realPrice: number; discountedPrice: number }[];

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_featured' })
  isFeatured: boolean;

  @Column({ type: 'int', default: 0, name: 'display_order' })
  displayOrder: number;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
