import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { PendingPayment } from './pending-payment.entity';
import { User } from './user.entity';

@Entity('payment_approvals')
@Unique(['paymentId', 'adminId'])
export class PaymentApproval {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PendingPayment, { onDelete: 'CASCADE', createForeignKeyConstraints: true })
  @JoinColumn({ name: 'payment_id' })
  payment: PendingPayment;

  @Column({ type: 'int', name: 'payment_id' })
  paymentId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', createForeignKeyConstraints: true })
  @JoinColumn({ name: 'admin_id' })
  admin: User;

  @Column({ type: 'int', name: 'admin_id' })
  adminId: number;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
