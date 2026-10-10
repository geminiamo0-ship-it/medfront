import type { ExamRunnerController } from '../../core/useExamRunner';
import { ExamIcon, type ExamIconName } from '../../shared/ExamIcon';
import { formatTime } from './uworldUtils';
import type { UWorldTool } from './UWorldTopbar';
interface Props {
  controller: ExamRunnerController;
  onTool: (tool: UWorldTool) => void;
  onSuspend: () => void;
  onEnd: () => void;
}
const items: Array<{ name: string; icon: ExamIconName; tool: UWorldTool }> = [
  { name: 'Medical Library', icon: 'library', tool: 'library' },
  { name: 'Notebook', icon: 'notebook', tool: 'notes' },
  { name: 'Flashcards', icon: 'flashcards', tool: 'flashcards' },
  { name: 'Feedback', icon: 'feedback', tool: 'feedback' },
];
export function UWorldBottomBar({ controller: c, onTool, onSuspend, onEnd }: Props) {
  const pending = c.suspendMutation.isPending || c.resumeMutation.isPending || c.completeTestMutation.isPending || c.timedBlockMutation.isPending;
  return <footer className="uw-bottombar">
    <div className="uw-bottom-status">
      <ExamIcon name="tools" size={17} />
      <span><strong>{c.timerCountsDown ? 'Block Time Remaining' : 'Block Time Elapsed'}: {formatTime(c.timerSeconds)}</strong>
        <small>{c.test?.type.toUpperCase()}{c.timerPaused ? ' · PAUSED' : ''}</small>
      </span>
    </div>
    <nav className="uw-bottom-tools" aria-label="Block tools">
      {items.map(item => (
        <button className="uw-bar-action" type="button" key={item.tool} onClick={() => onTool(item.tool)}>
          <ExamIcon name={item.icon} size={21}/><span>{item.name}</span>
        </button>
      ))}
      {!c.isCompleted ? (
        <button className="uw-bar-action" type="button" onClick={c.isSuspended ? c.resumeTest : onSuspend} disabled={pending}>
          <ExamIcon name={c.isSuspended ? 'resume' : 'suspend'} size={21}/><span>{c.isSuspended ? 'Resume' : 'Suspend'}</span>
        </button>
      ) : null}
      {!c.isCompleted && !c.isSuspended ? (
        <button className="uw-bar-action uw-end" type="button" disabled={pending} onClick={onEnd}>
          <ExamIcon name="end-block" size={21}/><span>End Block</span>
        </button>
      ) : null}
    </nav>
  </footer>;
}
