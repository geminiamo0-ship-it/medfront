import type { CSSProperties } from 'react';
import type { UWorldTool } from './UWorldTopbar';
import { UWorldTopbarIcon } from './UWorldTopbarIcon';
import type { ExamIconName } from '../../shared/ExamIcon';

interface Props {
  id: string;
  open: boolean;
  markerActive: boolean;
  onTool: (tool: UWorldTool) => void;
  onFullscreen: () => void;
  onMarker: () => void;
  onAppearance: () => void;
  onClose: () => void;
}

const tools: Array<{ label: string; icon: ExamIconName; tool?: UWorldTool }> = [
  { label: 'Shortcuts', icon: 'shortcuts', tool: 'shortcuts' },
  { label: 'Full Screen', icon: 'full-screen' },
  { label: 'Marker', icon: 'marker' },
  { label: 'Lab Values', icon: 'lab-values', tool: 'labs' },
  { label: 'Notes', icon: 'notes', tool: 'notes' },
  { label: 'Calculator', icon: 'calculator', tool: 'calculator' },
  { label: 'Appearance & Layout', icon: 'settings' },
];

export function UWorldMobileTools({
  id, open, markerActive, onTool, onFullscreen, onMarker, onAppearance, onClose,
}: Props) {
  function activate(label: string, tool?: UWorldTool) {
    onClose();
    if (tool) onTool(tool);
    else if (label === 'Full Screen') onFullscreen();
    else if (label === 'Marker') onMarker();
    else onAppearance();
  }

  return (
    <div id={id} className={'uw-mobile-tools-tray' + (open ? ' is-open' : '')}
      role="group" aria-label="Additional exam tools" aria-hidden={!open}>
      <div className="uw-mobile-tools-rail">
        {tools.map((item, index) => (
          <button key={item.label} type="button" className="uw-mobile-tray-action"
            style={{ '--uw-orb-index': index } as CSSProperties}
            title={item.label}
            onClick={() => activate(item.label, item.tool)}
            disabled={!open}
            aria-label={item.label}
            aria-pressed={item.label === 'Marker' ? markerActive : undefined}>
            <span className="uw-mobile-action-orb"><UWorldTopbarIcon name={item.icon} size={21}/></span>
            <span className="uw-mobile-action-label">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
