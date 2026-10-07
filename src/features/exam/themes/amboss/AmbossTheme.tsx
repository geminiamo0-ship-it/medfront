import { useState } from 'react';
import type { ExamRunnerController } from '../../core/useExamRunner';
import { AmbossSidebar } from './AmbossSidebar';
import { AmbossQuestionWorkspace } from './AmbossQuestionWorkspace';
import './amboss.css';

export function AmbossTheme({ controller }: { controller: ExamRunnerController }) {
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 900,
  );

  if (!controller.test || !controller.currentQuestion) return null;

  return (
    <div className={sidebarOpen ? 'amboss-runner sidebar-open' : 'amboss-runner'}>
      <header className="amboss-topbar">
        <button
          type="button"
          className="amboss-mobile-menu"
          onClick={() => setSidebarOpen((value) => !value)}
          aria-label="Toggle session navigation"
        >
          ☰
        </button>
        <div className="amboss-topbar-space" />
        <span className="amboss-theme-name">AMBOSS</span>
      </header>

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
      />

      <AmbossQuestionWorkspace key={controller.currentQuestion.id} controller={controller} />

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
