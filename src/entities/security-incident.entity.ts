import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("security_incidents")
@Index(["createdAt"])
@Index(["userId", "createdAt"])
@Index(["ip", "createdAt"])
@Index(["actorKey", "createdAt"])
@Index(["endpointFamily", "createdAt"])
export class SecurityIncident {
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

  @Column({ type: "varchar", length: 255, name: "raw_path" })
  rawPath: string;

  @Column({ type: "varchar", length: 255, name: "normalized_route" })
  normalizedRoute: string;

  @Column({ type: "varchar", length: 12 })
  method: string;

  @Column({ type: "text", name: "query_string", nullable: true })
  queryString: string | null;

  @Column({ type: "varchar", length: 64, name: "endpoint_family" })
  endpointFamily: string;

  @Column({ type: "varchar", length: 64, name: "target_type", nullable: true })
  targetType: string | null;

  @Column({ type: "varchar", length: 128, name: "target_value", nullable: true })
  targetValue: string | null;

  @Column({ type: "varchar", length: 255, name: "exact_endpoint_key" })
  exactEndpointKey: string;

  @Column({ type: "varchar", length: 64, name: "incident_type" })
  incidentType: string;

  @Column({ type: "varchar", length: 16 })
  severity: string;

  @Column({ type: "int", name: "score_delta", default: 0 })
  scoreDelta: number;

  @Column({ type: "int", name: "cumulative_score", default: 0 })
  cumulativeScore: number;

  @Column({ type: "varchar", length: 64, name: "action_taken", nullable: true })
  actionTaken: string | null;

  @Column({ type: "int", name: "hit_count_in_window", default: 0 })
  hitCountInWindow: number;

  @Column({ type: "int", name: "distinct_target_count_in_window", default: 0 })
  distinctTargetCountInWindow: number;

  @Column({ type: "int", name: "lock_duration_seconds", default: 0 })
  lockDurationSeconds: number;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updatedAt: Date;
}
