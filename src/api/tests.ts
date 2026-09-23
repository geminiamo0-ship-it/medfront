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

export interface QuestionBankWithProgress {
  id: number;
  mainBankId: number | null;
  name: string;
  code: string;
  description: string | null;
  step: number;
  totalQuestions: number;
  usedQuestions: number;
  isPremium: boolean;
  isBlockBank: boolean;
  blockSize: number;
  icon: string | null;
  gradient: string | null;
  displayOrder: number;
  isLocked: boolean;
}

/**
 * Question banks underneath a main bank (provider), with the caller's
 * progress. Omit both params to get every active bank across all steps;
 * pass `step` (+ optionally `mainBankId`) to scope the list.
 */
export function getQuestionBanks(step?: number, mainBankId?: number) {
  const params: Record<string, number> = {};
  if (step !== undefined) params.step = step;
  if (mainBankId !== undefined) params.mainBankId = mainBankId;
  return api.get<QuestionBankWithProgress[]>('/tests/metadata/question-banks', { params });
}

/** POST /tests/counts/mixed — exact deduplicated count across combined modes. */
export function getMixedModeCount(step: number, filters: Record<string, unknown>) {
  return api.post<{ count: number }>('/tests/counts/mixed', { step, filters });
}

export type DifficultyTier = 'very_hard' | 'hard' | 'medium' | 'easy' | 'very_easy';

/** POST /tests/metadata/difficulty-counts — per-tier counts for a bank set. */
export function getDifficultyCounts(step: number, questionBankIds: number[]) {
  return api.post<Record<DifficultyTier, number>>('/tests/metadata/difficulty-counts', {
    step,
    questionBankIds,
  });
}

export interface SystemWithTopics {
  id: number;
  name: string;
  topics?: Array<{ id: number; name: string }>;
}

export interface QbankStatistics {
  success: boolean;
  data: {
    qBankName: string;
    score: { percentage: string; totalCorrect: number; totalIncorrect: number; totalOmitted: number };
    answerChanges: { correctToIncorrect: number; incorrectToCorrect: number; incorrectToIncorrect: number };
    usage: { percentage: string; usedQuestions: number; unusedQuestions: number; totalQuestions: number };
    testCount: { created: number; completed: number; suspended: number };
    percentileRank: number;
    medianScore: number;
    medianPercentile: number;
    yourAverageTimeSpent: number;
    othersAverageTimeSpent: number;
  };
}

/** GET /tests/performance/statistics — per-qbank scoreboard (Welcome page). */
export function getQbankStatistics(qBankCode: string, step: number) {
  return api.get<QbankStatistics>('/tests/performance/statistics', {
    params: { qBankCode, step },
  });
}

export interface QuestionCounts {
  all: number;
  unused: number;
  used: number;
  incorrect: number;
  correct: number;
  marked: number;
  marked_correct: number;
  marked_incorrect: number;
  omitted: number;
  suspended: number;
}

/** POST /tests/counts — per-mode question counts for the given filters. */
export function getQuestionCounts(step: number, filters: Record<string, unknown>) {
  return api.post<QuestionCounts>('/tests/counts', { step, filters });
}

export interface SubjectCount {
  id: number;
  name: string;
  displayOrder: number;
  questionCount: number;
  columnIndex: number;
  position: number;
}

/** POST /tests/metadata/subjects — subjects with counts (Create Test page). */
export function getSubjects(step: number, questionBankIds: number[], mode = 'all') {
  return api.post<SubjectCount[]>('/tests/metadata/subjects', {
    step,
    questionBankIds,
    mode,
  });
}

export interface TestListItem {
  id: number;
  title: string;
  type: string;
  mode: string;
  step: number;
  status: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  percentageScore: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/** GET /tests — the user's tests, optionally scoped to step/qbank. */
export function getPreviousTests(step?: number, qBankId?: number) {
  const params: Record<string, number> = {};
  if (step !== undefined) params.step = step;
  if (qBankId !== undefined) params.qBankId = qBankId;
  return api.get<TestListItem[]>('/tests', { params });
}

export function getSystemsWithTopics(step: number, filters: Record<string, unknown>) {
  return api.post<SystemWithTopics[]>('/tests/metadata/systems-with-topics', { step, filters });
}

export function createTest(payload: Record<string, unknown>) {
  return api.post<{ id: number }>('/tests', payload);
}