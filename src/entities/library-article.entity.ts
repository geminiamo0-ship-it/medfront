import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("library_articles")
@Index(["source", "externalId"], { unique: true })
@Index("IDX_library_articles_source_name", ["source", "name"], { unique: true })
export class LibraryArticle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column({ name: "content_html", type: "text" })
  contentHtml: string;

  @Column({ nullable: true })
  qbank: string;

  @Column({ default: "usmle" })
  source: string;

  @Column({ name: "external_id", nullable: true })
  externalId?: string | null;

  @Column({ name: "external_caller", nullable: true })
  externalCaller?: string | null;

  @Column({ name: "library_name", nullable: true })
  libraryName?: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
