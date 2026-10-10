import { useRef, type CSSProperties } from 'react';
interface Props { width: number; onChange: (width: number) => void; }
export function UWorldSplitter({ width, onChange }: Props) {
  const dragging = useRef(false);
  function adjustAt(clientX: number, target: HTMLElement) {
    const container = target.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    onChange(Math.max(25, Math.min(75, ((clientX - rect.left) / rect.width) * 100)));
  }
  return <div className="uw-splitter" role="separator" aria-label="Resize question and explanation"
    aria-orientation="vertical" aria-valuemin={25} aria-valuemax={75} aria-valuenow={Math.round(width)}
    tabIndex={0} style={{ '--uw-split': `${width}%` } as CSSProperties}
    onPointerDown={e => {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      adjustAt(e.clientX, e.currentTarget);
    }}
    onPointerMove={e => { if (dragging.current) adjustAt(e.clientX, e.currentTarget); }}
    onPointerUp={e => { dragging.current = false; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
    onPointerCancel={() => { dragging.current = false; }}
    onKeyDown={e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      onChange(Math.max(25, Math.min(75, width + (e.key === 'ArrowLeft' ? -5 : 5))));
    }} />;
}
