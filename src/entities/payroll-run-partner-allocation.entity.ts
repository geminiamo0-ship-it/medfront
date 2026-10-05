import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { PayrollRun } from "./payroll-run.entity";
import { FinancePartner } from "./finance-partner.entity";

@Entity("payroll_run_partner_allocations")
export class PayrollRunPartnerAllocation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PayrollRun, (run) => run.partnerAllocations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "payroll_run_id" })
  payrollRun: PayrollRun;

  @Column({ type: "int", name: "payroll_run_id" })
  payrollRunId: number;

  @ManyToOne(() => FinancePartner, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "partner_id" })
  partner: FinancePartner;

  @Column({ type: "int", name: "partner_id" })
  partnerId: number;

  @Column({ type: "varchar", length: 120, nullable: true, name: "partner_name_snapshot" })
  partnerNameSnapshot: string | null;

  @Column({ type: "decimal", precision: 5, scale: 2, name: "equity_percent_snapshot" })
  equityPercentSnapshot: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount: number;
}
