import { Link } from 'react-router-dom';
import { LIBRARY_SOURCES } from '@/lib/nav';

export type AnnotationToolName = 'pencil' | 'highlighter' | 'eraser' | 'laser' | null;

interface LibraryNavbarProps {
  onToggleSidebar: () => void;
  sourceLabel: string;
  sourceOpen: boolean;
  onSourceOpenChange: (open: boolean) => void;
  source: string;
  onSwitchSource: (id: string, label: string) => void;
  annotationTool: AnnotationToolName;
  annotationColor: string;
  onAnnotationTool: (tool: AnnotationToolName) => void;
  onAnnotationColor: (color: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  iaQuery: string;
  onIaQueryChange: (value: string) => void;
  /** Called on Enter in the in-article search field; `shift` picks previous match. */
  onIaNavigate: (shift: boolean) => void;
  iaCurrent: number;
  iaTotal: number;
  nbOpen: boolean;
  onToggleNotebook: () => void;
  dark: boolean;
  onToggleDark: () => void;
  onToggleFullscreen: () => void;
}

export function LibraryNavbar({
  onToggleSidebar,
  sourceLabel,
  sourceOpen,
  onSourceOpenChange,
  source,
  onSwitchSource,
  annotationTool,
  annotationColor,
  onAnnotationTool,
  onAnnotationColor,
  onUndo,
  onRedo,
  iaQuery,
  onIaQueryChange,
  onIaNavigate,
  iaCurrent,
  iaTotal,
  nbOpen,
  onToggleNotebook,
  dark,
  onToggleDark,
  onToggleFullscreen,
}: LibraryNavbarProps) {
  return (
    <nav id="nav">
      <button
        className="tb"
        id="tnav-sb"
        title="Toggle Sidebar"
        style={{ marginRight: 4 }}
        onClick={onToggleSidebar}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      </button>

      <Link to="/hub" className="logo">
        <img src="/favicon.svg" alt="MedPark" />
        <span>MedPark</span>
      </Link>

      <div className="vdiv" />

      <div id="lsw">
        <button id="lbtn" onClick={() => onSourceOpenChange(!sourceOpen)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span id="ll">{sourceLabel}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div id="ldd" className={sourceOpen ? 'open' : ''}>
          {LIBRARY_SOURCES.map((s) => (
            <div
              key={s.id}
              className={`lo${s.id === source ? ' active' : ''}`}
              data-s={s.id}
              onClick={() => onSwitchSource(s.id, s.label)}
            >
              {s.label}
            </div>
          ))}
        </div>
      </div>

      <div className="vdiv" />
      <button
        className={`tb${annotationTool === 'pencil' ? ' act' : ''}`}
        id="tp"
        title="Pencil"
        onClick={() => onAnnotationTool('pencil')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
      </button>
      <button
        className={`tb${annotationTool === 'highlighter' ? ' act' : ''}`}
        id="th"
        title="Highlighter"
        onClick={() => onAnnotationTool('highlighter')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m9 11-6 6v3h3l6-6" />
          <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
        </svg>
      </button>
      <button
        className={`tb${annotationTool === 'eraser' ? ' act' : ''}`}
        id="te"
        title="Eraser"
        onClick={() => onAnnotationTool('eraser')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
          <path d="M22 21H7" />
        </svg>
      </button>
      <button
        className={`tb${annotationTool === 'laser' ? ' act' : ''}`}
        id="tl"
        title="Laser"
        onClick={() => onAnnotationTool('laser')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      </button>
      <div className="tsep" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {['#facc15', '#86efac', '#93c5fd', '#fca5a5', '#c4b5fd'].map((c) => (
          <div
            key={c}
            className={`cd${annotationColor === c ? ' sel' : ''}`}
            style={{ background: c }}
            onClick={() => onAnnotationColor(c)}
          />
        ))}
      </div>
      <div className="tsep" />
      <button className="tb" title="Undo Ctrl+Z" onClick={onUndo}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
      </button>
      <button className="tb" title="Redo Ctrl+Y" onClick={onRedo}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 7v6h-6" />
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
        </svg>
      </button>

      <div id="navr">
        <div id="iasw">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            id="ias"
            placeholder="Search in article..."
            value={iaQuery}
            onChange={(e) => onIaQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onIaNavigate(e.shiftKey);
              }
            }}
          />
          <span id="iac" style={{ display: iaTotal ? 'inline' : 'none', fontSize: 11, color: '#9ca3af' }}>
            {iaCurrent}/{iaTotal}
          </span>
        </div>
        <button
          className={`tb${nbOpen ? ' act' : ''}`}
          id="tnb"
          title="Notebook"
          onClick={onToggleNotebook}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </button>
        <button
          className={`tb${dark ? ' act' : ''}`}
          id="tdm"
          title="Toggle Dark Mode"
          onClick={onToggleDark}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>
        <button className="tb" title="Fullscreen" onClick={onToggleFullscreen}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
        <Link to="/hub" className="abtn">
          ← Hub
        </Link>
      </div>
    </nav>
  );
}