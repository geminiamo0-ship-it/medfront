import { useMemo, useState } from 'react';
import type { ExamRunnerController } from '../../core/useExamRunner';
import type { ExamOption } from '../../types';
import { SafeHtml } from '../../shared/SafeHtml';
import { parseAmbossQuestionHtml } from './ambossMarkup';
import { AmbossLabsPanel } from './AmbossLabsPanel';
import { AmbossNotesEditor } from './AmbossNotesEditor';
import { AmbossToolbar } from './AmbossToolbar';

interface ResolvedOption extends ExamOption {
  isCorrect?: boolean;
  explanationHtml?: string | null;
  uworldChosenBy?: number | null;
}

export function AmbossQuestionWorkspace({ controller }: { controller: ExamRunnerController }) {
  const question = controller.currentQuestion;
  const [cluesOn, setCluesOn] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [labsOpen, setLabsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [showAllExplanations, setShowAllExplanations] = useState(false);

  const parsed = useMemo(
    () => parseAmbossQuestionHtml(question?.textHtml ?? ''),
    [question?.textHtml],
  );

  if (!question || !controller.test) return null;

  const revealOptions = controller.currentReveal?.explanation.options ?? [];
  const resolvedOptions: ResolvedOption[] = question.options.map((option) => {
    const reveal = revealOptions.find((item) => item.id === option.id);
    return {
      ...option,
      isCorrect: reveal?.isCorrect ?? option.isCorrect,
      explanationHtml: reveal?.explanationHtml ?? option.explanationHtml,
      uworldChosenBy: reveal?.uworldChosenBy ?? option.uworldChosenBy,
    };
  });

  const marked = controller.isQuestionMarked(question);
  const canReveal = controller.isTutorLike && !controller.isRevealed;

  function openLabs() {
    const next = !labsOpen;
    setLabsOpen(next);
    if (next) controller.ensureLabsLoaded();
  }

  return (
    <>
      <section className={labsOpen ? 'amboss-workspace has-labs' : 'amboss-workspace'}>
        <div className="amboss-question-card">
          <div className="amboss-question-content">
            <div className="amboss-aa">AA</div>
            <SafeHtml
              html={parsed.stemHtml}
              className={cluesOn ? 'amboss-stem amboss-clues-on' : 'amboss-stem'}
            />

            <AmbossNotesEditor
              open={notesOpen}
              note={controller.note}
              loading={controller.noteQuery.isLoading}
              saving={controller.saveNoteMutation.isPending}
              questionId={question.id}
              onClose={() => setNotesOpen(false)}
              onSave={controller.saveCurrentNote}
            />

            <AmbossToolbar
              cluesOn={cluesOn}
              hintOpen={hintOpen}
              hintAvailable={!!parsed.hintHtml}
              labsOpen={labsOpen}
              notesOpen={notesOpen}
              marked={marked}
              onClues={() => setCluesOn((value) => !value)}
              onHint={() => setHintOpen((value) => !value)}
              onLabs={openLabs}
              onNotes={() => setNotesOpen((value) => !value)}
              onMark={controller.toggleCurrentMark}
              onFlashcards={() => setFlashcardsOpen(true)}
            />
          </div>

          {hintOpen && parsed.hintHtml ? (
            <div className="amboss-hint-panel">
              <div className="amboss-hint-badge">✓ HINT USED</div>
              <div className="amboss-hint-row">
                <div className="amboss-doctor-avatar" aria-hidden="true">🩺</div>
                <SafeHtml html={parsed.hintHtml} className="amboss-hint-copy" />
              </div>
            </div>
          ) : null}

          <div className="amboss-options">
            {resolvedOptions.map((option) => {
              const selected = controller.selectedOptionId === option.id;
              const revealed = controller.isRevealed;
              const correct = revealed && option.isCorrect === true;
              const incorrectSelected = revealed && selected && option.isCorrect === false;
              const showExplanation =
                revealed &&
                !!option.explanationHtml &&
                (showAllExplanations || selected || correct);

              const classes = [
                'amboss-option',
                selected ? 'is-selected' : '',
                correct ? 'is-correct' : '',
                incorrectSelected ? 'is-incorrect' : '',
              ].filter(Boolean).join(' ');

              return (
                <button
                  type="button"
                  key={option.id}
                  className={classes}
                  onClick={() => controller.selectOption(option.id)}
                  disabled={revealed}
                >
                  <span className="amboss-option-letter">{option.displayOrder}</span>
                  <span className="amboss-option-main">
                    <SafeHtml html={option.textHtml} className="amboss-option-text" />
                    {showExplanation ? (
                      <SafeHtml html={option.explanationHtml} className="amboss-option-explanation" />
                    ) : null}
                  </span>
                  <span className="amboss-option-stat">
                    {revealed && option.uworldChosenBy != null ? `${option.uworldChosenBy}%` : ''}
                    {correct ? ' ✓' : incorrectSelected ? ' ×' : ''}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="amboss-answer-actions">
            {canReveal ? (
              <button
                type="button"
                className="amboss-show-answer"
                onClick={controller.showAnswer}
                disabled={controller.showAnswerMutation.isPending}
              >
                ☑ {controller.showAnswerMutation.isPending ? 'LOADING ANSWER…' : 'SHOW ANSWER'}
              </button>
            ) : controller.isRevealed ? (
              <button
                type="button"
                className="amboss-show-answer"
                onClick={() => setShowAllExplanations((value) => !value)}
              >
                ↕ {showAllExplanations ? 'HIDE ALL EXPLANATIONS' : 'SHOW ALL EXPLANATIONS'}
              </button>
            ) : (
              <span className="amboss-timed-message">
                {controller.isTimed ? 'Answers are reviewed when the timed block ends.' : ''}
              </span>
            )}
            <div className="amboss-answer-secondary">
              <span>↶ RESET QUESTION</span>
              <span>◉ HIDE STATS</span>
            </div>
          </div>
        </div>

        <footer className="amboss-bottom-nav">
          <button type="button" onClick={controller.goPrevious} disabled={controller.currentIndex <= 0}>‹ PREVIOUS</button>
          <button
            type="button"
            onClick={controller.goNext}
            disabled={controller.currentIndex >= controller.test.questions.length - 1}
          >
            {controller.selectedOptionId == null && !controller.isRevealed ? 'SKIP' : 'NEXT'} ›
          </button>
        </footer>
      </section>

      <AmbossLabsPanel
        open={labsOpen}
        data={controller.labs}
        loading={controller.labsQuery.isFetching}
        onClose={() => setLabsOpen(false)}
      />

      {flashcardsOpen ? (
        <div className="amboss-dialog-backdrop" role="presentation" onMouseDown={() => setFlashcardsOpen(false)}>
          <div className="amboss-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="amboss-dialog-close" onClick={() => setFlashcardsOpen(false)}>×</button>
            <h2>Flashcards</h2>
            <p>The AMBOSS theme will use MedPark question-linked Flashcards. Detailed card creation UX is intentionally deferred to the next approved pass.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
