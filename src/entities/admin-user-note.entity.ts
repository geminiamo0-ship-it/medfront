import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";

@Entity("admin_user_notes")
@Index(["userId", "createdAt"])
export class AdminUserNote {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ type: "int", name: "user_id" })
  userId: number;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "admin_id" })
  admin: User | null;

  @Column({ type: "int", name: "admin_id", nullable: true })
  adminId: number | null;

  @Column({ type: "text" })
  note: string;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;
}
