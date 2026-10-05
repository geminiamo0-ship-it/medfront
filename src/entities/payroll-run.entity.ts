import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { PayrollRunWalletDeduction } from "./payroll-run-wallet-deduction.entity";
import { PayrollRunPartnerAllocation } from "./payroll-run-partner-allocation.entity";

@Entity("payroll_runs")
export class PayrollRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "decimal", precision: 10, scale: 2, name: "total_distributed" })
  totalDistributed: number;

  @Column({ type: "varchar", length: 10, default: "EGP" })
  currency: string;

  @Column({ type: "boolean", default: false, name: "salaried_this_month" })
  salariedThisMonth: boolean;

  @Column({ type: "boolean", default: false, name: "expenses_deducted_this_month" })
  expensesDeductedThisMonth: boolean;

  @Column({ type: "int", name: "admin_id" })
  adminId: number;

  @Column({ type: "varchar", length: 120, nullable: true, name: "admin_email" })
  adminEmail: string | null;

  @OneToMany(() => PayrollRunWalletDeduction, (d) => d.payrollRun, { cascade: true })
  walletDeductions: PayrollRunWalletDeduction[];

  @OneToMany(() => PayrollRunPartnerAllocation, (a) => a.payrollRun, { cascade: true })
  partnerAllocations: PayrollRunPartnerAllocation[];

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;
}
