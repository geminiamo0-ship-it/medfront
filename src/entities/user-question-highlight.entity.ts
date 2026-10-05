import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Isolated storage for user highlights on test questions.
 * Completely separate from question_submissions — highlights never
 * create draft submissions or interfere with the answer/grading flow.
 */
@Entity('user_question_highlights')
@Index('IDX_uqh_user_test_question', ['userId', 'testId', 'questionId'], { unique: true })
@Index('IDX_uqh_test', ['testId'])
export class UserQuestionHighlight {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'user_id' })
  userId: number;

  @Column({ type: 'int', name: 'test_id' })
  testId: number;

  @Column({ type: 'int', name: 'question_id' })
  questionId: number;

  /** Raw highlight descriptors: [{text, color, startIndex, endIndex, source}] */
  @Column({ type: 'json', nullable: true })
  highlights: {
    text: string;
    startIndex: number;
    endIndex: number;
    color: string;
    /** Container the highlight belongs to. Absent on legacy rows. */
    source?: 'question' | 'explanation';
  }[] | null;

  /**
   * Pre-rendered question HTML with <span> highlight tags applied.
   * Loaded directly on any device — no regex reconstruction needed.
   */
  @Column({ type: 'text', nullable: true, name: 'question_html_cache' })
  questionHtmlCache: string | null;

  /**
   * Pre-rendered explanation HTML with <span> highlight tags applied.
   */
  @Column({ type: 'text', nullable: true, name: 'explanation_html_cache' })
  explanationHtmlCache: string | null;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
