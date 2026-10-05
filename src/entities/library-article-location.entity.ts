import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("library_article_locations")
export class LibraryArticleLocation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "articleId", type: "int" })
  articleId: number;

  @Column({ name: "category_path", type: "text" })
  categoryPath: string;
}
