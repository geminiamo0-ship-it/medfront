import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm";

@Entity("user_activity_logs")
@Index("IDX_user_activity_user_created", ["userId", "createdAt"])
@Index("IDX_user_activity_feature", ["feature"])
@Index("IDX_user_activity_action", ["action"])
export class UserActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "user_id", type: "int" })
  userId: number;

  @Column({ type: "varchar", length: 64 })
  feature: string;

  @Column({ type: "varchar", length: 64 })
  action: string;

  @Column({ name: "entity_type", type: "varchar", length: 64, nullable: true })
  entityType?: string | null;

  @Column({ name: "entity_id", type: "varchar", length: 64, nullable: true })
  entityId?: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata?: any;

  @Column({ name: "ip_address", type: "varchar", length: 64, nullable: true })
  ipAddress?: string | null;

  // `text` instead of varchar(255) so in-app browser User-Agent strings
  // (Instagram, Facebook, TikTok WebViews — easily 269+ chars) fit
  // without truncation. Matches the convention used by every other
  // security/audit table in this codebase (blocked_ip_attempts,
  // request_rate_limit_alerts, security_incidents, security_actor_states).
  // See migration 1803000000009-WidenActivityLogUserAgent.
  @Column({ name: "user_agent", type: "text", nullable: true })
  userAgent?: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  country?: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  region?: string | null;

  @Column({ type: "varchar", length: 128, nullable: true })
  city?: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  timezone?: string | null;

  @Column({ type: "double precision", nullable: true })
  latitude?: number | null;

  @Column({ type: "double precision", nullable: true })
  longitude?: number | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
