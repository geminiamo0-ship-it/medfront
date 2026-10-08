import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { safeRichHtml } from '@/lib/sanitize';
import './amboss-image-viewer.css';

export interface ImageViewerData {
  imgSrc: string;
  title: string;
  descHtml: string;
  overlaySrc: string;
  showOverlay: boolean;
  zoom: number;
  imgAlt?: string;
}

interface AmbossImageViewerProps {
  data: ImageViewerData;
  onUpdate: (patch: Partial<ImageViewerData>) => void;
  onClose: () => void;
  /** The Exam Runner delays visible explanations; Library defaults to true. */
  showDescription?: boolean;
}

export function AmbossImageViewer({
  data,
  onUpdate,
  onClose,
  showDescription = true,
}: AmbossImageViewerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [failedImage, setFailedImage] = useState(false);
  const [failedOverlay, setFailedOverlay] = useState(false);
  const clampZoom = (z: number) => Math.max(0.4, Math.min(4, z));

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      // Keep keyboard users in the open modal without losing focus in the exam.
      if (event.key === 'Tab') {
        const dialog = document.getElementById('amboss-image-viewer-modal');
        const buttons = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
        if (!buttons.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  const modal = (
    <div id="amboss-image-viewer-modal" className="open" role="dialog" aria-modal="true" aria-labelledby="aiv-title">
      <div id="aiv-sidebar">
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          {showDescription ? (
            <span className="tab-pill active">Description</span>
          ) : (
            <span className="tab-pill active">Image preview</span>
          )}
          {data.overlaySrc ? (
            <button
              type="button"
              className="tab-pill"
              id="aiv-overlay-btn"
              onClick={() => onUpdate({ showOverlay: !data.showOverlay })}
              aria-pressed={data.showOverlay}
              style={{
                cursor:'pointer',
                background:data.showOverlay ? '#38bdf8' : 'transparent',
                border:'1px solid #38bdf8',
                color:data.showOverlay ? '#0f172a' : '#38bdf8',
              }}
            >
              {data.showOverlay ? 'HIDE OVERLAY' : 'SHOW OVERLAY'}
            </button>
          ) : null}
        </div>
        <div id="aiv-title">{data.title || 'Medical Illustration'}</div>
        {showDescription ? (
          <div id="aiv-desc" dangerouslySetInnerHTML={{ __html:safeRichHtml(data.descHtml) }} />
        ) : (
          <div className="aiv-no-description">Clinical description is available after the answer is revealed.</div>
        )}
        <div id="aiv-copy">© AMBOSS • MedPark Medical Library</div>
      </div>
      <div id="aiv-canvas">
        <button type="button" ref={closeRef} id="aiv-close-btn" onClick={onClose} aria-label="Close image viewer">✕</button>
        <div id="aiv-img-wrapper" style={{
          position:'relative',width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',
        }}>
          {failedImage ? (
            <div className="aiv-image-error" role="status">Image unavailable. Check the uploaded media file.</div>
          ) : (
            <>
              <img
                id="aiv-img" src={data.imgSrc} alt={data.imgAlt || data.title || 'Medical illustration'}
                onError={() => setFailedImage(true)}
                style={{
                  maxWidth:'92%',maxHeight:'88%',width:'100%',height:'100%',objectFit:'contain',
                  transition:'transform .2s cubic-bezier(0.4, 0, 0.2, 1)',userSelect:'none',
                  zIndex:1,position:'relative',transform: 'scale(' + data.zoom + ')',
                }}
              />
              {data.overlaySrc && data.showOverlay && !failedOverlay ? (
                <img
                  id="aiv-overlay" src={data.overlaySrc} alt="" aria-hidden="true"
                  onError={() => setFailedOverlay(true)}
                  style={{
                    position:'absolute',maxWidth:'92%',maxHeight:'88%',width:'100%',height:'100%',
                    objectFit:'contain',pointerEvents:'none',zIndex:2,
                    transition:'transform .2s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform:'scale(' + data.zoom + ')',
                  }}
                />
              ) : null}
              {failedOverlay && data.showOverlay ? (
                <div role="status" className="aiv-image-error" style={{position:'absolute',bottom:65,zIndex:3}}>
                  Overlay unavailable
                </div>
              ) : null}
            </>
          )}
        </div>
        <div id="aiv-toolbar">
          <button type="button" className="aiv-tb-btn" onClick={() => onUpdate({ zoom:clampZoom(data.zoom - .25) })} title="Zoom Out" aria-label="Zoom Out">−</button>
          <button type="button" className="aiv-tb-btn" onClick={() => onUpdate({ zoom:clampZoom(data.zoom + .25) })} title="Zoom In" aria-label="Zoom In">+</button>
          <button type="button" className="aiv-tb-btn" onClick={() => onUpdate({ zoom:1 })} title="Reset Zoom" aria-label="Reset Zoom">↺</button>
          <button type="button" className="aiv-tb-btn" title="Download" aria-label="Download image" onClick={() => {
            const link = document.createElement('a');
            link.href = data.imgSrc;
            link.download = 'amboss-image.jpg';
            link.click();
          }}>↓</button>
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}
