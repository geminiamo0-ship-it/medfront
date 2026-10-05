import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

/**
 * Per-bank override for the ORDER and 2-column layout of subjects on the
 * Create Test page. Global order lives on Subject.displayOrder and is shared
 * across every bank; this table lets a single bank pin an exact left/right
 * column layout independent of that global order.
 *
 * Raw-int columns, no hard FKs — mirrors the user_question_marks style. A row
 * exists only for subjects that are explicitly ordered for the bank; subjects
 * present in the bank but absent here fall back to the global order (the
 * metadata service appends them after the pinned items).
 *
 * columnIndex: 1 = left column, 2 = right column.
 * position:    0-based order within the column.
 */
@Entity('question_bank_subject_order')
@Index(['questionBankId'])
export class QuestionBankSubjectOrder {
  @PrimaryColumn({ type: 'int', name: 'question_bank_id' })
  questionBankId: number;

  @PrimaryColumn({ type: 'int', name: 'subject_id' })
  subjectId: number;

  @Column({ type: 'smallint', name: 'column_index' })
  columnIndex: number;

  @Column({ type: 'int', name: 'position' })
  position: number;
}
