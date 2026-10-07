export type ExamTestType = 'tutor' | 'timed' | 'mixed' | 'custom';
export type ExamTestStatus = 'not_started' | 'in_progress' | 'suspended' | 'completed' | 'abandoned';
export type QuestionDifficultyTier = 'very_easy' | 'easy' | 'medium' | 'hard' | 'very_hard';

export interface ExamQuestionBank {
  id: number;
  mainBankId: number | null;
  name: string;
  code: string;
  viewerThemeProfile?: string | null;
}

export interface ExamOption {
  id: number;
  textHtml: string;
  displayOrder: string;
  isCorrect?: boolean;
  explanationHtml?: string | null;
  uworldChosenBy?: number | null;
}

export interface ExamUserAnswer {
  selectedOptionId: number | null;
  isCorrect?: boolean;
  timeSpentSeconds: number;
  answerChanges: number;
}

export interface ExamQuestion {
  id: number;
  externalId: string | null;
  displayOrder: number;
  textHtml: string;
  explanationHtml?: string;
  difficulty?: string | null;
  difficultyTier?: QuestionDifficultyTier | null;
  estimatedTimeSeconds: number;
  questionBank?: ExamQuestionBank | null;
  options: ExamOption[];
  userAnswer: ExamUserAnswer | null;
  isMarked: boolean;
  isAnswered: boolean;
  isOmitted: boolean;
  status: 'answered' | 'omitted' | 'unanswered';
}

export interface ExamTest {
  id: number;
  title: string;
  type: ExamTestType;
  mode: string;
  step: number;
  status: ExamTestStatus;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  timeSpentSeconds: number;
  timeLimitSeconds: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  viewerThemeProfileSnapshot?: string | null;
  filters?: { questionBankIds?: number[] };
  resumeQuestionId: number | null;
  resumeDisplayOrder: number | null;
  omittedQuestionIds: number[];
  blockResultsLocked?: boolean;
  questions: ExamQuestion[];
}

export interface SubmitAnswerResponse {
  submission: {
    selectedOptionId: number | null;
    isCorrect: boolean;
    correctOptionId: number | null;
    timeSpentSeconds: number;
  };
  testStats: {
    answeredQuestions: number;
    correctAnswers: number;
    timeSpentSeconds: number;
    percentageScore: number | null;
  };
  autoCompleted?: boolean;
}

export interface ExamExplanationResponse {
  explanationHtml: string;
  updatedAt: string;
  options: Array<{
    id: number;
    isCorrect: boolean;
    explanationHtml: string | null;
    uworldChosenBy: number | null;
  }>;
}

export interface QuestionNote {
  id: string;
  questionId: number;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LabValue {
  id: string;
  category: string;
  name: string;
  referenceRange: string | null;
  siReferenceInterval: string | null;
}

export type LabValuesByCategory = Record<string, LabValue[]>;

export interface TimedBatchAnswer {
  questionId: number;
  selectedOptionId?: number;
  timeSpentSeconds?: number;
}

export interface TimedBatchResponse {
  status: string;
  completedAt?: string | null;
  answeredQuestions: number;
  correctAnswers: number;
  omittedQuestions: number;
  percentageScore: number;
  timeSpentSeconds: number;
  alreadyCompleted?: boolean;
}
