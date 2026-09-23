export interface ImageViewerData {
  imgSrc: string;
  title: string;
  descHtml: string;
  overlaySrc: string;
  showOverlay: boolean;
  zoom: number;
}

interface AmbossImageViewerProps {
  data: ImageViewerData;
  /** Merge partial state into the viewer (zoom, showOverlay, …). */
  onUpdate: (patch: Partial<ImageViewerData>) => void;
  onClose: () => void;
}

export function AmbossImageViewer({ data, onUpdate, onClose }: AmbossImageViewerProps) {
  const clampZoom = (z: number) => Math.max(0.4, Math.min(4, z));

  return (
    <div id="amboss-image-viewer-modal" className="open">
      <div id="aiv-sidebar">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div className="tab-pill active" style={{ cursor: 'default' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="9" x2="15" y2="9" />
              <line x1="9" y1="13" x2="15" y2="13" />
            </svg>
            Description
          </div>
          {data.overlaySrc && (
            <div
              className="tab-pill"
              id="aiv-overlay-btn"
              onClick={() => onUpdate({ showOverlay: !data.showOverlay })}
              style={{
                cursor: 'pointer',
                background: data.showOverlay ? '#38bdf8' : 'transparent',
                border: '1px solid #38bdf8',
                color: data.showOverlay ? '#0f172a' : '#38bdf8',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              Overlay
            </div>
          )}
        </div>
        <div id="aiv-title">{data.title}</div>
        <div id="aiv-desc" dangerouslySetInnerHTML={{ __html: data.descHtml }} />
        <div id="aiv-copy">© AMBOSS • MedPark Medical Library</div>
      </div>
      <div id="aiv-canvas">
        <button id="aiv-close-btn" onClick={onClose}>
          ✕
        </button>
        <div
          id="aiv-img-wrapper"
          style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <img
            id="aiv-img"
            src={data.imgSrc}
            alt=""
            style={{
              maxWidth: '92%',
              maxHeight: '88%',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              transition: 'transform .2s cubic-bezier(0.4, 0, 0.2, 1)',
              userSelect: 'none',
              zIndex: 1,
              position: 'relative',
              transform: `scale(${data.zoom})`,
            }}
          />
          <img
            id="aiv-overlay"
            src={data.overlaySrc}
            alt=""
            style={{
              position: 'absolute',
              maxWidth: '92%',
              maxHeight: '88%',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
              display: data.showOverlay ? 'block' : 'none',
              zIndex: 2,
              transition: 'transform .2s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: `scale(${data.zoom})`,
            }}
          />
        </div>
        <div id="aiv-toolbar">
          <button
            className="aiv-tb-btn"
            onClick={() => onUpdate({ zoom: clampZoom(data.zoom - 0.25) })}
            title="Zoom Out"
          >
            −
          </button>
          <button
            className="aiv-tb-btn"
            onClick={() => onUpdate({ zoom: clampZoom(data.zoom + 0.25) })}
            title="Zoom In"
          >
            +
          </button>
          <button className="aiv-tb-btn" onClick={() => onUpdate({ zoom: 1 })} title="Reset Zoom">
            ↺
          </button>
          <button
            className="aiv-tb-btn"
            title="Download"
            onClick={() => {
              const a = document.createElement('a');
              a.href = data.imgSrc;
              a.download = 'amboss-image.jpg';
              a.click();
            }}
          >
            ↓
          </button>
        </div>
      </div>
    </div>
  );
}