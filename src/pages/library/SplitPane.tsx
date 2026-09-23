import type { Ref } from 'react';

export interface SplitData {
  title: string;
  html: string;
  loading: boolean;
}

interface SplitPaneProps {
  data: SplitData;
  /** Ref to the scroll content div; parent effects read from it. */
  contentRef: Ref<HTMLDivElement>;
  onClose: () => void;
}

export function SplitPane({ data, contentRef, onClose }: SplitPaneProps) {
  return (
    <div
      id="pane-sec"
      style={{
        display: 'flex',
        width: '50%',
        borderLeft: '2px solid #cbd5e1',
        background: '#fff',
        flexDirection: 'column',
        height: '100%',
        minWidth: 320,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 20,
        boxShadow: '-4px 0 16px rgba(0,0,0,.08)',
      }}
    >
      <div
        id="pane-sec-header"
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="12" y1="3" x2="12" y2="21" />
          </svg>
          <span id="pane-sec-title">{data.title}</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', fontSize: 17, cursor: 'pointer', color: '#64748b', padding: '2px 6px', borderRadius: 4 }}
          title="Close Split View"
        >
          ✕
        </button>
      </div>
      <div id="pane-sec-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#f8fafc' }}>
        {data.loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <div className="sp" />
          </div>
        ) : (
          <div
            id="pane-sec-content"
            ref={contentRef}
            className="amboss-mode"
            style={{ maxWidth: 800, margin: '0 auto' }}
            dangerouslySetInnerHTML={{ __html: data.html }}
          />
        )}
      </div>
    </div>
  );
}