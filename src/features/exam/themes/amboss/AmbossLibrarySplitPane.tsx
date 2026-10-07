import { useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';

interface AmbossLibrarySplitPaneProps {
  href: string;
  title: string;
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
  onOpenNewTab: () => void;
}

function toEmbeddedLibraryHref(href: string): string {
  if (typeof window === 'undefined') return href;
  const url = new URL(href, window.location.origin);
  url.searchParams.set('embedded', '1');
  return `${url.pathname}${url.search}${url.hash}`;
}

export function AmbossLibrarySplitPane({
  href,
  title,
  width,
  onWidthChange,
  onClose,
  onOpenNewTab,
}: AmbossLibrarySplitPaneProps) {
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const embeddedHref = useMemo(() => toEmbeddedLibraryHref(href), [href]);

  function onResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: width,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function onResizeMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const maxWidth = Math.max(420, Math.floor(window.innerWidth * 0.78));
    const next = Math.max(
      360,
      Math.min(maxWidth, drag.current.startWidth + (drag.current.startX - event.clientX)),
    );
    onWidthChange(next);
  }

  function onResizeEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    drag.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture can already be released by the browser.
    }
  }

  return (
    <aside
      className="amboss-library-split"
      style={{ width }}
      aria-label={`Library article: ${title}`}
    >
      <div
        className="amboss-library-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize library split view"
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
      />
      <div className="amboss-library-split-head">
        <strong title={title}>{title || 'AMBOSS Library'}</strong>
        <div>
          <button type="button" onClick={onOpenNewTab} aria-label="Open article in new tab">
            ↗
          </button>
          <button type="button" onClick={onClose} aria-label="Close library split view">
            ×
          </button>
        </div>
      </div>
      <iframe
        className="amboss-library-frame"
        src={embeddedHref}
        title={`MedPark Library — ${title || 'AMBOSS article'}`}
      />
    </aside>
  );
}
