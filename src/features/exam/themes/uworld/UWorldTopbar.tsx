import type { ExamRunnerController } from '../../core/useExamRunner';
import type { ExamIconName } from '../../shared/ExamIcon';
import { UWorldTopbarIcon } from './UWorldTopbarIcon';

export type UWorldTool = 'calculator' | 'labs' | 'notes' | 'shortcuts' | 'library' | 'flashcards' | 'feedback' | 'ai';

interface Props {
  controller: ExamRunnerController;
  onToggleSidebar: () => void;
  onSettings: () => void;
  onTool: (tool: UWorldTool) => void;
  onFullscreen: () => void;
  markerActive: boolean;
  onMarker: () => void;
}

function ToolButton({ label, icon, onClick }: {
  label: string; icon: ExamIconName; onClick: () => void;
}) {
  return (
    <button type="button" className="uw-bar-action uw-top-tool" aria-label={label}
      title={label} onClick={onClick}>
      <UWorldTopbarIcon name={icon} size={22}/>
      <span>{label}</span>
    </button>
  );
}

export function UWorldTopbar({ controller: c, onToggleSidebar, onSettings,
  onTool, onFullscreen, markerActive, onMarker }: Props) {
  const question = c.currentQuestion;
  const isMarked = !!question && c.isQuestionMarked(question);

  return (
    <header className="uw-topbar" aria-label="Exam top toolbar">
      <div className="uw-top-left">
        <button type="button" className="uw-top-menu" aria-label="Toggle navigator"
          title="Questions" onClick={onToggleSidebar}>
          <UWorldTopbarIcon name="menu" size={23}/>
        </button>
        <div className="uw-item-index">
          <strong>Item {c.currentIndex + 1} of {c.test?.totalQuestions ?? 0}</strong>
          <small>Question Id: {question?.externalId ?? question?.id}</small>
        </div>
        <button type="button" className={'uw-mark' + (isMarked ? ' is-marked' : '')}
          title={isMarked ? 'Unmark question' : 'Mark question'} aria-label="Mark"
          onClick={c.toggleCurrentMark} disabled={!question || c.markMutation.isPending}
          aria-pressed={isMarked}>
          <UWorldTopbarIcon name="mark" size={24}/>
          <span>Mark</span>
        </button>
      </div>

      <nav className="uw-top-center" aria-label="Question navigation">
        <button type="button" className="uw-bar-action uw-top-navigation"
          aria-label="Previous" title="Previous" onClick={c.goPrevious}
          disabled={c.currentIndex <= 0}>
          <UWorldTopbarIcon name="previous" size={20}/>
          <span>Previous</span>
        </button>
        <button type="button" className="uw-bar-action uw-top-navigation"
          aria-label="Next" title="Next" onClick={c.goNext}
          disabled={!c.test || c.currentIndex >= c.test.questions.length - 1}>
          <UWorldTopbarIcon name="next" size={20}/>
          <span>Next</span>
        </button>
      </nav>

      <nav className="uw-top-right" aria-label="Exam tools">
        <ToolButton label="Shortcuts" icon="shortcuts" onClick={() => onTool('shortcuts')}/>
        <ToolButton label="Full Screen" icon="full-screen" onClick={onFullscreen}/>
        <button type="button" className={'uw-bar-action uw-top-tool' + (markerActive ? ' is-active' : '')}
          onClick={onMarker} aria-label="Marker" aria-pressed={markerActive}
          title="Select text to highlight">
          <UWorldTopbarIcon name="marker" size={22}/>
          <span>Marker</span>
        </button>
        <ToolButton label="Lab Values" icon="lab-values" onClick={() => onTool('labs')}/>
        <ToolButton label="Notes" icon="notes" onClick={() => onTool('notes')}/>
        <ToolButton label="Calculator" icon="calculator" onClick={() => onTool('calculator')}/>
        <ToolButton label="Settings" icon="settings" onClick={onSettings}/>
      </nav>
    </header>
  );
}
