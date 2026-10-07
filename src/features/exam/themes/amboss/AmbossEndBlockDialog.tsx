import { ExamIcon } from '../../shared/ExamIcon';

interface AmbossEndBlockDialogProps {
  answered: number;
  unanswered: number;
  marked: number;
  remainingSeconds: number;
  pending: boolean;
  onClose: () => void;
  onReviewUnanswered: () => void;
  onConfirm: () => void;
}

function formatRemaining(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function AmbossEndBlockDialog({
  answered,
  unanswered,
  marked,
  remainingSeconds,
  pending,
  onClose,
  onReviewUnanswered,
  onConfirm,
}: AmbossEndBlockDialogProps) {
  return (
    <div className="amboss-dialog-backdrop" role="presentation" onMouseDown={pending ? undefined : onClose}>
      <section
        className="amboss-dialog amboss-end-block-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="amboss-end-block-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="amboss-dialog-close"
          onClick={onClose}
          disabled={pending}
          aria-label="Close End Block"
        >
          <ExamIcon name="close" size={20} />
        </button>
        <div className="amboss-end-block-icon">
          <ExamIcon name="end-block" size={26} />
        </div>
        <h2 id="amboss-end-block-title">End this block?</h2>
        <p>Your answers will be submitted and the block will move into review.</p>

        <div className="amboss-end-block-stats">
          <div><span>Answered</span><strong>{answered}</strong></div>
          <div><span>Unanswered</span><strong>{unanswered}</strong></div>
          <div><span>Marked</span><strong>{marked}</strong></div>
          <div><span>Time left</span><strong>{formatRemaining(remainingSeconds)}</strong></div>
        </div>

        <div className="amboss-end-block-actions">
          <button type="button" onClick={onClose} disabled={pending}>Cancel</button>
          <button
            type="button"
            onClick={onReviewUnanswered}
            disabled={pending || unanswered === 0}
          >
            Review unanswered
          </button>
          <button type="button" className="is-danger" onClick={onConfirm} disabled={pending}>
            {pending ? 'Ending block…' : 'End block now'}
          </button>
        </div>
      </section>
    </div>
  );
}
