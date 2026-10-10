import { useState } from 'react';
import { SafeHtml } from '../../shared/SafeHtml';
import type { ExamRunnerController } from '../../core/useExamRunner';
import { UWorldOptions } from './UWorldOptions';
import { UWorldResultSummary } from './UWorldResultSummary';

export function UWorldQuestionPane({ controller: c }: { controller: ExamRunnerController }) {
  const [pendingOption, setPendingOption] = useState<number | null>(null);
  const q = c.currentQuestion;
  if (!q || !c.test) return null;
  const authorizedReveal = c.isRevealed && (c.isTutorLike || c.isCompleted);
  const correctId = authorizedReveal
    ? c.currentReveal?.correctOptionId ??
      c.currentReveal?.explanation.options.find(opt => opt.isCorrect)?.id ??
      q.options.find(opt => opt.isCorrect)?.id ?? null
    : null;
  const chosen = c.isTimed || c.isCompleted || authorizedReveal ? c.selectedOptionId : pendingOption;
  const locked = c.isCompleted || c.isSuspended || authorizedReveal || c.showAnswerMutation.isPending;
  const submitting = c.showAnswerMutation.isPending;
  return (
    <section className="uw-question-pane" aria-label="Question and answers">
      <SafeHtml html={q.textHtml} className="uw-stem" />
      <UWorldOptions options={q.options} selectedId={chosen} correctId={correctId}
        revealed={authorizedReveal} locked={locked}
        onChoose={(id) => c.isTimed ? c.selectOption(id) : setPendingOption(id)} />
      {c.isTutorLike && !authorizedReveal && !c.isCompleted ? (
        <div className="uw-answer-buttons">
          <button className="uw-submit" type="button" disabled={pendingOption == null || locked}
            onClick={() => pendingOption != null && c.selectOption(pendingOption)}>
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
          <button type="button" className="uw-omit" disabled={locked} onClick={c.showAnswer}>
            Show answer without selecting
          </button>
        </div>
      ) : null}
      {c.isTimed && !c.isCompleted ? (
        <p className="uw-save-note" role="status">
          {c.timedDraftError || 'Selections save within the block. Answers appear after completion.'}
        </p>
      ) : null}
      <UWorldResultSummary controller={c} />
    </section>
  );
}
