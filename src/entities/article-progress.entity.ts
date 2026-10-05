import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity";
import { LibraryArticle } from "./library-article.entity";

@Entity("article_progress")
@Unique(["userId", "articleId"])
export class ArticleProgress {
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

  @Column({ default: false })
  isRead: boolean;

  @Column({ default: false })
  isBookmarked: boolean;

  @Column({ type: "timestamp", nullable: true })
  lastAccessedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
