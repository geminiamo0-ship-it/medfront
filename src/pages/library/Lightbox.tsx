interface LightboxProps {
  src: string | null;
  zoom: number;
  onClose: () => void;
  onZoom: (delta: number) => void;
  onReset: () => void;
  onDownload: () => void;
}

export function Lightbox({ src, zoom, onClose, onZoom, onReset, onDownload }: LightboxProps) {
  return (
    <div id="lb" className={src ? 'open' : ''}>
      <button id="lbcl" onClick={onClose}>
        ✕
      </button>
      <img id="lbimg" src={src ?? ''} alt="" style={{ transform: `scale(${zoom})` }} />
      <div id="lbzl">{Math.round(zoom * 100)}%</div>
      <div id="lbtb">
        <button className="lbb" onClick={() => onZoom(-0.25)} title="Zoom Out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <button className="lbb" onClick={() => onZoom(0.25)} title="Zoom In">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <button className="lbb" onClick={onReset} title="Reset">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
        <button className="lbb" onClick={onDownload} title="Download">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      </div>
    </div>
  );
}