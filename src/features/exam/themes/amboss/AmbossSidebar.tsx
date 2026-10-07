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
}

function questionStatus(question: ExamQuestion) {
  if (question.isOmitted) return '○';
  if (question.userAnswer?.isCorrect === true) return '✓';
  if (question.userAnswer?.isCorrect === false) return '×';
  return '•';
}

export function AmbossSidebar({
  test,
  currentQuestionId,
  open,
  onToggle,
  onSelect,
  isMarked,
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
          return (
            <button
              type="button"
              key={question.id}
              className={active ? 'amboss-question-row is-active' : 'amboss-question-row'}
              onClick={() => onSelect(question.id)}
            >
              <span className={question.status === 'unanswered' ? 'amboss-question-state' : 'amboss-question-state is-done'}>
                {questionStatus(question)}
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
          <span className="amboss-sidebar-time">
            <ExamIcon name="timer" size={16} />
            <strong>{Math.floor(test.timeSpentSeconds / 3600)}h {String(Math.floor((test.timeSpentSeconds % 3600) / 60)).padStart(2, '0')}m</strong>
          </span>
          <small>SESSION</small>
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
