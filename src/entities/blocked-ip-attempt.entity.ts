import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("blocked_ip_attempts")
@Index(["ip", "createdAt"])
@Index(["action", "createdAt"])
export class BlockedIpAttempt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 64 })
  ip: string;

  @Column({ type: "varchar", length: 32 })
  action: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  email: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  nickname: string | null;

  @Column({ type: "varchar", length: 255 })
  path: string;

  @Column({ type: "text", name: "user_agent", nullable: true })
  userAgent: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;
}
