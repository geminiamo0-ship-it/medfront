import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("special_badge_types")
export class SpecialBadgeType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 64, unique: true })
  key: string;

  @Column({ type: "varchar", length: 100 })
  label: string;

  @Column({ type: "varchar", length: 255, default: "" })
  description: string;

  @Column({ type: "varchar", length: 10, default: "🏅" })
  icon: string;

  @Column({ type: "varchar", length: 20, default: "#6366f1" })
  color: string;

  @Column({ type: "boolean", default: true, name: "is_active" })
  isActive: boolean;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updatedAt: Date;
}
