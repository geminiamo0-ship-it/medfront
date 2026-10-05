import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

export enum NotificationAudience {
  ADMIN = "admin",
  USER = "user",
}

export enum NotificationType {
  INFO = "info",
  WARNING = "warning",
  SUCCESS = "success",
}

@Entity("notifications")
@Index(["audience", "isRead", "createdAt"])
@Index(["audience", "userId", "createdAt"])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar" })
  audience: NotificationAudience;

  @Column({ type: "int", name: "user_id", nullable: true })
  userId: number | null;

  @Column({ type: "text" })
  title: string;

  @Column({ type: "text" })
  message: string;

  @Column({ type: "varchar", default: NotificationType.INFO })
  type: NotificationType;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: "boolean", name: "is_read", default: false })
  isRead: boolean;

  @Column({ type: "timestamp", name: "read_at", nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;
}
