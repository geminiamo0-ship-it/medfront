import type { ExamQuestion, ExamTest } from '../../types';

export function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hh = Math.floor(safe / 3600);
  const mm = Math.floor((safe % 3600) / 60);
  const ss = safe % 60;
  return [hh, mm, ss].map(x => String(x).padStart(2, '0')).join(':');
}

export type UWorldQuestionState = 'unanswered' | 'selected' | 'correct' | 'incorrect' | 'omitted';
export function questionState(
  test: ExamTest, question: ExamQuestion, choice: number | null,
): UWorldQuestionState {
  if (question.isOmitted) return 'omitted';
  const canReveal = test.status === 'completed' || test.type !== 'timed';
  if (canReveal && question.userAnswer?.isCorrect === true) return 'correct';
  if (canReveal && question.userAnswer?.isCorrect === false) return 'incorrect';
  return choice !== null ? 'selected' : 'unanswered';
}
