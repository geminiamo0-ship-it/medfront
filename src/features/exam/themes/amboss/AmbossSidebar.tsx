import type { ExamQuestion, ExamTest } from '../../types';
import { ExamIcon } from '../../shared/ExamIcon';
import { DifficultyHammers } from './DifficultyHammers';

interface AmbossSidebarProps {
  test: ExamTest;
  currentQuestionId: number;
  open: boolean;
  onToggle: () => void;
  onSelect: (questionId: number) => void;
  isMarked: (question: ExamQuestion) => boolean;
  getSelectedOptionId: (question: ExamQuestion) => number | null;
  timerSeconds: number;
  timerCountsDown: boolean;
  paused: boolean;
}

function questionStatus(question: ExamQuestion, selectedOptionId: number | null) {
  if (question.isOmitted) return '○';
  if (question.userAnswer?.isCorrect === true) return '✓';
  if (question.userAnswer?.isCorrect === false) return '×';
  if (selectedOptionId != null) return '●';
  return '•';
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
  isMarked,
  getSelectedOptionId,
  timerSeconds,
  timerCountsDown,
  paused,
}: AmbossSidebarProps) {
  return (
    <aside className={open ? 'amboss-sidebar is-open' : 'amboss-sidebar'}>
      <div className="amboss-sidebar-head">
        <strong>{test.title || 'Custom session'}</strong>
        <button type="button" className="amboss-sidebar-toggle" onClick={onToggle} aria-label="Toggle session sidebar">
          <ExamIcon name="close" size={16} />
        </button>
        <span>{test.answeredQuestions}/{test.totalQuestions}</span>
      </div>

      <div className="amboss-question-list">
        {test.questions.map((question) => {
          const active = question.id === currentQuestionId;
          const selectedOptionId = getSelectedOptionId(question);
          const selectedDraft = selectedOptionId != null && question.userAnswer?.isCorrect === undefined;
          return (
            <button
              type="button"
              key={question.id}
              className={active ? 'amboss-question-row is-active' : 'amboss-question-row'}
              onClick={() => onSelect(question.id)}
            >
              <span
                className={[
                  'amboss-question-state',
                  question.status !== 'unanswered' ? 'is-done' : '',
                  selectedDraft ? 'is-selected-draft' : '',
                ].filter(Boolean).join(' ')}
              >
                {questionStatus(question, selectedOptionId)}
              </span>
              <span className="amboss-question-number">{question.displayOrder}</span>
              <span className="amboss-question-title">
                {active ? `Question ${question.displayOrder}` : ''}
              </span>
              <DifficultyHammers tier={question.difficultyTier} />
              <span className={isMarked(question) ? 'amboss-mini-flag is-marked' : 'amboss-mini-flag'}>
                <ExamIcon name="mark" size={15} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="amboss-sidebar-footer">
        <div>
          <span className={paused ? 'amboss-sidebar-time is-paused' : 'amboss-sidebar-time'}>
            <ExamIcon name="timer" size={16} />
            <strong>{formatTimer(timerSeconds)}</strong>
          </span>
          <small>{paused ? 'PAUSED' : timerCountsDown ? 'REMAINING' : test.type === 'tutor' ? 'SOLVING' : 'SESSION'}</small>
        </div>
        <div>
          <strong>{test.type.toUpperCase()}</strong>
          <small>MODE</small>
        </div>
        <button type="button">EXIT SESSION</button>
      </div>
    </aside>
  );
}
