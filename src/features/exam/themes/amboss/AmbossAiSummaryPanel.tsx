import { ExamIcon } from '../../shared/ExamIcon';

interface AmbossAiSummaryPanelProps {
  open: boolean;
  loading: boolean;
  content?: string | null;
  error?: string | null;
  onClose: () => void;
  onGenerate: () => void;
}

export function AmbossAiSummaryPanel({
  open,
  loading,
  content,
  error,
  onClose,
  onGenerate,
}: AmbossAiSummaryPanelProps) {
  if (!open) return null;

  return (
    <aside className="amboss-ai-summary-panel" aria-label="AI Summary">
      <header>
        <div>
          <small>REVIEW TOOL</small>
          <strong>AI Summary</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Close AI Summary">
          <ExamIcon name="close" size={19} />
        </button>
      </header>

      <div className="amboss-ai-summary-body">
        {loading ? <p>Preparing a concise review…</p> : null}
        {error ? <p className="is-error">{error}</p> : null}
        {!loading && !error && content ? (
          <div className="amboss-ai-summary-copy">{content}</div>
        ) : null}
        {!loading && !content && !error ? (
          <>
            <p>Generate a review summary for the current completed question.</p>
            <button type="button" className="amboss-ai-generate" onClick={onGenerate}>
              <ExamIcon name="ai-summary" size={17} />
              Generate summary
            </button>
          </>
        ) : null}
      </div>
    </aside>
  );
}
