import { useEffect, useId, useRef, useState } from 'react';
import { UWorldMobileTools } from './UWorldMobileTools';
import type { ExamRunnerController } from '../../core/useExamRunner';
import type { ExamIconName } from '../../shared/ExamIcon';
import { UWorldTopbarIcon } from './UWorldTopbarIcon';

export type UWorldTool = 'calculator' | 'labs' | 'notes' | 'shortcuts' | 'library' | 'flashcards' | 'feedback' | 'ai';

interface Props {
  controller: ExamRunnerController;
  onToggleSidebar: () => void;
  onSettings: () => void;
  onTool: (tool: UWorldTool) => void;
  onFullscreen: () => void;
  markerActive: boolean;
  onMarker: () => void;
}

function ToolButton({ label, icon, onClick }: {
  label: string; icon: ExamIconName; onClick: () => void;
}) {
  return (
    <button type="button" className="uw-bar-action uw-top-tool" aria-label={label}
      title={label} onClick={onClick}>
      <UWorldTopbarIcon name={icon} size={22}/>
      <span>{label}</span>
    </button>
  );
}

export function UWorldTopbar({ controller: c, onToggleSidebar, onSettings,
  onTool, onFullscreen, markerActive, onMarker }: Props) {
  const question = c.currentQuestion;
  const isMarked = !!question && c.isQuestionMarked(question);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const topbarRef = useRef<HTMLElement>(null);
  const mobileSettingsRef = useRef<HTMLButtonElement>(null);
  const trayId = useId();

  useEffect(() => {
    if (!mobileToolsOpen) return;
    const outside = (event: PointerEvent) => {
      if (!topbarRef.current?.contains(event.target as Node)) setMobileToolsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileToolsOpen(false);
        mobileSettingsRef.current?.focus();
      }
    };
    const screen = window.matchMedia('(max-width: 650px)');
    const resize = () => { if (!screen.matches) setMobileToolsOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    screen.addEventListener('change', resize);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      screen.removeEventListener('change', resize);
    };
  }, [mobileToolsOpen]);

  const openTool = (tool: UWorldTool) => { setMobileToolsOpen(false); onTool(tool); };
  const closeTray = () => setMobileToolsOpen(false);

  return (
    <header ref={topbarRef} className="uw-topbar" aria-label="Exam top toolbar">
      <div className="uw-top-left">
        <button type="button" className="uw-top-menu" aria-label="Toggle navigator"
          title="Questions" onClick={() => { closeTray(); onToggleSidebar(); }}>
          <UWorldTopbarIcon name="menu" size={23}/>
        </button>
        <div className="uw-item-index">
          <strong>Item {c.currentIndex + 1} of {c.test?.totalQuestions ?? 0}</strong>
          <small>Question Id: {question?.externalId ?? question?.id}</small>
        </div>
        <button type="button" className={'uw-mark' + (isMarked ? ' is-marked' : '')}
          title={isMarked ? 'Unmark question' : 'Mark question'} aria-label="Mark"
          onClick={c.toggleCurrentMark} disabled={!question || c.markMutation.isPending}
          aria-pressed={isMarked}>
          <UWorldTopbarIcon name="mark" size={24}/>
          <span>Mark</span>
        </button>
      </div>

      <nav className="uw-top-center" aria-label="Question navigation">
        <button type="button" className="uw-bar-action uw-top-navigation"
          aria-label="Previous" title="Previous" onClick={c.goPrevious}
          disabled={c.currentIndex <= 0}>
          <UWorldTopbarIcon name="previous" size={20}/>
          <span>Previous</span>
        </button>
        <button type="button" className="uw-bar-action uw-top-navigation"
          aria-label="Next" title="Next" onClick={c.goNext}
          disabled={!c.test || c.currentIndex >= c.test.questions.length - 1}>
          <UWorldTopbarIcon name="next" size={20}/>
          <span>Next</span>
        </button>
      </nav>

      <nav className="uw-top-right" aria-label="Exam tools">
        <ToolButton label="Shortcuts" icon="shortcuts" onClick={() => onTool('shortcuts')}/>
        <ToolButton label="Full Screen" icon="full-screen" onClick={onFullscreen}/>
        <button type="button" className={'uw-bar-action uw-top-tool' + (markerActive ? ' is-active' : '')}
          onClick={onMarker} aria-label="Marker" aria-pressed={markerActive}
          title="Select text to highlight">
          <UWorldTopbarIcon name="marker" size={22}/>
          <span>Marker</span>
        </button>
        <ToolButton label="Lab Values" icon="lab-values" onClick={() => onTool('labs')}/>
        <ToolButton label="Notes" icon="notes" onClick={() => onTool('notes')}/>
        <ToolButton label="Calculator" icon="calculator" onClick={() => onTool('calculator')}/>
        <ToolButton label="Settings" icon="settings" onClick={onSettings}/>
      </nav>
      <nav className="uw-top-mobile-actions" aria-label="Mobile exam controls">
        <button type="button" className={'uw-mobile-main-action' + (isMarked ? ' is-marked' : '')}
          aria-label="Mark" aria-pressed={isMarked} title="Mark question"
          disabled={!question || c.markMutation.isPending}
          onClick={c.toggleCurrentMark}>
          <UWorldTopbarIcon name="mark" size={21}/><span>Mark</span>
        </button>
        <button ref={mobileSettingsRef} type="button"
          className={'uw-mobile-main-action uw-mobile-settings-toggle' + (mobileToolsOpen ? ' is-open' : '')}
          aria-label="Settings" aria-haspopup="true" aria-expanded={mobileToolsOpen}
          aria-controls={trayId} title="Additional exam tools"
          onClick={() => setMobileToolsOpen(value => !value)}>
          <span className="uw-settings-gear"><UWorldTopbarIcon name="settings" size={22}/></span><span>Settings</span>
        </button>
      </nav>
      <UWorldMobileTools id={trayId} open={mobileToolsOpen} markerActive={markerActive}
        onTool={openTool} onFullscreen={onFullscreen} onMarker={onMarker}
        onAppearance={onSettings} onClose={closeTray}/>
    </header>
  );
}
