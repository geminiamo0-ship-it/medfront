import { useState } from 'react';
import type { LibraryCategory } from '@/api/library';
import { countArticles } from './utils';

export function CategoryNode({
  cat,
  depth,
  defaultOpen,
  activeId,
  onOpen,
}: {
  cat: LibraryCategory;
  depth: number;
  defaultOpen?: boolean;
  activeId: number | string | null;
  onOpen: (id: number, title: string) => void;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const total = countArticles(cat);

  return (
    <div className="tcat">
      <div
        className="cath"
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => setOpen((o) => !o)}
      >
        <svg
          className={`arr${open ? ' open' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {cat.name}
        </span>
        <span className="cn">{total}</span>
      </div>
      <div className={`cch${open ? ' open' : ''}`}>
        {(cat.articles ?? []).map((a) => (
          <div
            key={a.id}
            className={`ait${activeId === Number(a.id) ? ' act' : ''}`}
            data-id={a.id}
            style={{ paddingLeft: 6 + (depth + 1) * 14 }}
            onClick={() => onOpen(Number(a.id), a.title || a.name || 'Untitled')}
          >
            <span className="an">{a.title || a.name}</span>
            <span className="inds">
              {a.isRead && <span className="ir">✓</span>}
              {a.isBookmarked && <span className="ib">★</span>}
            </span>
          </div>
        ))}
        {(cat.children ?? []).map((k) => (
          <CategoryNode
            key={k.id}
            cat={k}
            depth={depth + 1}
            activeId={activeId}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}