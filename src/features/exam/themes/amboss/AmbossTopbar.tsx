import { useState } from 'react';
import type { ExamRunnerController } from '../../core/useExamRunner';
import { ExamIcon } from '../../shared/ExamIcon';

export type AmbossToolMode = 'marker' | 'pencil' | 'laser' | null;
export type AmbossAppearance = 'light' | 'dark';
export type AmbossTextSize = 'compact' | 'normal' | 'large';

const TOOL_COLORS = [
  { name: 'Yellow', value: '#f6d84a' },
  { name: 'Green', value: '#63c174' },
  { name: 'Blue', value: '#5aa7e8' },
  { name: 'Red', value: '#e76868' },
  { name: 'Purple', value: '#9b7be5' },
  { name: 'Pink', value: '#e983b6' },
] as const;

interface AmbossTopbarProps {
  controller: ExamRunnerController;
  onToggleSidebar: () => void;
  appearance: AmbossAppearance;
  onAppearanceChange: (value: AmbossAppearance) => void;
  textSize: AmbossTextSize;
  onTextSizeChange: (value: AmbossTextSize) => void;
  activeTool: AmbossToolMode;
  onToolChange: (value: AmbossToolMode) => void;
  markerColor: string;
  onMarkerColorChange: (value: string) => void;
  pencilColor: string;
  onPencilColorChange: (value: string) => void;
  calculatorOpen: boolean;
  onCalculatorToggle: () => void;
  onSuspendRequest: () => void;
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

function ColorPalette({
  value,
  onChange,
  onActivate,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  onActivate: () => void;
  label: string;
}) {
  return (
    <div className="amboss-color-config">
      <div className="amboss-color-grid" aria-label={`${label} colors`}>
        {TOOL_COLORS.map((color) => (
          <button
            type="button"
            key={color.value}
            aria-label={`${label} ${color.name}`}
            title={color.name}
            className={value.toLowerCase() === color.value.toLowerCase() ? 'amboss-color-swatch is-active' : 'amboss-color-swatch'}
            style={{ '--amboss-tool-choice': color.value } as React.CSSProperties}
            onClick={() => {
              onChange(color.value);
              onActivate();
            }}
          />
        ))}
        <label className="amboss-color-custom" title={`Custom ${label.toLowerCase()} color`}>
          <input
            type="color"
            value={value}
            aria-label={`Custom ${label.toLowerCase()} color`}
            onChange={(event) => {
              onChange(event.target.value);
              onActivate();
            }}
          />
          <span>+</span>
        </label>
      </div>
    </div>
  );
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
  markerColor,
  onMarkerColorChange,
  pencilColor,
  onPencilColorChange,
  calculatorOpen,
  onCalculatorToggle,
  onSuspendRequest,
  onEndBlockRequest,
  onAiSummary,
}: AmbossTopbarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const lifecyclePending =
    controller.suspendMutation.isPending ||
    controller.resumeMutation.isPending ||
    controller.completeTestMutation.isPending ||
    controller.timedBlockMutation.isPending;

  const activeToolColor =
    activeTool === 'marker' ? markerColor : activeTool === 'pencil' ? pencilColor : null;

  const canEndBlock =
    !controller.isCompleted &&
    (controller.isTimed || controller.test?.type === 'tutor');

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
            {activeToolColor ? (
              <span
                className="amboss-active-tool-swatch"
                style={{ '--amboss-active-tool-color': activeToolColor } as React.CSSProperties}
                aria-hidden="true"
              />
            ) : null}
            <span>Tools</span>
          </button>

          {toolsOpen ? (
            <div className="amboss-top-popover amboss-tools-popover">
              <div className={activeTool === 'marker' ? 'amboss-tool-config is-active' : 'amboss-tool-config'}>
                <button
                  type="button"
                  className="amboss-popover-action"
                  onClick={() => onToolChange(activeTool === 'marker' ? null : 'marker')}
                >
                  <span style={{ color: markerColor }}><ExamIcon name="marker" size={17} /></span>
                  <span>Marker</span>
                  <span className="amboss-tool-current-color" style={{ background: markerColor }} aria-hidden="true" />
                </button>
                <ColorPalette
                  label="Marker"
                  value={markerColor}
                  onChange={onMarkerColorChange}
                  onActivate={() => onToolChange('marker')}
                />
              </div>

              <div className={activeTool === 'pencil' ? 'amboss-tool-config is-active' : 'amboss-tool-config'}>
                <button
                  type="button"
                  className="amboss-popover-action"
                  onClick={() => onToolChange(activeTool === 'pencil' ? null : 'pencil')}
                >
                  <span style={{ color: pencilColor }}><ExamIcon name="pencil" size={17} /></span>
                  <span>Pencil</span>
                  <span className="amboss-tool-current-color" style={{ background: pencilColor }} aria-hidden="true" />
                </button>
                <ColorPalette
                  label="Pencil"
                  value={pencilColor}
                  onChange={onPencilColorChange}
                  onActivate={() => onToolChange('pencil')}
                />
              </div>

              <button
                type="button"
                className={activeTool === 'laser' ? 'amboss-popover-action is-active' : 'amboss-popover-action'}
                onClick={() => {
                  onToolChange(activeTool === 'laser' ? null : 'laser');
                  setToolsOpen(false);
                }}
              >
                <ExamIcon name="laser" size={17} />
                <span>Laser</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="amboss-topbar-zone amboss-topbar-center">
        {!controller.isCompleted ? (
          <button
            type="button"
            className="amboss-top-action amboss-lifecycle-action"
            onClick={controller.isSuspended ? controller.resumeTest : onSuspendRequest}
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

        {canEndBlock ? (
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
