import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Notification } from "./notification.entity";
import { User } from "./user.entity";

@Entity("notification_reads")
@Index(["notificationId", "adminId"], { unique: true })
@Index(["adminId", "readAt"])
export class NotificationRead {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Notification, { onDelete: "CASCADE" })
  @JoinColumn({ name: "notification_id" })
  notification: Notification;

  @Column({ type: "int", name: "notification_id" })
  notificationId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "admin_id" })
  admin: User;

  @Column({ type: "int", name: "admin_id" })
  adminId: number;

  @CreateDateColumn({ type: "timestamp", name: "read_at" })
  readAt: Date;
}
