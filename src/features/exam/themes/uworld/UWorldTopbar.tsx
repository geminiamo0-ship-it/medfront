import type { ExamRunnerController } from '../../core/useExamRunner';
import { ExamIcon, type ExamIconName } from '../../shared/ExamIcon';
export type UWorldTool = 'calculator' | 'labs' | 'notes' | 'shortcuts' | 'library' | 'flashcards' | 'feedback';

interface Props {
  controller: ExamRunnerController;
  onToggleSidebar: () => void;
  onSettings: () => void;
  onTool: (tool: UWorldTool) => void;
  onFullscreen: () => void;
}
function IconButton({ label, icon, onClick }: { label: string; icon: ExamIconName; onClick: () => void }) {
  return <button className="uw-bar-action" type="button" aria-label={label} title={label} onClick={onClick}>
    <ExamIcon name={icon} size={22} /><span>{label}</span>
  </button>;
}
export function UWorldTopbar({ controller: c, onToggleSidebar, onSettings, onTool, onFullscreen }: Props) {
  const question = c.currentQuestion;
  return (
    <header className="uw-topbar">
      <div className="uw-top-left">
        <button type="button" className="uw-top-menu" aria-label="Toggle navigator" onClick={onToggleSidebar}>
          <ExamIcon name="menu" size={25} />
        </button>
        <div className="uw-item-index">
          <strong>Item {c.currentIndex + 1} of {c.test?.totalQuestions ?? 0}</strong>
          <small>Question Id: {question?.externalId ?? question?.id}</small>
        </div>
        <button type="button" className={'uw-mark' + (question && c.isQuestionMarked(question) ? ' is-marked' : '')}
          onClick={c.toggleCurrentMark} disabled={!question || c.markMutation.isPending}
          aria-pressed={!!question && c.isQuestionMarked(question)}>
          <ExamIcon name="mark" size={23} /><span>Mark</span>
        </button>
      </div>
      <nav className="uw-top-center" aria-label="Question order">
        <button type="button" className="uw-bar-action" onClick={c.goPrevious} disabled={c.currentIndex <= 0}>
          <ExamIcon name="previous" size={22} /><span>Previous</span>
        </button>
        <button type="button" className="uw-bar-action" onClick={c.goNext}
          disabled={!c.test || c.currentIndex >= c.test.questions.length - 1}>
          <ExamIcon name="next" size={22} /><span>Next</span>
        </button>
      </nav>
      <nav className="uw-top-right" aria-label="Exam tools">
        <IconButton label="Shortcuts" icon="shortcuts" onClick={() => onTool('shortcuts')} />
        <IconButton label="Full Screen" icon="full-screen" onClick={onFullscreen} />
        <IconButton label="Marker" icon="marker" onClick={() => onTool('shortcuts')} />
        <IconButton label="Lab Values" icon="lab-values" onClick={() => onTool('labs')} />
        <IconButton label="Notes" icon="notes" onClick={() => onTool('notes')} />
        <IconButton label="Calculator" icon="calculator" onClick={() => onTool('calculator')} />
        <IconButton label="Settings" icon="settings" onClick={onSettings} />
      </nav>
    </header>
  );
}
