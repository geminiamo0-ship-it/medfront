import { useEffect, useRef } from 'react';
import { SafeHtml } from '../../shared/SafeHtml';
import type { ExamRunnerController } from '../../core/useExamRunner';

export function UWorldExplanationPane({ controller: c }: { controller: ExamRunnerController }) {
  const q = c.currentQuestion;
  const requested = useRef<number | null>(null);
  useEffect(() => {
    if (c.isCompleted && c.isRevealed && q && requested.current !== q.id) {
      requested.current = q.id;
      c.ensureCurrentReviewExplanation();
    }
  }, [c, q]);
  if (!q || !c.isRevealed) return null;
  const html = c.currentReveal?.explanation.explanationHtml ?? q.explanationHtml ?? '';
  return (
    <section className="uw-explanation-pane" aria-label="Explanation">
      <header className="uw-explanation-header">
        <span className="uw-explanation-tab">Explanation:</span>
        {c.reviewExplanationMutation.isPending ? <small>Loading…</small> : null}
      </header>
      <div className="uw-explanation-content">
        {html ? <SafeHtml html={html} className="uw-explanation-html" /> :
          <p role="status">The explanation is not available yet.</p>}
        {c.reviewExplanationMutation.isError ? (
          <p role="alert">Could not load the explanation. Navigate away and return to retry.</p>
        ) : null}
      </div>
    </section>
  );
}
