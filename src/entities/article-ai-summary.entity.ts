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
import { LibraryArticle } from "./library-article.entity";

@Entity("article_ai_summaries")
@Unique(["userId", "articleId"])
export class ArticleAiSummary {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: string;

  @Column({ type: "int" })
  userId: number;

  @Column({ type: "int" })
  articleId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => LibraryArticle, { onDelete: "CASCADE" })
  @JoinColumn({ name: "articleId" })
  article: LibraryArticle;

  @Column({ type: "text" })
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
