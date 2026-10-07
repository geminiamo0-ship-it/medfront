import { api } from '@/api/client';
import type {
  ExamExplanationResponse,
  ExamTest,
  LabValuesByCategory,
  QuestionNote,
  SubmitAnswerResponse,
  TimedBatchAnswer,
  TimedBatchResponse,
} from './types';

export function getExamTest(testId: number) {
  return api.get<ExamTest>(`/tests/${testId}`);
}

export function submitExamAnswer(
  testId: number,
  payload: {
    questionId: number;
    selectedOptionId?: number | null;
    timeSpentSeconds?: number;
    answerSequence?: number[];
  },
) {
  return api.post<SubmitAnswerResponse>(`/tests/${testId}/submit`, payload);
}

export function submitTimedExamBlock(
  testId: number,
  answers: TimedBatchAnswer[],
  totalTimeSpentSeconds?: number,
) {
  return api.post<TimedBatchResponse>(`/tests/${testId}/submit-batch`, {
    answers,
    complete: true,
    totalTimeSpentSeconds,
  });
}

export function getExamExplanation(testId: number, questionId: number) {
  return api.get<ExamExplanationResponse>(
    `/tests/${testId}/questions/${questionId}/explanation`,
  );
}

export function setExamQuestionMark(testId: number, questionId: number, isMarked: boolean) {
  return api.patch<{ ok: boolean; isMarked: boolean }>(`/tests/${testId}/mark`, {
    questionId,
    isMarked,
  });
}

export function getQuestionNote(questionId: number) {
  return api.get<QuestionNote | null>(`/notes/question/${questionId}`);
}

export function saveQuestionNote(questionId: number, content: string) {
  return api.post<QuestionNote>('/notes', { questionId, content });
}

export function getLabValues() {
  return api.get<LabValuesByCategory>('/lab-values');
}
