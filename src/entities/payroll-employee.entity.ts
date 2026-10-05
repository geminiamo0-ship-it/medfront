import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("payroll_employees")
export class PayrollEmployee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 120 })
  name: string;

  @Column({ type: "varchar", length: 120 })
  role: string;

  @Column({ type: "decimal", precision: 10, scale: 2, name: "fixed_monthly_salary" })
  fixedMonthlySalary: number;

  @Column({ type: "varchar", length: 10, default: "EGP" })
  currency: string;

  @Column({ type: "int" })
  month: number;

  @Column({ type: "int" })
  year: number;

  @Column({ type: "boolean", default: true, name: "is_active" })
  isActive: boolean;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updatedAt: Date;
}
