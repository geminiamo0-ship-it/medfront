interface AmbossLibraryLinkMenuProps {
  left: number;
  top: number;
  title: string;
  onSplit: () => void;
  onNewTab: () => void;
  onClose: () => void;
}

export function AmbossLibraryLinkMenu({
  left,
  top,
  title,
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
