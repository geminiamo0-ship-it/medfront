export interface PopoverData {
  title: string;
  bodyHtml: string;
  showFooter: boolean;
  targetId: string;
  anchor: string;
  left: number;
  top: number;
}

interface AmbossPopoverProps {
  data: PopoverData;
  /** Clear the close-delay timer while the pointer is over the popover. */
  onEnter: () => void;
  /** Schedule a delayed close while the pointer leaves the popover. */
  onLeave: () => void;
  onClose: () => void;
  /** Navigate to the referenced article ('open' replaces, 'split' opens side-by-side). */
  onGoToReference: (targetId: string, title: string, anchor: string, mode: 'open' | 'split') => void;
  /** Directly open the referenced article (footer ↗ button). */
  onOpenDirect: (targetId: string, title: string) => void;
}

export function AmbossPopover({
  data,
  onEnter,
  onLeave,
  onClose,
  onGoToReference,
  onOpenDirect,
}: AmbossPopoverProps) {
  return (
    <div
      id="amboss-popover"
      style={{ display: 'block', left: data.left, top: data.top }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="pop-title">
        <span id="pop-title-text">{data.title}</span>
        <button className="pop-close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div
        id="pop-body-text"
        style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 8 }}
        dangerouslySetInnerHTML={{ __html: data.bodyHtml }}
      />
      <div
        id="pop-footer"
        style={{
          display: data.showFooter ? 'flex' : 'none',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          padding: '8px 12px',
          margin: '8px -16px -14px',
          borderRadius: '0 0 8px 8px',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div
          id="pop-link-title"
          style={{
            color: '#0d9488',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'underline',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title="Click to view article"
          onClick={() => onGoToReference(data.targetId, data.title, data.anchor, 'open')}
        >
          📖 <span id="pop-article-name">{data.title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            id="pop-btn-split"
            style={{
              background: '#e2e8f0',
              border: 'none',
              borderRadius: 4,
              padding: '3px 7px',
              fontSize: 11,
              fontWeight: 600,
              color: '#0f172a',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
            title="Open in Split Screen (Side-by-Side)"
            onClick={() => onGoToReference(data.targetId, data.title, data.anchor, 'split')}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="12" y1="3" x2="12" y2="21" />
            </svg>
            Split
          </button>
          <button
            id="pop-btn-open"
            style={{ background: '#0d9488', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 7px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            title="Direct Navigate"
            onClick={() => onOpenDirect(data.targetId, data.title)}
          >
            ↗
          </button>
        </div>
      </div>
    </div>
  );
}