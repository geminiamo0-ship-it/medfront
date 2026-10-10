import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ExamRunnerController } from '../../core/useExamRunner';
import { UWorldTopbar, type UWorldTool } from './UWorldTopbar';
import { UWorldSidebar } from './UWorldSidebar';
import { UWorldQuestionPane } from './UWorldQuestionPane';
import { UWorldExplanationPane } from './UWorldExplanationPane';
import { UWorldSplitter } from './UWorldSplitter';
import { UWorldBottomBar } from './UWorldBottomBar';
import { UWorldSettings } from './UWorldSettings';
import { UWorldToolPanel } from './UWorldToolPanel';
import { UWorldEndDialog } from './UWorldEndDialog';
import { useUWorldPreferences } from './useUWorldPreferences';
import './uworld.css';

export function UWorldTheme({ controller: c }: { controller: ExamRunnerController }) {
  const navigate = useNavigate();
  const { appearance, setAppearance, split, setSplit } = useUWorldPreferences();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 900);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<UWorldTool | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const [splitWidth, setSplitWidth] = useState(42);
  const [lifecycleError, setLifecycleError] = useState('');
  const sawActive = useRef(false);

  useEffect(() => {
    if (c.test?.status === 'in_progress') sawActive.current = true;
    if (c.test?.status === 'completed' && sawActive.current) {
      navigate('/test/' + c.test.id + '/results', { replace: true });
    }
  }, [c.test?.id, c.test?.status, navigate]);

  if (!c.test || !c.currentQuestion) return null;
  const visibleExplanation = c.isRevealed && (c.isCompleted || c.isTutorLike);
  const panelMode = !visibleExplanation ? 'solving' : split ? 'split' : 'continuous';
  const bankId = c.test.filters?.questionBankIds?.[0] ?? c.currentQuestion.questionBank?.id ?? null;

  function leave() {
    navigate(bankId ? `/qbank/${bankId}/previous-tests?step=${c.test?.step ?? 1}` : '/dashboard');
  }
  async function suspendAndLeave() {
    if (c.suspendMutation.isPending) return;
    setLifecycleError('');
    try { await c.suspendTestAsync(); leave(); }
    catch (error) {
      setLifecycleError(error instanceof Error ? error.message : 'Could not suspend block.');
    }
  }
  function requestExit() {
    if (c.isSuspended || c.isCompleted) leave();
    else void suspendAndLeave();
  }
  function toggleTool(tool: UWorldTool) { setActiveTool(current => current === tool ? null : tool); }
  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      try { await document.documentElement.requestFullscreen(); }
      catch { setLifecycleError('Full screen is unavailable in this browser.'); }
    } else { await document.exitFullscreen(); }
  }
  return (
    <div className={'uw-runner' + (sidebarOpen ? ' uw-sidebar-open' : '')} data-appearance={appearance}
      data-mode={panelMode} style={{ '--uw-split': `${splitWidth}%` } as CSSProperties}>
      <UWorldSidebar controller={c} open={sidebarOpen}
        onToggle={() => setSidebarOpen(v => !v)} onExit={requestExit}
        onSelect={id => { c.goToQuestion(id); if (window.innerWidth < 900) setSidebarOpen(false); }}/>
      <UWorldTopbar controller={c} onToggleSidebar={() => setSidebarOpen(v => !v)}
        onSettings={() => setSettingsOpen(true)} onTool={toggleTool} onFullscreen={() => void toggleFullscreen()}/>
      <main className="uw-exam">
        <div className="uw-exam-layout">
          <UWorldQuestionPane key={c.currentQuestion.id} controller={c} />
          {visibleExplanation ? (
            <>
              {split ? <UWorldSplitter width={splitWidth} onChange={setSplitWidth} /> : null}
              <UWorldExplanationPane controller={c} />
            </>
          ) : null}
        </div>
      </main>
      <UWorldBottomBar controller={c} onTool={toggleTool}
        onSuspend={() => void suspendAndLeave()} onEnd={() => setEndOpen(true)}/>
      <UWorldSettings open={settingsOpen} appearance={appearance} split={split}
        onAppearance={setAppearance} onSplit={setSplit} onClose={() => setSettingsOpen(false)}/>
      <UWorldToolPanel controller={c} tool={activeTool} onClose={() => setActiveTool(null)}/>
      {endOpen && !c.isCompleted ? <UWorldEndDialog controller={c} onClose={() => setEndOpen(false)}/> : null}
      {lifecycleError ? <p role="alert" className="uw-lifecycle-error">{lifecycleError}</p> : null}
      {c.isSuspended ? <div className="uw-paused" role="dialog" aria-modal="true" aria-label="Block suspended">
        <div><h2>Block suspended</h2><p>Your answers and time are saved.</p>
          <button type="button" onClick={c.resumeTest} disabled={c.resumeMutation.isPending}>
            {c.resumeMutation.isPending ? 'Resuming…' : 'Resume block'}
          </button>
          {c.resumeMutation.isError ? <p role="alert">Could not resume. Please retry.</p> : null}
        </div>
      </div> : null}
      {sidebarOpen ? <button type="button" className="uw-mobile-overlay"
        aria-label="Close question navigator" onClick={() => setSidebarOpen(false)}/> : null}
    </div>
  );
}
