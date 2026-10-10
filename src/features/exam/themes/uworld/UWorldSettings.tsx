import { useEffect } from 'react';
import { ExamIcon } from '../../shared/ExamIcon';
import type { UWorldAppearance } from './useUWorldPreferences';
interface Props {
  open: boolean;
  appearance: UWorldAppearance;
  split: boolean;
  onAppearance: (a: UWorldAppearance) => void;
  onSplit: (value: boolean) => void;
  onClose: () => void;
}
const palettes: Array<{ id: UWorldAppearance; title: string; caption: string }> = [
  { id: 'blue', title: 'UWorld Blue', caption: 'Original exam-style blue' },
  { id: 'sepia', title: 'Sepia', caption: 'Warm, comfortable study colors' },
  { id: 'dark', title: 'Dark', caption: 'Dim surfaces with soft accents' },
];
export function UWorldSettings({ open, appearance, split, onAppearance, onSplit, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="uw-settings-backdrop" onMouseDown={onClose}>
      <aside className="uw-settings" role="dialog" aria-modal="true" aria-label="UWorld settings"
        onMouseDown={event => event.stopPropagation()}>
        <header className="uw-settings-header">
          <strong>Settings</strong>
          <button type="button" aria-label="Close settings" onClick={onClose}><ExamIcon name="close" size={17}/></button>
        </header>
        <div className="uw-settings-body">
          <h3>Appearance</h3>
          {palettes.map(p => (
            <button type="button" key={p.id} className={'uw-appearance-choice'+(appearance === p.id ? ' is-selected' : '')}
              onClick={() => onAppearance(p.id)} aria-pressed={appearance === p.id}>
              <span className={'uw-swatch is-'+p.id}><i/><i/></span>
              <span><strong>{p.title}</strong><small>{p.caption}</small></span>
            </button>
          ))}
          <div className="uw-settings-separator"/>
          <label className="uw-setting-toggle">
            <span>Split view</span>
            <input type="checkbox" checked={split} onChange={e => onSplit(e.target.checked)}/>
            <span className="uw-toggle-track" aria-hidden="true"/>
          </label>
        </div>
      </aside>
    </div>
  );
}
