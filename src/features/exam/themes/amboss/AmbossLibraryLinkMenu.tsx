import { SafeHtml } from '../../shared/SafeHtml';
interface AmbossLibraryLinkMenuProps {
  left: number;
  top: number;
  title: string;
  previewHtml?: string;
  onSplit: () => void;
  onNewTab: () => void;
  onClose: () => void;
}

export function AmbossLibraryLinkMenu({
  left,
  top,
  title,
  previewHtml,
  onSplit,
  onNewTab,
  onClose,
}: AmbossLibraryLinkMenuProps) {
  return (
    <div
      className="amboss-library-link-menu-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="amboss-library-link-menu"
        role="menu"
        aria-label={`Open ${title}`}
        style={{ left, top }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {previewHtml ? (
          <div className="amboss-reference-preview">
            <strong>{title}</strong>
            <SafeHtml html={previewHtml} className="amboss-reference-preview-body" />
          </div>
        ) : null}
        <button type="button" role="menuitem" onClick={onSplit}>
          <span aria-hidden="true">◫</span>
          <span>
            <strong>Open in split view</strong>
            <small>Keep the question open beside the article</small>
          </span>
        </button>
        <button type="button" role="menuitem" onClick={onNewTab}>
          <span aria-hidden="true">↗</span>
          <span>
            <strong>Open in new tab</strong>
            <small>Open the full MedPark Library</small>
          </span>
        </button>
      </div>
    </div>
  );
}
