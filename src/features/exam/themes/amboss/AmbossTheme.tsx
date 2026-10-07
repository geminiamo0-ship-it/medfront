import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 900,
  );
  const [appearance, setAppearance] = useState<AmbossAppearance>('light');
  const [textSize, setTextSize] = useState<AmbossTextSize>('normal');
  const [activeTool, setActiveTool] = useState<AmbossToolMode>(null);
  const [markerColor, setMarkerColor] = useState('#f6d84a');
  const [pencilColor, setPencilColor] = useState('#d44545');
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

  function leaveToPreviousTests() {
    const bankId =
      controller.test?.filters?.questionBankIds?.[0] ??
      controller.currentQuestion?.questionBank?.id ??
      null;
    const step = controller.test?.step ?? 1;
    navigate(bankId
      ? `/qbank/${bankId}/previous-tests?step=${step}`
      : `/qbank?step=${step}`);
  }

  async function suspendAndLeave() {
    if (controller.suspendMutation.isPending) return;
    try {
      await controller.suspendTestAsync();
      leaveToPreviousTests();
    } catch {
      // Mutation state retains the error and the learner remains in the runner.
    }
  }

  function exitSession() {
    if (controller.isCompleted || controller.isSuspended) {
      leaveToPreviousTests();
    } else {
      void suspendAndLeave();
    }
  }

  const canEndBlock =
    controller.isTimed || controller.test.type === 'tutor';

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
        markerColor={markerColor}
        onMarkerColorChange={setMarkerColor}
        pencilColor={pencilColor}
        onPencilColorChange={setPencilColor}
        calculatorOpen={calculatorOpen}
        onCalculatorToggle={() => setCalculatorOpen((value) => !value)}
        onSuspendRequest={() => void suspendAndLeave()}
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
        onExit={exitSession}
        isMarked={controller.isQuestionMarked}
        getSelectedOptionId={controller.getSelectedOptionId}
        timerSeconds={controller.timerSeconds}
        questionTimerSeconds={controller.questionTimerSeconds}
        timerCountsDown={controller.timerCountsDown}
        paused={controller.timerPaused}
      />

      <AmbossQuestionWorkspace
        key={controller.currentQuestion.id}
        controller={controller}
        activeTool={activeTool}
        markerColor={markerColor}
        pencilColor={pencilColor}
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
            <h2>Your progress and time are saved.</h2>
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

      {endBlockOpen && canEndBlock && !controller.isCompleted ? (
        <AmbossEndBlockDialog
          answered={controller.answeredCount}
          unanswered={controller.unansweredCount}
          marked={controller.markedCount}
          timeLabel={controller.isTimed ? 'Time left' : 'Solving time'}
          timeSeconds={controller.isTimed ? controller.remainingSeconds ?? 0 : controller.elapsedSeconds}
          pending={
            controller.isTimed
              ? controller.timedBlockMutation.isPending
              : controller.completeTestMutation.isPending
          }
          onClose={() => setEndBlockOpen(false)}
          onReviewUnanswered={() => {
            if (firstUnanswered) controller.goToQuestion(firstUnanswered.id);
            setEndBlockOpen(false);
          }}
          onConfirm={controller.endBlock}
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
