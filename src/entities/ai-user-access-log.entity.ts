import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
  CreateDateColumn,
} from "typeorm";
import { User } from "./user.entity";

/**
 * Tracks specific items accessed by a user on a specific day.
 * This allows us to offer "Free Refreshes" for the same content within the same day,
 * while charging a quota point for every new item or same item on a different day.
 */
@Entity("ai_user_access_logs")
@Unique(["userId", "featureKey", "itemKey", "accessDate"])
export class AiUserAccessLog {
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

  /**
   * Unique key for the item being accessed.
   * For AI Tutor: "question:{questionId}:{type}:{optionId}"
   */
  @Column({ type: "varchar", length: 255 })
  itemKey: string;

  @Column({ type: "date" })
  accessDate: string; // YYYY-MM-DD UTC

  @CreateDateColumn()
  createdAt: Date;
}
