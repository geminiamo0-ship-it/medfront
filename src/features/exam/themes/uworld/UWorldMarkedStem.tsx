import { useEffect, useRef } from 'react';
import { SafeHtml } from '../../shared/SafeHtml';
import { applyQuestionHighlights, selectionToQuestionHighlight } from '../../shared/questionMarkers';
import type { ExamRunnerController } from '../../core/useExamRunner';

interface Props { controller: ExamRunnerController; markerActive: boolean; }
export function UWorldMarkedStem({ controller: c, markerActive }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const highlights = c.currentQuestionHighlights;
  const q = c.currentQuestion;
  useEffect(() => {
    if (ref.current) applyQuestionHighlights(ref.current, highlights);
  }, [q?.id, q?.textHtml, highlights]);
  if (!q) return null;
  return <div className={markerActive ? 'uw-marker-active' : ''} onMouseUp={() => {
    if (!markerActive || !ref.current || c.highlightMutation.isPending) return;
    const highlight = selectionToQuestionHighlight(ref.current, '#ffe36e');
    if (!highlight) return;
    c.saveQuestionHighlights(q.id, [...highlights, highlight]);
    window.getSelection()?.removeAllRanges();
  }}>
    <SafeHtml html={q.textHtml} ref={ref} className="uw-stem" />
  </div>;
}
