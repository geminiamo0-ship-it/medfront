import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { SpecialBadgeType } from "./special-badge-type.entity";

@Entity("user_special_badges")
@Index("IDX_user_special_badges_user", ["userId"])
export class UserSpecialBadge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int", name: "user_id" })
  userId: number;

  @Column({ type: "int", name: "badge_type_id" })
  badgeTypeId: number;

  @ManyToOne(() => SpecialBadgeType, { eager: true })
  @JoinColumn({ name: "badge_type_id" })
  badgeType: SpecialBadgeType;

  @Column({ type: "varchar", length: 100, name: "awarded_by" })
  awardedBy: string;

  @Column({ type: "text", nullable: true })
  note: string | null;

  @CreateDateColumn({ type: "timestamp", name: "awarded_at" })
  awardedAt: Date;
}
