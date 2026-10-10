import type { ExamRunnerController } from '../../core/useExamRunner';
import { formatTime } from './uworldUtils';
interface Props { controller: ExamRunnerController; onClose: () => void; }
export function UWorldEndDialog({ controller: c, onClose }: Props) {
  const pending = c.completeTestMutation.isPending || c.timedBlockMutation.isPending;
  const firstUnanswered = c.test?.questions.find(q => c.getSelectedOptionId(q) === null);
  return <div className="uw-dialog-backdrop" onMouseDown={pending ? undefined : onClose}>
    <section className="uw-dialog" role="dialog" aria-modal="true" aria-label="End this block?"
      onMouseDown={e => e.stopPropagation()}>
      <h2>End this block?</h2>
      <p>Your current answers will be finalized before Results opens.</p>
      <div className="uw-dialog-stats">
        <span>Answered <b>{c.answeredCount}</b></span>
        <span>Unanswered <b>{c.unansweredCount}</b></span>
        <span>Marked <b>{c.markedCount}</b></span>
        <span>Time <b>{formatTime(c.timerSeconds)}</b></span>
      </div>
      <div className="uw-dialog-actions">
        <button type="button" onClick={onClose} disabled={pending}>Cancel</button>
        <button type="button" disabled={!firstUnanswered || pending} onClick={() => {
          if (firstUnanswered) c.goToQuestion(firstUnanswered.id);
          onClose();
        }}>Review unanswered</button>
        <button type="button" className="is-danger" disabled={pending} onClick={c.endBlock}>
          {pending ? 'Finishing…' : 'End block now'}
        </button>
      </div>
    </section>
  </div>;
}
