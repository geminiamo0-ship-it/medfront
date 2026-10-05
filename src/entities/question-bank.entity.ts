import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MainBank } from './main-bank.entity';

export enum USMLEStep {
  STEP_1 = 1,
  STEP_2 = 2,
  STEP_3 = 3,
  MRCP_PART_1 = 4,
  MRCP_PART_2 = 5,
}

export enum ViewerThemeProfile {
  STANDARD_EXAM = 'standard_exam',
  MRCP_PASSMEDICINE = 'mrcp_passmedicine',
  MRCP_PASTEST = 'mrcp_pastest',
}

export const ALL_EXAM_STEPS: USMLEStep[] = [
  USMLEStep.STEP_1,
  USMLEStep.STEP_2,
  USMLEStep.STEP_3,
  USMLEStep.MRCP_PART_1,
  USMLEStep.MRCP_PART_2,
];

export const STEP_LABELS: Record<USMLEStep, string> = {
  [USMLEStep.STEP_1]: 'Step 1',
  [USMLEStep.STEP_2]: 'Step 2',
  [USMLEStep.STEP_3]: 'Step 3',
  [USMLEStep.MRCP_PART_1]: 'MRCP Passmedicine 1',
  [USMLEStep.MRCP_PART_2]: 'MRCP Passmedicine 2',
};

export function getStepLabel(step: number): string {
  return STEP_LABELS[step as USMLEStep] ?? `Step ${step}`;
}

export function isExamStep(step: number): step is USMLEStep {
  return ALL_EXAM_STEPS.includes(step as USMLEStep);
}

export function resolveViewerThemeProfileForBankCode(
  code?: string | null,
): ViewerThemeProfile {
  const normalized = String(code || '').trim().toUpperCase();
  // One Exam (onExamination) lives in the MRCP Part 1 track but defaults to the
  // original MedPark viewer, not the Passmedicine one. Check it before the
  // MRCP_PART_1 prefix below.
  if (normalized.startsWith('MRCP_PART_1_ONE_EXAM')) {
    return ViewerThemeProfile.STANDARD_EXAM;
  }
  if (
    normalized.startsWith('MRCP_PART_1') ||
    normalized.startsWith('MRCP_PART_2')
  ) {
    return ViewerThemeProfile.MRCP_PASSMEDICINE;
  }
  if (
    normalized.startsWith('PASTEST') ||
    normalized.startsWith('PAST_PAPERS')
  ) {
    return ViewerThemeProfile.MRCP_PASTEST;
  }
  return ViewerThemeProfile.STANDARD_EXAM;
}

export function resolveViewerThemeProfileSnapshot(
  profiles: Array<ViewerThemeProfile | string | null | undefined>,
): ViewerThemeProfile {
  const normalized = Array.from(
    new Set(
      profiles
        .map((profile) => String(profile || '').trim())
        .filter((profile): profile is ViewerThemeProfile => {
          return Object.values(ViewerThemeProfile).includes(
            profile as ViewerThemeProfile,
          );
        }),
    ),
  );

  if (normalized.length === 1) {
    return normalized[0];
  }

  return ViewerThemeProfile.STANDARD_EXAM;
}

@Entity('question_banks')
@Index(['code'], { unique: true })
@Index(['mainBankId'])
@Index(['step'])
export class QuestionBank {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  mainBankId: number; // FK → main_banks.id

  @Column({ type: 'varchar', length: 100 })
  name: string; // e.g. "UWorld (Step 1)", "NBME 26 (Step 1)"

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string; // e.g. "UWORLD_S1", "NBME_26_S1"

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int' })
  step: USMLEStep;

  @Column({ type: 'int', default: 0 })
  totalQuestions: number;

  @Column({ type: 'boolean', default: true })
  isPremium: boolean;

  @Column({ type: 'boolean', default: false })
  isBlockBank: boolean;

  @Column({ type: 'int', default: 20 })
  blockSize: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  icon: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  gradient: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({
    type: 'varchar',
    length: 32,
    default: ViewerThemeProfile.STANDARD_EXAM,
  })
  viewerThemeProfile: ViewerThemeProfile;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => MainBank, (mb) => mb.questionBanks, { nullable: true })
  @JoinColumn({ name: 'mainBankId' })
  mainBank: MainBank;

  @OneToMany('Question', 'questionBank')
  questions: any[];
}
