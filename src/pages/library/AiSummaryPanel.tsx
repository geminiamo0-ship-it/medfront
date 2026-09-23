interface AiSummaryPanelProps {
  content: string;
  onClose: () => void;
}

export function AiSummaryPanel({ content, onClose }: AiSummaryPanelProps) {
  return (
    <div
      id="_aip"
      style={{
        position: 'fixed',
        right: 0,
        top: 52,
        width: 350,
        height: 'calc(100vh - 52px)',
        background: '#fff',
        borderLeft: '1px solid #e5e7eb',
        zIndex: 200,
        padding: 20,
        overflowY: 'auto',
        boxShadow: '-4px 0 20px rgba(0,0,0,.09)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--mp)' }}>✨ AI Summary</h3>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#9ca3af' }}
        >
          ✕
        </button>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{content}</div>
    </div>
  );
}