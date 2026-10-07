import { useState } from 'react';
import type { ExamRunnerController } from '../../core/useExamRunner';
import { AmbossAiSummaryPanel } from './AmbossAiSummaryPanel';
import { AmbossCalculator } from './AmbossCalculator';
import { AmbossEndBlockDialog } from './AmbossEndBlockDialog';
import { AmbossQuestionWorkspace } from './AmbossQuestionWorkspace';
import { AmbossSidebar } from './AmbossSidebar';
import {
  AmbossTopbar,
  type AmbossAppearance,
  type AmbossTextSize,
  type AmbossToolMode,
} from './AmbossTopbar';
import './amboss.css';

export function AmbossTheme({ controller }: { controller: ExamRunnerController }) {
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 900,
  );
  const [appearance, setAppearance] = useState<AmbossAppearance>('light');
  const [textSize, setTextSize] = useState<AmbossTextSize>('normal');
  const [activeTool, setActiveTool] = useState<AmbossToolMode>(null);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [endBlockOpen, setEndBlockOpen] = useState(false);
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);

  if (!controller.test || !controller.currentQuestion) return null;

  const firstUnanswered = controller.test.questions.find(
    (question) => controller.getSelectedOptionId(question) == null,
  );

  const aiError =
    controller.aiSummaryQuery.error instanceof Error
      ? controller.aiSummaryQuery.error.message
      : controller.aiSummaryQuery.error
        ? 'AI Summary could not be generated.'
        : null;

  function openAiSummary() {
    setAiSummaryOpen(true);
    if (!controller.aiSummary && !controller.aiSummaryQuery.isFetching) {
      controller.loadAiSummary();
    }
  }

  return (
    <div
      className={sidebarOpen ? 'amboss-runner sidebar-open' : 'amboss-runner'}
      data-appearance={appearance}
      data-text-size={textSize}
    >
      <AmbossTopbar
        controller={controller}
        onToggleSidebar={() => setSidebarOpen((value) => !value)}
        appearance={appearance}
        onAppearanceChange={setAppearance}
        textSize={textSize}
        onTextSizeChange={setTextSize}
        activeTool={activeTool}
        onToolChange={setActiveTool}
        calculatorOpen={calculatorOpen}
        onCalculatorToggle={() => setCalculatorOpen((value) => !value)}
        onEndBlockRequest={() => setEndBlockOpen(true)}
        onAiSummary={openAiSummary}
      />

      <AmbossSidebar
        test={controller.test}
        currentQuestionId={controller.currentQuestion.id}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((value) => !value)}
        onSelect={(questionId) => {
          controller.goToQuestion(questionId);
          if (typeof window !== 'undefined' && window.innerWidth < 900) setSidebarOpen(false);
        }}
        isMarked={controller.isQuestionMarked}
        getSelectedOptionId={controller.getSelectedOptionId}
        timerSeconds={controller.timerSeconds}
        timerCountsDown={controller.timerCountsDown}
        paused={controller.isSuspended}
      />

      <AmbossQuestionWorkspace
        key={controller.currentQuestion.id}
        controller={controller}
        activeTool={activeTool}
      />

      <AmbossCalculator
        open={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
      />

      <AmbossAiSummaryPanel
        open={aiSummaryOpen && controller.isCompleted}
        loading={controller.aiSummaryQuery.isFetching}
        content={controller.aiSummary?.content}
        error={aiError}
        onClose={() => setAiSummaryOpen(false)}
        onGenerate={controller.loadAiSummary}
      />

      {controller.isSuspended ? (
        <div className="amboss-suspended-overlay" role="dialog" aria-modal="true" aria-label="Block suspended">
          <div>
            <span>BLOCK PAUSED</span>
            <h2>Your progress and remaining time are saved.</h2>
            <p>Resume when you are ready to continue this block.</p>
            <button
              type="button"
              onClick={controller.resumeTest}
              disabled={controller.resumeMutation.isPending}
            >
              {controller.resumeMutation.isPending ? 'Resuming…' : 'Resume block'}
            </button>
          </div>
        </div>
      ) : null}

      {endBlockOpen && controller.isTimed && !controller.isCompleted ? (
        <AmbossEndBlockDialog
          answered={controller.timedAnsweredCount}
          unanswered={controller.timedUnansweredCount}
          marked={controller.markedCount}
          remainingSeconds={controller.remainingSeconds ?? 0}
          pending={controller.timedBlockMutation.isPending}
          onClose={() => setEndBlockOpen(false)}
          onReviewUnanswered={() => {
            if (firstUnanswered) controller.goToQuestion(firstUnanswered.id);
            setEndBlockOpen(false);
          }}
          onConfirm={controller.endTimedBlock}
        />
      ) : null}

      {sidebarOpen ? (
        <button
          type="button"
          className="amboss-mobile-backdrop"
          aria-label="Close session navigation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
    </div>
  );
}
