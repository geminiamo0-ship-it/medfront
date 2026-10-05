import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("security_actor_states")
@Index(["actorKey"], { unique: true })
@Index(["userId"])
@Index(["contentLockUntil"])
export class SecurityActorState {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 32, name: "actor_type" })
  actorType: string;

  @Column({ type: "varchar", length: 255, name: "actor_key" })
  actorKey: string;

  @Column({ type: "int", name: "user_id", nullable: true })
  userId: number | null;

  @Column({ type: "varchar", length: 64 })
  ip: string;

  @Column({ type: "text", name: "user_agent", nullable: true })
  userAgent: string | null;

  @Column({ type: "int", name: "current_score", default: 0 })
  currentScore: number;

  @Column({ type: "int", name: "strike_count", default: 0 })
  strikeCount: number;

  @Column({ type: "timestamp", name: "cooldown_until", nullable: true })
  cooldownUntil: Date | null;

  @Column({ type: "timestamp", name: "content_lock_until", nullable: true })
  contentLockUntil: Date | null;

  @Column({ type: "timestamp", name: "last_incident_at", nullable: true })
  lastIncidentAt: Date | null;

  @Column({ type: "varchar", length: 255, name: "last_raw_path", nullable: true })
  lastRawPath: string | null;

  @Column({ type: "varchar", length: 255, name: "last_normalized_route", nullable: true })
  lastNormalizedRoute: string | null;

  @Column({ type: "varchar", length: 255, name: "last_exact_endpoint_key", nullable: true })
  lastExactEndpointKey: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updatedAt: Date;
}
