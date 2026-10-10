import type { ExamRunnerController } from '../../core/useExamRunner';
import { ExamIcon } from '../../shared/ExamIcon';
import { questionState } from './uworldUtils';

interface Props {
  controller: ExamRunnerController;
  open: boolean;
  onToggle: () => void;
  onExit: () => void;
  onSelect: (id: number) => void;
}
export function UWorldSidebar({ controller: c, open, onToggle, onExit, onSelect }: Props) {
  if (!c.test) return null;
  return (
    <aside className={'uw-sidebar' + (open ? ' is-open' : '')} aria-label="Question navigator">
      <div className="uw-sidebar-header">
        <button type="button" onClick={onExit} title="Return to Previous Tests" aria-label="Exit exam">
          <ExamIcon name="previous" size={17} />
        </button>
        <button type="button" className="uw-sidebar-close" onClick={onToggle} aria-label="Hide question navigator">
          <ExamIcon name="close" size={15} />
        </button>
      </div>
      <div className="uw-sidebar-questions">
        {c.test.questions.map((q, index) => {
          const status = questionState(c.test!, q, c.getSelectedOptionId(q));
          const marked = c.isQuestionMarked(q);
          const current = c.currentQuestion?.id === q.id;
          return (
            <button
              key={q.id} type="button"
              className={'uw-question-row' + (current ? ' is-current' : '')}
              onClick={() => onSelect(q.id)}
              aria-current={current ? 'step' : undefined}
              aria-label={`Question ${index + 1}: ${status}${marked ? ', marked' : ''}`}
            >
              <span>{index + 1}</span>
              <span className={'uw-question-status is-' + status}>
                {marked ? <ExamIcon name="mark" size={13} /> :
                  status === 'correct' ? '✓' : status === 'incorrect' ? '×' :
                  status === 'unanswered' ? '•' : status === 'omitted' ? '○' : '●'}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
