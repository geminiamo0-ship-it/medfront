import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from "typeorm";

@Entity("finance_settings")
export class FinanceSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 10, default: "EGP", name: "master_currency" })
  masterCurrency: string;

  @Column({ type: "decimal", precision: 10, scale: 4, default: 1, name: "usd_to_egp_rate" })
  usdToEgpRate: number;

  @Column({ type: "timestamp", nullable: true, name: "rate_updated_at" })
  rateUpdatedAt: Date | null;

  @Column({ type: "int", nullable: true, name: "updated_by_admin_id" })
  updatedByAdminId: number | null;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updatedAt: Date;
}
