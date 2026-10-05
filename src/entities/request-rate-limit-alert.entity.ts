import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("request_rate_limit_alerts")
@Index(["userId", "createdAt"])
@Index(["ip", "createdAt"])
export class RequestRateLimitAlert {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int", name: "user_id", nullable: true })
  userId: number | null;

  @Column({ type: "varchar", length: 64 })
  ip: string;

  @Column({ type: "varchar", length: 255 })
  path: string;

  @Column({ type: "varchar", length: 12 })
  method: string;

  @Column({ type: "text", name: "user_agent", nullable: true })
  userAgent: string | null;

  @Column({ type: "int" })
  limit: number;

  @Column({ type: "int", name: "total_hits" })
  totalHits: number;

  @Column({ type: "int", name: "ttl_seconds" })
  ttlSeconds: number;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;
}
