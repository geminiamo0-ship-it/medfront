import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum PayrollExpenseCategory {
  INFRASTRUCTURE = "INFRASTRUCTURE",
  TOOLS = "TOOLS",
  RENT = "RENT",
  OTHER = "OTHER",
}

@Entity("payroll_expenses")
export class PayrollExpense {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "varchar", length: 30, default: PayrollExpenseCategory.OTHER })
  category: PayrollExpenseCategory;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount: number;

  @Column({ type: "varchar", length: 10, default: "EGP" })
  currency: string;

  @Column({ type: "int" })
  month: number;

  @Column({ type: "int" })
  year: number;

  @Column({ type: "boolean", default: false, name: "is_template" })
  isTemplate: boolean;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updatedAt: Date;
}
