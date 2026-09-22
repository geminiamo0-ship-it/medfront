import { api } from './client';

export interface MainBank {
  id: number;
  name: string;
  code: string;
  displayOrder: number;
  isPremium: boolean;
  isLocked: boolean;
}

export interface PerformanceSummary {
  totalTests: number;
  questionsAnswered: number;
  correctAnswers: number;
  accuracy: string;
  avgChanges: string;
  guessRate: string;
  qbankUsage: string | number;
  totalAvailable: number;
}

export interface PerformanceOverview {
  success: boolean;
  data: {
    summary: PerformanceSummary;
    behavioral: Record<string, unknown>;
    subjectStats: unknown[];
    systemStats: unknown[];
    timeline: Array<{ date: string; total: number; correct: number; accuracy: string | number }>;
    advanced: unknown;
  };
}

export function getMainBanks(step: number) {
  return api.get<MainBank[]>('/tests/metadata/main-banks', { params: { step } });
}

export function getPerformanceOverview(step: number) {
  return api.get<PerformanceOverview>('/tests/performance/overview', { params: { step } });
}

export interface QuestionBank {
  id: number;
  code: string;
  step: number;
  name?: string;
}

export interface SystemWithTopics {
  id: number;
  name: string;
  topics?: Array<{ id: number; name: string }>;
}

export function getQuestionBanks() {
  return api.get<QuestionBank[]>('/tests/metadata/question-banks');
}

export function getSystemsWithTopics(step: number, filters: Record<string, unknown>) {
  return api.post<SystemWithTopics[]>('/tests/metadata/systems-with-topics', { step, filters });
}

export function createTest(payload: Record<string, unknown>) {
  return api.post<{ id: number }>('/tests', payload);
}