import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from "typeorm";
import { User } from "./user.entity";

/**
 * General-purpose AI usage tracker.
 * featureKey distinguishes different AI features (e.g. "article_explain", "selection_explain").
 * usageDate is UTC date — resets naturally each new day, no cron needed.
 */
@Entity("ai_usage_logs")
@Unique(["userId", "featureKey", "usageDate"])
export class AiUsageLog {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: string;

  @Column({ type: "int" })
  @Index()
  userId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "varchar", length: 64 })
  featureKey: string;

  @Column({ type: "date" })
  usageDate: string; // stored as YYYY-MM-DD UTC

  @Column({ type: "int", default: 0 })
  callCount: number;

  @Column({ type: "int", default: 0 })
  successCalls: number;
}
