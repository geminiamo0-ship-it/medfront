import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { ExamRunnerController } from '../../core/useExamRunner';
import type { ExamOption } from '../../types';
import { ExamIcon } from '../../shared/ExamIcon';
import { SafeHtml } from '../../shared/SafeHtml';
import { importedReferencePreview, parseAmbossExplanationHtml, parseAmbossQuestionHtml } from './ambossMarkup';
import { AmbossLabsPanel } from './AmbossLabsPanel';
import { AmbossLibraryLinkMenu } from './AmbossLibraryLinkMenu';
import { AmbossLibrarySplitPane } from './AmbossLibrarySplitPane';
import { AmbossNotesEditor } from './AmbossNotesEditor';
import { AmbossOption, type AmbossResolvedOption } from './AmbossOption';
import { AmbossToolbar } from './AmbossToolbar';
import { AmbossSketchOverlay } from './AmbossSketchOverlay';
import { useAmbossExamImages } from './AmbossExamImages';
import { applyQuestionHighlights, selectionToQuestionHighlight } from './ambossMarkers';
import type { AmbossToolMode } from './AmbossTopbar';

export function AmbossQuestionWorkspace({
  controller,
  activeTool,
  markerColor,
  pencilColor,
}: {
  controller: ExamRunnerController;
  activeTool: AmbossToolMode;
  markerColor: string;
  pencilColor: string;
}) {
  const question = controller.currentQuestion;
  const [cluesOn, setCluesOn] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [labsOpen, setLabsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [laserPoint, setLaserPoint] = useState<{ x: number; y: number } | null>(null);
  const stemRef = useRef<HTMLDivElement>(null);
  const [libraryLinkMenu, setLibraryLinkMenu] = useState<{
    href: string;
    title: string;
    previewHtml: string;
    left: number;
    top: number;
  } | null>(null);
  const [librarySplit, setLibrarySplit] = useState<{ href: string; title: string } | null>(null);
  const [librarySplitWidth, setLibrarySplitWidth] = useState(
    () => (typeof window === 'undefined' ? 520 : Math.min(620, Math.max(420, Math.floor(window.innerWidth * 0.44)))),
  );
  const [showAllExplanations, setShowAllExplanations] = useState(
    () => question?.isOmitted === true && !controller.isCompleted,
  );
  const [expandedOptionIds, setExpandedOptionIds] = useState<Set<number>>(() => {
    if (!question) return new Set<number>();
    if (question.isOmitted && !controller.isCompleted) {
      return new Set(question.options.map((option) => option.id));
    }
    const submitted = question.userAnswer?.selectedOptionId;
    return submitted != null ? new Set([submitted]) : new Set<number>();
  });

  const parsed = useMemo(
    () => parseAmbossQuestionHtml(question?.textHtml ?? ''),
    [question?.textHtml],
  );

  const explanationBlob =
    controller.currentReveal?.explanation.explanationHtml ??
    question?.explanationHtml ??
    '';

  const parsedExplanation = useMemo(
    () => parseAmbossExplanationHtml(explanationBlob),
    [explanationBlob],
  );

  const {
    mediaRootRef,
    handleImageClickCapture,
    handleImageKeyDownCapture,
    imageViewer,
  } = useAmbossExamImages(
    question?.id ?? null,
    controller.isCompleted || (controller.isTutorLike && controller.isRevealed),
  );

  const questionHighlights = controller.currentQuestionHighlights;

  useEffect(() => {
    if (!stemRef.current) return;
    applyQuestionHighlights(stemRef.current, questionHighlights);
  }, [question?.id, parsed.stemHtml, questionHighlights]);

  if (!question || !controller.test) return null;

  // Use the existing backend relation only. Never guess a primary source
  // from arbitrary inline medical-term links in an explanation.
  const mainArticleId = Number(question.articleId);
  const mainArticleHref =
    Number.isSafeInteger(mainArticleId) &&
    mainArticleId > 0 &&
    (!question.libraryName || question.libraryName.trim().toLowerCase() === 'amboss')
      ? `/library?source=amboss&article=${encodeURIComponent(String(mainArticleId))}`
      : undefined;

  const revealOptions = controller.currentReveal?.explanation.options ?? [];
  const resolvedOptions: AmbossResolvedOption[] = question.options.map((option: ExamOption) => {
    const reveal = revealOptions.find((item) => item.id === option.id);
    const directExplanation = reveal?.explanationHtml ?? option.explanationHtml;
    const blobExplanation =
      parsedExplanation.optionExplanations[String(option.displayOrder).toUpperCase()];

    return {
      ...option,
      isCorrect: reveal?.isCorrect ?? option.isCorrect,
      explanationHtml:
        directExplanation && directExplanation.trim()
          ? directExplanation
          : blobExplanation ?? null,
      uworldChosenBy: reveal?.uworldChosenBy ?? option.uworldChosenBy,
    };
  });

  const marked = controller.isQuestionMarked(question);
  const canReveal =
    controller.isTutorLike &&
    !controller.isCompleted &&
    !controller.isRevealed;

  function openLabs() {
    const next = !labsOpen;
    setLabsOpen(next);
    if (next) {
      setLibrarySplit(null);
      controller.ensureLabsLoaded();
    }
  }

  function handleLibraryLinkClick(event: ReactMouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    const link = target.closest<HTMLAnchorElement>('a[data-medpark-library-link="1"]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = link.getBoundingClientRect();
    const menuWidth = 280;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - menuWidth - 12));
    const top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 150));

    setLibraryLinkMenu({
      href,
      title: link.textContent?.trim() || 'AMBOSS article',
      previewHtml: importedReferencePreview(link.getAttribute('data-description') || link.getAttribute('data-content') || ''),
      left,
      top,
    });
  }

  function openLibrarySplit() {
    if (!libraryLinkMenu) return;
    setLabsOpen(false);
    setLibrarySplit({
      href: libraryLinkMenu.href,
      title: libraryLinkMenu.title,
    });
    setLibraryLinkMenu(null);
  }

  function openLibraryNewTab() {
    if (!libraryLinkMenu) return;
    window.open(libraryLinkMenu.href, '_blank', 'noopener,noreferrer');
    setLibraryLinkMenu(null);
  }

  function activateOption(optionId: number) {
    if (activeTool === 'pencil' || activeTool === 'laser') return;
    // A rapid second click cannot race the first submit.
    if (!controller.isRevealed && controller.showAnswerMutation.isPending) return;

    if (!controller.isRevealed) {
      // Timed stays local. Tutor/Mixed submits this first click immediately.
      if (controller.isTutorLike) {
        setExpandedOptionIds(new Set([optionId]));
      }
      controller.selectOption(optionId);
      return;
    }

    // Completed review and post-submit Tutor/Mixed clicks are presentation-only.
    // Completed Omitted review may lazy-fetch explanation payloads, but never submits.
    if (controller.isCompleted) {
      controller.ensureCurrentReviewExplanation();
    }

    setExpandedOptionIds((current) => {
      if (current.has(optionId)) return current;
      const next = new Set(current);
      next.add(optionId);
      return next;
    });
  }

  function revealWithoutAnswer() {
    // SHOW ANSWER before a first choice = explicit omission + reveal all.
    setShowAllExplanations(true);
    controller.showAnswer();
  }

  function toggleAllExplanations() {
    if (showAllExplanations) {
      setShowAllExplanations(false);
      setExpandedOptionIds(new Set());
      return;
    }
    if (controller.isCompleted) {
      controller.ensureCurrentReviewExplanation();
    }
    setShowAllExplanations(true);
  }

  function saveMarkerSelection() {
    if (!question || activeTool !== 'marker' || !stemRef.current) return;
    const highlight = selectionToQuestionHighlight(stemRef.current, markerColor);
    if (!highlight) return;

    const existing = controller.getQuestionHighlights(question);
    const duplicate = existing.some(
      (item) =>
        (item.source ?? 'question') === 'question' &&
        item.startIndex === highlight.startIndex &&
        item.endIndex === highlight.endIndex,
    );
    const next = duplicate ? existing : [...existing, highlight];
    controller.saveQuestionHighlights(question.id, next);
    applyQuestionHighlights(stemRef.current, next);
    window.getSelection()?.removeAllRanges();
  }

  function trackLaser(event: ReactPointerEvent<HTMLElement>) {
    if (activeTool !== 'laser') {
      if (laserPoint) setLaserPoint(null);
      return;
    }
    setLaserPoint({ x: event.clientX, y: event.clientY });
  }

  return (
    <>
      <section
        className={[
          'amboss-workspace',
          labsOpen ? 'has-labs' : '',
          librarySplit ? 'has-library-split' : '',
        ].filter(Boolean).join(' ')}
        style={
          librarySplit
            ? ({ '--amboss-library-split-width': `${librarySplitWidth}px` } as CSSProperties)
            : undefined
        }
        ref={mediaRootRef}
        onClickCapture={(event) => {
          if (!handleImageClickCapture(event)) handleLibraryLinkClick(event);
        }}
        onKeyDownCapture={handleImageKeyDownCapture}
        onPointerMove={trackLaser}
        onPointerLeave={() => setLaserPoint(null)}
        data-active-tool={activeTool ?? 'none'}
      >
        <div className="amboss-question-card">
          <AmbossSketchOverlay active={activeTool === 'pencil'} color={pencilColor} />
          <div className="amboss-question-content" onMouseUp={saveMarkerSelection}>
            <div className="amboss-aa">AA</div>
            <SafeHtml
              ref={stemRef}
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

          <div className="amboss-options" role="radiogroup" aria-label="Answer choices">
            {resolvedOptions.map((option) => {
              const selected = controller.selectedOptionId === option.id;
              const revealed = controller.isRevealed;
              const inspected = showAllExplanations || expandedOptionIds.has(option.id);
              const showExplanation =
                revealed &&
                inspected &&
                !!option.explanationHtml;

              return (
                <AmbossOption
                  key={option.id}
                  option={option}
                  selected={selected}
                  revealed={revealed}
                  inspected={inspected}
                  showExplanation={showExplanation}
                  showCorrectAnswer={controller.isCompleted}
                  mainArticleHref={mainArticleHref}
                  onActivate={() => activateOption(option.id)}
                />
              );
            })}
          </div>

          {controller.timedDraftError && controller.isTimed && !controller.isCompleted ? (
            <div className="amboss-timed-save-warning">
              Selection is kept in this block, but background save needs another try before Suspend.
            </div>
          ) : null}

          <div className="amboss-answer-actions">
            {canReveal ? (
              <button
                type="button"
                className="amboss-show-answer"
                onClick={revealWithoutAnswer}
                disabled={controller.showAnswerMutation.isPending}
              >
                ☑ {controller.showAnswerMutation.isPending ? 'LOADING ANSWER…' : 'SHOW ANSWER'}
              </button>
            ) : controller.isRevealed ? (
              <button
                type="button"
                className="amboss-show-answer"
                onClick={toggleAllExplanations}
              >
                ↕ {showAllExplanations ? 'HIDE ALL EXPLANATIONS' : 'SHOW ALL EXPLANATIONS'}
              </button>
            ) : (
              <span />
            )}
            <div className="amboss-answer-secondary">
              <span>↶ RESET QUESTION</span>
              <span>◉ HIDE STATS</span>
            </div>
          </div>
        </div>

        <footer className="amboss-bottom-nav">
          <button type="button" onClick={controller.goPrevious} disabled={controller.currentIndex <= 0}>
            <ExamIcon name="previous" size={14} /> PREVIOUS
          </button>
          <button
            type="button"
            onClick={controller.goNext}
            disabled={controller.currentIndex >= controller.test.questions.length - 1}
          >
            {controller.selectedOptionId == null && !controller.isRevealed ? 'SKIP' : 'NEXT'} <ExamIcon name="next" size={14} />
          </button>
        </footer>
      </section>

      {laserPoint && activeTool === 'laser' ? (
        <div
          className="amboss-laser-dot"
          style={{ left: laserPoint.x, top: laserPoint.y }}
          aria-hidden="true"
        />
      ) : null}

      {librarySplit ? (
        <AmbossLibrarySplitPane
          href={librarySplit.href}
          title={librarySplit.title}
          width={librarySplitWidth}
          onWidthChange={setLibrarySplitWidth}
          onClose={() => setLibrarySplit(null)}
          onOpenNewTab={() => window.open(librarySplit.href, '_blank', 'noopener,noreferrer')}
        />
      ) : null}

      {libraryLinkMenu ? (
        <AmbossLibraryLinkMenu
          left={libraryLinkMenu.left}
          top={libraryLinkMenu.top}
          title={libraryLinkMenu.title}
          previewHtml={libraryLinkMenu.previewHtml}
          onSplit={openLibrarySplit}
          onNewTab={openLibraryNewTab}
          onClose={() => setLibraryLinkMenu(null)}
        />
      ) : null}

      {imageViewer}

      <AmbossLabsPanel
        open={labsOpen}
        data={controller.labs}
        loading={controller.labsQuery.isFetching}
        onClose={() => setLabsOpen(false)}
      />

      {flashcardsOpen ? (
        <div className="amboss-dialog-backdrop" role="presentation" onMouseDown={() => setFlashcardsOpen(false)}>
          <div className="amboss-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="amboss-dialog-close" onClick={() => setFlashcardsOpen(false)} aria-label="Close flashcards">
              <ExamIcon name="close" size={20} />
            </button>
            <h2>Flashcards</h2>
            <p>The AMBOSS theme will use MedPark question-linked Flashcards. Detailed card creation UX is intentionally deferred to the next approved pass.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
