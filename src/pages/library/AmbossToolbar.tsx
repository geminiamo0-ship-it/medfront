interface AmbossToolbarProps {
  /** Whether the current source is AMBOSS (controls are hidden otherwise). */
  visible: boolean;
  keyExam: boolean;
  highYield: boolean;
  onToggleKeyExam: () => void;
  onToggleAllCards: () => void;
  onToggleHighYield: () => void;
}

export function AmbossToolbar({
  visible,
  keyExam,
  highYield,
  onToggleKeyExam,
  onToggleAllCards,
  onToggleHighYield,
}: AmbossToolbarProps) {
  return (
    <div
      id="amboss-controls"
      style={{
        display: visible ? 'flex' : 'none',
        alignItems: 'center',
        gap: 6,
        marginRight: 8,
      }}
    >
      <button
        className={`amboss-toggle-btn${keyExam ? ' active-ke' : ''}`}
        id="btn-ke"
        onClick={onToggleKeyExam}
        title="Shortcut: K"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m21 2-2 2m-6 6 7 7-3 3-7-7m-4 4L2 22l6-6m2-2 1-1" />
        </svg>
        <span id="txt-ke">{keyExam ? 'Key exam info on' : 'Key exam info off'}</span>
      </button>
      <button
        className="amboss-toggle-btn"
        onClick={onToggleAllCards}
        title="Expand or collapse all sections"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="7 15 12 9 17 15" />
        </svg>
        Toggle All
      </button>
      <button
        className={`amboss-toggle-btn${highYield ? ' active-ke' : ''}`}
        onClick={onToggleHighYield}
        title="Show or hide condensed (extra) content"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M4 6h16M4 12h10M4 18h16" />
        </svg>
        {highYield ? 'High-yield on' : 'High-yield off'}
      </button>
    </div>
  );
}