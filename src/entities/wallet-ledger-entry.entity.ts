import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Wallet } from "./wallet.entity";
import { PendingPayment } from "./pending-payment.entity";

export enum LedgerEntryType {
  PAYMENT = "PAYMENT",
  MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT",
}

@Entity("wallet_ledger_entries")
export class WalletLedgerEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Wallet, { onDelete: "CASCADE", createForeignKeyConstraints: true })
  @JoinColumn({ name: "wallet_id" })
  wallet: Wallet;

  @Column({ type: "int", name: "wallet_id" })
  walletId: number;

  @ManyToOne(() => PendingPayment, { nullable: true, onDelete: "SET NULL", createForeignKeyConstraints: true })
  @JoinColumn({ name: "payment_id" })
  payment: PendingPayment | null;

  @Column({ type: "int", name: "payment_id", nullable: true })
  paymentId: number | null;

  @Column({ type: "varchar", length: 32, default: LedgerEntryType.PAYMENT, name: "entry_type" })
  entryType: LedgerEntryType;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount: number;

  @Column({ type: "varchar", length: 10 })
  currency: string;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, name: "commission_amount" })
  commissionAmount: number | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  note: string | null;

  @Column({ type: "varchar", length: 120, nullable: true, name: "approved_by_admin_email" })
  approvedByAdminEmail: string | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;
}
