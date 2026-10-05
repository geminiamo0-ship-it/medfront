import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("user_daily_stats")
@Index("IDX_user_daily_stats_user_date", ["userId", "date"], { unique: true })
export class UserDailyStats {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int", name: "user_id" })
  userId: number;

  @Column({ type: "date" })
  date: string; // YYYY-MM-DD (UTC)

  @Column({ type: "int", default: 0, name: "questions_attempted" })
  questionsAttempted: number;

  @Column({ type: "int", default: 0, name: "correct_count" })
  correctCount: number;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updatedAt: Date;
}
