import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("admin_expenses")
export class AdminExpense {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 100 })
  category: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount: number;

  @Column({ type: "varchar", length: 10, default: "USD" })
  currency: string;

  @Column({ type: "text", nullable: true })
  note: string | null;

  @Column({ type: "timestamp", name: "incurred_at" })
  incurredAt: Date;

  @Column({ type: "int", nullable: true, name: "created_by" })
  createdBy: number | null;

  @Column({ type: "int", nullable: true, name: "updated_by" })
  updatedBy: number | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updatedAt: Date;
}
