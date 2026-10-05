import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { LibraryArticle } from "./library-article.entity";

@Entity("article_highlights")
export class ArticleHighlight {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: string;

  @Column("text")
  text: string;

  @Column("text", { nullable: true })
  annotation: string;

  @Column({ default: "yellow" })
  color: string;

  @Column({ type: "int", nullable: true })
  rangeIndex: number;

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

  @CreateDateColumn()
  createdAt: Date;
}
