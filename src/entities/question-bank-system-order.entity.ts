import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

/**
 * Per-bank override for the ORDER and 2-column layout of systems on the
 * Create Test page. See QuestionBankSubjectOrder for the rationale — same
 * shape, keyed by system_id instead of subject_id.
 *
 * columnIndex: 1 = left column, 2 = right column.
 * position:    0-based order within the column.
 */
@Entity('question_bank_system_order')
@Index(['questionBankId'])
export class QuestionBankSystemOrder {
  @PrimaryColumn({ type: 'int', name: 'question_bank_id' })
  questionBankId: number;

  @PrimaryColumn({ type: 'int', name: 'system_id' })
  systemId: number;

  @Column({ type: 'smallint', name: 'column_index' })
  columnIndex: number;

  @Column({ type: 'int', name: 'position' })
  position: number;
}
