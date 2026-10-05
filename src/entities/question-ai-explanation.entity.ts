import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

@Entity('question_ai_explanations')
@Unique(['questionId', 'type', 'optionId', 'language'])
export class QuestionAiExplanation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'question_id' })
  questionId: string;

  // 'question' | 'explanation'
  @Column()
  type: string;

  // Only populated if type === 'explanation' (stores the user's selected option ID)
  // Nullable because 'question' type explanations don't depend on a selected option.
  @Column({ name: 'option_id', nullable: true })
  optionId: string;

  // Language of the AI response: 'en' or 'ar'
  @Column({ type: 'varchar', length: 5, default: 'en' })
  language: string;

  @Column('text')
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
