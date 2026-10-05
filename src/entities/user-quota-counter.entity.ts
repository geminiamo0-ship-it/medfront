import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("user_quota_counters")
@Index(["userId", "quotaType", "dayBucket"], { unique: true })
export class UserQuotaCounter {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int", name: "user_id" })
  userId: number;

  @Column({ type: "varchar", length: 64, name: "quota_type" })
  quotaType: string;

  @Column({ type: "date", name: "day_bucket" })
  dayBucket: string;

  @Column({ type: "int", default: 0 })
  count: number;

  @Column({ type: "int", name: "distinct_target_count", default: 0 })
  distinctTargetCount: number;

  @Column({ type: "timestamp", name: "first_hit_at", nullable: true })
  firstHitAt: Date | null;

  @Column({ type: "timestamp", name: "last_hit_at", nullable: true })
  lastHitAt: Date | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updatedAt: Date;
}
