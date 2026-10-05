import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { Question } from "./question.entity";

@Entity("question_notes")
@Index(["userId", "questionId"], { unique: true })
export class QuestionNote {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: string;

  @Column({ name: "user_id" })
  userId: number;

  @Column({ name: "question_id" })
  questionId: number;

  @Column({ type: "text" })
  content: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @ManyToOne(() => Question, { onDelete: "CASCADE" })
  @JoinColumn({ name: "question_id" })
  question: Question;

  @CreateDateColumn({ type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt: Date;
}
