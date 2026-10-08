import { ExamIcon } from '../../shared/ExamIcon';

interface AmbossEndBlockDialogProps {
  answered: number;
  unanswered: number;
  marked: number;
  timeLabel: string;
  timeSeconds: number;
  pending: boolean;
  onClose: () => void;
  onReviewUnanswered: () => void;
  onConfirm: () => void;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function AmbossEndBlockDialog({
  answered,
  unanswered,
  marked,
  timeLabel,
  timeSeconds,
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
        <p>Your answers will be finalized. Your results will open after the block is completed.</p>

        <div className="amboss-end-block-stats">
          <div><span>Answered</span><strong>{answered}</strong></div>
          <div><span>Unanswered</span><strong>{unanswered}</strong></div>
          <div><span>Marked</span><strong>{marked}</strong></div>
          <div><span>{timeLabel}</span><strong>{formatTime(timeSeconds)}</strong></div>
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
