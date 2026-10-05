import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { PayrollRun } from "./payroll-run.entity";
import { Wallet } from "./wallet.entity";

@Entity("payroll_run_wallet_deductions")
export class PayrollRunWalletDeduction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PayrollRun, (run) => run.walletDeductions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "payroll_run_id" })
  payrollRun: PayrollRun;

  @Column({ type: "int", name: "payroll_run_id" })
  payrollRunId: number;

  @ManyToOne(() => Wallet, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "wallet_id" })
  wallet: Wallet;

  @Column({ type: "int", name: "wallet_id" })
  walletId: number;

  @Column({ type: "varchar", length: 120, nullable: true, name: "wallet_name_snapshot" })
  walletNameSnapshot: string | null;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount: number;
}
