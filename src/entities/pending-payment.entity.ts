import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { PromoCode } from "./promo-code.entity";

export enum PaymentStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  REJECTED = "rejected",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
}

export enum SubscriptionDuration {
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  YEARLY = "yearly",
  LIFETIME = "lifetime",
}

@Entity("pending_payments")
export class PendingPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, {
    onDelete: "CASCADE",
    createForeignKeyConstraints: true,
  })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ type: "int", name: "user_id" })
  userId: number;

  @Column({ type: "varchar", length: 50 })
  plan: string; // 'Basic' or 'Premium'

  @Column({ type: "varchar", length: 64, nullable: true, name: "plan_code" })
  planCode: string | null;

  @Column({ type: "varchar", length: 120, nullable: true, name: "plan_name" })
  planName: string | null;

  @Column({
    type: "varchar",
    length: 20,
    default: SubscriptionDuration.YEARLY,
  })
  duration: SubscriptionDuration;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    name: "actual_amount",
  })
  actualAmount: number | null;

  @Column({ type: "text", nullable: true, name: "actual_amount_note" })
  actualAmountNote: string | null;

  @Column({ type: "int", nullable: true, name: "actual_amount_updated_by" })
  actualAmountUpdatedBy: number | null;

  @Column({
    type: "timestamp",
    nullable: true,
    name: "actual_amount_updated_at",
  })
  actualAmountUpdatedAt: Date | null;

  @Column({ type: "varchar", length: 10, default: "USD" })
  currency: string;

  @Column({
    type: "varchar",
    length: 50,
    unique: true,
    name: "payment_reference",
  })
  paymentReference: string; // e.g., MEDPARK-2026-001234

  @ManyToOne(() => PromoCode, {
    nullable: true,
    onDelete: "SET NULL",
    createForeignKeyConstraints: true,
  })
  @JoinColumn({ name: "promo_code_id" })
  promoCode: PromoCode | null;

  @Column({ type: "int", nullable: true, name: "promo_code_id" })
  promoCodeId: number | null;

  @Column({ type: "int", nullable: true, name: "promo_code_owner_user_id" })
  promoCodeOwnerUserId: number | null;

  @Column({
    type: "varchar",
    length: 255,
    nullable: true,
    name: "promo_code_value",
  })
  promoCodeValue: string | null;

  @Column({ type: "int", nullable: true, name: "promo_code_discount_percent" })
  promoCodeDiscountPercent: number | null;

  @Column({
    type: "varchar",
    length: 100,
    nullable: true,
    name: "telegram_username",
  })
  telegramUsername: string;

  @Column({
    type: "varchar",
    length: 20,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({
    type: "varchar",
    length: 20,
    nullable: true,
    name: "approval_tag",
  })
  approvalTag: string | null;

  @Column({ type: "text", nullable: true, name: "approval_note" })
  approvalNote: string | null;

  @Column({
    type: "varchar",
    length: 500,
    nullable: true,
    name: "proof_image_url",
  })
  proofImageUrl: string;

  @Column({ type: "int", nullable: true, name: "confirmed_by" })
  confirmedBy: number; // Admin user ID who confirmed

  @Column({ type: "text", nullable: true, name: "rejection_reason" })
  rejectionReason: string;

  @Column({ type: "timestamp", nullable: true, name: "confirmed_at" })
  confirmedAt: Date;

  @Column({ type: "timestamp", name: "expires_at", nullable: true })
  expiresAt: Date | null;

  @Column({ type: "int", nullable: true, name: "wallet_id" })
  walletId: number | null;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, name: "commission_amount" })
  commissionAmount: number | null;

  @Column({ type: "varchar", length: 10, nullable: true, name: "approval_currency" })
  approvalCurrency: string | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updatedAt: Date;
}
