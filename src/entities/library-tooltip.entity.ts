import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("library_tooltips")
export class LibraryTooltip {
  @PrimaryColumn({ type: "text" })
  eid: string;

  @Column({ type: "text" })
  abstract: string;

  @Column({ type: "text", default: "amboss" })
  source: string;
}
