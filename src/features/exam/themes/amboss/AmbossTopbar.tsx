import { useState } from 'react';
import type { ExamRunnerController } from '../../core/useExamRunner';
import { ExamIcon } from '../../shared/ExamIcon';

export type AmbossToolMode = 'marker' | 'pencil' | 'laser' | null;
export type AmbossAppearance = 'light' | 'dark';
export type AmbossTextSize = 'compact' | 'normal' | 'large';

interface AmbossTopbarProps {
  controller: ExamRunnerController;
  onToggleSidebar: () => void;
  appearance: AmbossAppearance;
  onAppearanceChange: (value: AmbossAppearance) => void;
  textSize: AmbossTextSize;
  onTextSizeChange: (value: AmbossTextSize) => void;
  activeTool: AmbossToolMode;
  onToolChange: (value: AmbossToolMode) => void;
  calculatorOpen: boolean;
  onCalculatorToggle: () => void;
  onEndBlockRequest: () => void;
  onAiSummary: () => void;
}

function formatTimer(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function AmbossTopbar({
  controller,
  onToggleSidebar,
  appearance,
  onAppearanceChange,
  textSize,
  onTextSizeChange,
  activeTool,
  onToolChange,
  calculatorOpen,
  onCalculatorToggle,
  onEndBlockRequest,
  onAiSummary,
}: AmbossTopbarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const lifecyclePending =
    controller.suspendMutation.isPending ||
    controller.resumeMutation.isPending ||
    controller.timedBlockMutation.isPending;

  return (
    <header className="amboss-topbar">
      <div className="amboss-topbar-zone amboss-topbar-left">
        <button
          type="button"
          className="amboss-mobile-menu"
          onClick={onToggleSidebar}
          aria-label="Toggle session navigation"
        >
          <ExamIcon name="menu" size={22} />
        </button>

        <div className="amboss-topbar-popover-wrap">
          <button
            type="button"
            className={settingsOpen ? 'amboss-top-action is-active' : 'amboss-top-action'}
            onClick={() => {
              setSettingsOpen((value) => !value);
              setToolsOpen(false);
            }}
            aria-expanded={settingsOpen}
          >
            <ExamIcon name="settings" size={17} />
            <span>Settings</span>
          </button>
          {settingsOpen ? (
            <div className="amboss-top-popover amboss-settings-popover">
              <strong>Appearance</strong>
              <div className="amboss-segmented">
                <button
                  type="button"
                  className={appearance === 'light' ? 'is-active' : ''}
                  onClick={() => onAppearanceChange('light')}
                >
                  Light
                </button>
                <button
                  type="button"
                  className={appearance === 'dark' ? 'is-active' : ''}
                  onClick={() => onAppearanceChange('dark')}
                >
                  Dark
                </button>
              </div>
              <strong>Text size</strong>
              <div className="amboss-segmented">
                {(['compact', 'normal', 'large'] as AmbossTextSize[]).map((size) => (
                  <button
                    type="button"
                    key={size}
                    className={textSize === size ? 'is-active' : ''}
                    onClick={() => onTextSizeChange(size)}
                  >
                    {size === 'compact' ? 'A−' : size === 'large' ? 'A+' : 'A'}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="amboss-topbar-popover-wrap">
          <button
            type="button"
            className={toolsOpen || activeTool ? 'amboss-top-action is-active' : 'amboss-top-action'}
            onClick={() => {
              setToolsOpen((value) => !value);
              setSettingsOpen(false);
            }}
            aria-expanded={toolsOpen}
          >
            <ExamIcon name="tools" size={17} />
            <span>Tools</span>
          </button>
          {toolsOpen ? (
            <div className="amboss-top-popover amboss-tools-popover">
              {([
                ['marker', 'marker', 'Marker'],
                ['pencil', 'pencil', 'Pencil'],
                ['laser', 'laser', 'Laser'],
              ] as const).map(([tool, icon, label]) => (
                <button
                  key={tool}
                  type="button"
                  className={activeTool === tool ? 'amboss-popover-action is-active' : 'amboss-popover-action'}
                  onClick={() => {
                    onToolChange(activeTool === tool ? null : tool);
                    setToolsOpen(false);
                  }}
                >
                  <ExamIcon name={icon} size={17} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="amboss-topbar-zone amboss-topbar-center">
        {!controller.isCompleted ? (
          <button
            type="button"
            className="amboss-top-action amboss-lifecycle-action"
            onClick={controller.isSuspended ? controller.resumeTest : controller.suspendTest}
            disabled={lifecyclePending}
          >
            <ExamIcon name={controller.isSuspended ? 'resume' : 'suspend'} size={17} />
            <span>{controller.isSuspended ? 'Resume' : 'Suspend'}</span>
          </button>
        ) : null}

        <div
          className={[
            'amboss-primary-timer',
            controller.timerCountsDown ? 'is-countdown' : '',
            controller.isSuspended ? 'is-paused' : '',
            controller.remainingSeconds != null && controller.remainingSeconds <= 60 ? 'is-critical' : '',
          ].filter(Boolean).join(' ')}
          aria-label={controller.timerCountsDown ? 'Time remaining' : 'Session time'}
        >
          <ExamIcon name="timer" size={17} />
          <strong>{formatTimer(controller.timerSeconds)}</strong>
          {controller.isSuspended ? <small>PAUSED</small> : null}
        </div>

        {controller.isTimed && !controller.isCompleted ? (
          <button
            type="button"
            className="amboss-top-action amboss-end-block"
            onClick={onEndBlockRequest}
            disabled={controller.isSuspended || lifecyclePending}
          >
            <ExamIcon name="end-block" size={17} />
            <span>End Block</span>
          </button>
        ) : null}
      </div>

      <div className="amboss-topbar-zone amboss-topbar-right">
        <button
          type="button"
          className={calculatorOpen ? 'amboss-top-action is-active' : 'amboss-top-action'}
          onClick={onCalculatorToggle}
        >
          <ExamIcon name="calculator" size={17} />
          <span>Calculator</span>
        </button>

        {controller.isCompleted ? (
          <button
            type="button"
            className="amboss-top-action amboss-ai-summary-action"
            onClick={onAiSummary}
          >
            <ExamIcon name="ai-summary" size={17} />
            <span>AI Summary</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
