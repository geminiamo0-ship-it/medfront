import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("blocked_ips")
@Index(["ip"], { unique: true })
@Index(["active"])
export class BlockedIp {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 64 })
  ip: string;

  @Column({ type: "boolean", default: true })
  active: boolean;

  @Column({ type: "varchar", length: 128 })
  reason: string;

  @Column({ type: "int", name: "linked_user_id", nullable: true })
  linkedUserId: number | null;

  @Column({ type: "varchar", length: 64, name: "source_type", nullable: true })
  sourceType: string | null;

  @Column({ type: "int", name: "source_id", nullable: true })
  sourceId: number | null;

  @Column({ type: "varchar", length: 255, name: "blocked_by", nullable: true })
  blockedBy: string | null;

  @Column({ type: "timestamp", name: "blocked_at", default: () => "now()" })
  blockedAt: Date;

  @Column({ type: "timestamp", name: "unblocked_at", nullable: true })
  unblockedAt: Date | null;

  @Column({ type: "varchar", length: 255, name: "unblocked_by", nullable: true })
  unblockedBy: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updatedAt: Date;
}
