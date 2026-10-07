import { useMemo } from 'react';
import { stripHtml } from '@/lib/sanitize';
import type { ExamQuestion, ExamTest } from '../../types';
import { ExamIcon } from '../../shared/ExamIcon';
import { DifficultyHammers } from './DifficultyHammers';
import { parseAmbossQuestionHtml } from './ambossMarkup';

interface AmbossSidebarProps {
  test: ExamTest;
  currentQuestionId: number;
  open: boolean;
  onToggle: () => void;
  onSelect: (questionId: number) => void;
  onExit: () => void;
  isMarked: (question: ExamQuestion) => boolean;
  getSelectedOptionId: (question: ExamQuestion) => number | null;
  timerSeconds: number;
  questionTimerSeconds: number;
  timerCountsDown: boolean;
  paused: boolean;
}

type SidebarQuestionStatus = 'unanswered' | 'selected' | 'correct' | 'incorrect' | 'omitted';

function questionStatus(
  test: ExamTest,
  question: ExamQuestion,
  selectedOptionId: number | null,
): SidebarQuestionStatus {
  const canShowResults = test.type !== 'timed' || test.status === 'completed';
  if (question.isOmitted) return 'omitted';
  if (canShowResults && question.userAnswer?.isCorrect === true) return 'correct';
  if (canShowResults && question.userAnswer?.isCorrect === false) return 'incorrect';
  if (selectedOptionId != null) return 'selected';
  return 'unanswered';
}

const STATUS_LABEL: Record<SidebarQuestionStatus, string> = {
  unanswered: 'Unanswered',
  selected: 'Selected',
  correct: 'Correct',
  incorrect: 'Incorrect',
  omitted: 'Omitted',
};
const STATUS_GLYPH: Record<SidebarQuestionStatus, string> = {
  unanswered: '•',
  selected: '●',
  correct: '✓',
  incorrect: '×',
  omitted: '○',
};

function questionPreview(question: ExamQuestion): string {
  const { stemHtml } = parseAmbossQuestionHtml(question.textHtml);
  return stripHtml(stemHtml).replace(/\s+/g, ' ').trim() || `Question ${question.displayOrder}`;
}

function formatTimer(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function AmbossSidebar({
  test,
  currentQuestionId,
  open,
  onToggle,
  onSelect,
  onExit,
  isMarked,
  getSelectedOptionId,
  timerSeconds,
  questionTimerSeconds,
  timerCountsDown,
  paused,
}: AmbossSidebarProps) {
  // Parse complex imported HTML once per test snapshot, not on each 1s timer tick.
  const previews = useMemo(
    () => new Map(test.questions.map((question) => [question.id, questionPreview(question)])),
    [test.questions],
  );

  const selectedCount = test.questions.filter(
    (question) => getSelectedOptionId(question) != null,
  ).length;
  const progress = test.totalQuestions > 0
    ? Math.min(100, Math.round((selectedCount / test.totalQuestions) * 100))
    : 0;

  return (
    <aside className={open ? 'amboss-sidebar is-open' : 'amboss-sidebar'} aria-label="Session questions">
      <div className="amboss-sidebar-head">
        <strong title={test.title || 'Custom session'}>{test.title || 'Custom session'}</strong>
        <button
          type="button"
          className="amboss-sidebar-toggle"
          onClick={onToggle}
          aria-label="Toggle session sidebar"
        >
          <ExamIcon name="previous" size={19} />
        </button>
        <div className="amboss-sidebar-progress-label">
          {selectedCount}/{test.totalQuestions}
        </div>
        <div
          className="amboss-sidebar-progress"
          role="progressbar"
          aria-label="Questions answered or selected"
          aria-valuenow={selectedCount}
          aria-valuemin={0}
          aria-valuemax={test.totalQuestions}
        >
          <div style={{ width: `${progress}%` }} />
        </div>
      </div>

      <nav className="amboss-question-list" aria-label="Question navigation">
        {test.questions.map((question) => {
          const active = question.id === currentQuestionId;
          const selectedOptionId = getSelectedOptionId(question);
          const status = questionStatus(test, question, selectedOptionId);
          const preview = previews.get(question.id) || `Question ${question.displayOrder}`;
          const marked = isMarked(question);

          return (
            <button
              type="button"
              key={question.id}
              className={active ? 'amboss-question-row is-active' : 'amboss-question-row'}
              onClick={() => onSelect(question.id)}
              aria-current={active ? 'step' : undefined}
              aria-label={`Question ${question.displayOrder}: ${preview}. ${STATUS_LABEL[status]}.${marked ? ' Marked.' : ''}`}
              title={preview}
            >
              <span
                className={`amboss-question-state is-${status}`}
                aria-label={STATUS_LABEL[status]}
              >
                {STATUS_GLYPH[status]}
              </span>
              <span className="amboss-question-number">{question.displayOrder}</span>
              <span className="amboss-question-title">{preview}</span>
              <DifficultyHammers tier={question.difficultyTier} />
              <span className={marked ? 'amboss-mini-flag is-marked' : 'amboss-mini-flag'} aria-label={marked ? 'Marked' : 'Not marked'}>
                <ExamIcon name="mark" size={15} />
              </span>
            </button>
          );
        })}
      </nav>

      <div className="amboss-sidebar-footer">
        <div className="amboss-sidebar-timer-cell">
          <span className={paused ? 'amboss-sidebar-time is-paused' : 'amboss-sidebar-time'}>
            <ExamIcon name="timer" size={20} />
            <strong>{formatTimer(timerSeconds)}</strong>
          </span>
          <small>{timerCountsDown ? 'REMAINING' : 'SESSION'}</small>
        </div>
        <div className="amboss-sidebar-timer-cell">
          <span className="amboss-sidebar-time">
            <strong>{formatTimer(questionTimerSeconds)}</strong>
          </span>
          <small>QUESTION</small>
        </div>
        <button type="button" className="amboss-sidebar-exit" onClick={onExit}>
          EXIT SESSION
        </button>
      </div>
    </aside>
  );
}
