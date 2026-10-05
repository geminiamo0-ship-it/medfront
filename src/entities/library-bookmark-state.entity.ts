import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity("library_bookmark_state")
@Unique(["userId"])
export class LibraryBookmarkState {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: string;

  @Column({ type: "int" })
  userId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "text", array: true, default: () => "ARRAY[]::text[]" })
  folders: string[];

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  assignments: Record<string, string[]>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
