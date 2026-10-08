import { api } from '@/api/client';

export type DifficultyKey = 'very_easy' | 'easy' | 'medium' | 'hard' | 'very_hard' | 'unclassified';
export interface SessionGroup { total: number; correct: number; incorrect: number; omitted: number; }
export interface SessionDifficultyGroup extends SessionGroup { key: DifficultyKey; }
export interface RecommendedTopic extends SessionGroup { topicId: number; name: string; }
export interface SessionBreakdown {
  totalQuestions: number;
  answeredQuestions: number;
  correctQuestions: number;
  incorrectQuestions: number;
  omittedQuestions: number;
  byDifficultyTier: SessionDifficultyGroup[];
  studyRecommendations: RecommendedTopic[];
}
export interface ResultsTest {
  id: number;
  title: string;
  type: string;
  status: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  omittedQuestions?: number;
  percentageScore: string | number | null;
  timeSpentSeconds: number;
  completedAt?: string | null;
  step: number;
  filters?: { questionBankIds?: number[] } | null;
  blockBankId?: number | null;
}
export interface TestResults {
  test: ResultsTest;
  analytics: {
    overall: {
      totalQuestions: number;
      answeredQuestions: number;
      correctAnswers: number;
      percentageScore: number | string;
      timeSpentSeconds: number;
      averageTimePerQuestion: number;
    };
    sessionBreakdown?: SessionBreakdown;
  };
  analyticsProcessingComplete?: boolean;
}
export function getTestResults(testId: number): Promise<TestResults> {
  return api.get<TestResults>('/tests/' + testId + '/results');
}
