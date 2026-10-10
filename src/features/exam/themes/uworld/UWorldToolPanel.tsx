import { useEffect } from 'react';
import type { ExamRunnerController } from '../../core/useExamRunner';
import { ExamIcon } from '../../shared/ExamIcon';
import { UWorldCalculator } from './UWorldCalculator';
import { UWorldNotes } from './UWorldNotes';
import { UWorldLabs } from './UWorldLabs';
import type { UWorldTool } from './UWorldTopbar';

interface Props { controller: ExamRunnerController; tool: UWorldTool | null; onClose: () => void; }
const LABELS: Record<UWorldTool, string> = {
  calculator: 'Calculator', labs: 'Lab Values', notes: 'Notes', shortcuts: 'Keyboard Shortcuts',
  library: 'Medical Library', flashcards: 'Flashcards', feedback: 'Question Feedback', ai: 'Consult AI Tutor',
};
export function UWorldToolPanel({ controller: c, tool, onClose }: Props) {
  useEffect(() => {
    if (!tool) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tool, onClose]);
  if (!tool) return null;
  const articleId = c.currentQuestion?.articleId;
  return <div className="uw-tool-backdrop" onMouseDown={onClose}>
    <aside className="uw-tool-panel" role="dialog" aria-modal="true" aria-label={LABELS[tool]}
      onMouseDown={e => e.stopPropagation()}>
      <header><strong>{LABELS[tool]}</strong>
        <button type="button" onClick={onClose} aria-label={'Close ' + LABELS[tool]}>
          <ExamIcon name="close" size={19}/></button>
      </header>
      <div className="uw-tool-content">
        {tool === 'ai' ? (
          <section aria-label="AI question review">
            {c.aiSummaryQuery.isFetching ? <p>Generating AI review…</p> : null}
            {c.aiSummaryQuery.isError ? <p role="alert">AI Tutor could not respond. Please retry.</p> : null}
            {c.aiSummary?.content ? <p>{c.aiSummary.content}</p> : null}
            {!c.aiSummaryQuery.isFetching ? <button type="button" className="uw-tool-primary" onClick={c.loadAiSummary}>Generate review</button> : null}
          </section>
        ) : null}
        {tool === 'calculator' ? <UWorldCalculator /> : null}
        {tool === 'notes' ? <UWorldNotes controller={c} /> : null}
        {tool === 'labs' ? <UWorldLabs controller={c} /> : null}
        {tool === 'shortcuts' ? <p>Use Previous and Next in the top bar, or navigate directly from the question list. Select text with Marker enabled to highlight.</p> : null}
        {tool === 'library' ? articleId
          ? <a href={`/library?source=uworld&article=${encodeURIComponent(articleId)}`} target="_blank" rel="noopener noreferrer">Open linked medical article</a>
          : <p>No linked article is available for this question.</p> : null}
        {tool === 'flashcards' ? <p>Question-linked flashcard creation is not available from this exam view yet.</p> : null}
        {tool === 'feedback' ? <p>Please report issues to MedPark support with Question ID {c.currentQuestion?.externalId ?? c.currentQuestion?.id}.</p> : null}
      </div>
    </aside>
  </div>;
}
