import type { LibraryArticleRef, LibraryCategory } from '@/api/library';
import { PulseLoader } from '@/components/PulseLoader';
import { CategoryNode } from './CategoryNode';

export interface StructureLocked {
  retryAfterSeconds?: number;
}

interface LibrarySidebarProps {
  collapsed: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  searchMode: 'title' | 'advanced';
  onSearchModeChange: (mode: 'title' | 'advanced') => void;
  results: LibraryArticleRef[] | null;
  searching: boolean;
  onOpenSearchResult: (id: number, title: string) => void;
  structureLoading: boolean;
  structureError: boolean;
  structureLocked: StructureLocked | null;
  onRetryStructure: () => void;
  categories: LibraryCategory[];
  activeId: number | string | null;
  onOpenArticle: (id: number | string, title: string) => void;
}

export function LibrarySidebar({
  collapsed,
  query,
  onQueryChange,
  searchMode,
  onSearchModeChange,
  results,
  searching,
  onOpenSearchResult,
  structureLoading,
  structureError,
  structureLocked,
  onRetryStructure,
  categories,
  activeId,
  onOpenArticle,
}: LibrarySidebarProps) {
  return (
    <aside id="sb" className={collapsed ? 'col' : ''}>
      <div id="sbin">
        <div id="sbtop">
          <div id="sw">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              id="si"
              placeholder="Search articles..."
              autoComplete="off"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
          </div>
          <div className="smm">
            <button
              className={`smb${searchMode === 'title' ? ' act' : ''}`}
              onClick={() => onSearchModeChange('title')}
            >
              Title
            </button>
            <button
              className={`smb${searchMode === 'advanced' ? ' act' : ''}`}
              onClick={() => onSearchModeChange('advanced')}
            >
              Advanced
            </button>
          </div>
          <div id="sr" style={{ display: results ? 'block' : 'none' }}>
            {searching && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: '#9ca3af' }}>
                Searching...
              </div>
            )}
            {results && !searching && results.length === 0 && (
              <div style={{ padding: 12, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                No articles found.
              </div>
            )}
            {results?.slice(0, 25).map((a) => (
              <div
                key={a.id}
                className="sri"
                onClick={() => onOpenSearchResult(Number(a.id), a.title || a.name || 'Untitled')}
              >
                <div style={{ fontWeight: 500, color: '#1f2937', fontSize: 13 }}>
                  {a.title || a.name}
                </div>
                <div className="sc" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{a.category}</span>
                  <span style={{ display: 'flex', gap: 3 }}>
                    {a.isRead && <span style={{ color: '#10b981', fontSize: 10 }}>✓</span>}
                    {a.isBookmarked && <span style={{ color: '#f59e0b', fontSize: 10 }}>★</span>}
                  </span>
                </div>
                {searchMode === 'advanced' && a.excerpt && (
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{a.excerpt}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div id="tw">
          {structureLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180 }}>
              <PulseLoader size={56} label="Loading library" />
            </div>
          )}
          {!structureLoading && structureError && (
            <div style={{ padding: 16, color: '#ef4444', fontSize: 13 }}>
              {structureLocked ? (
                <>
                  <div>🔒 Temporarily locked by the server.</div>
                  <div style={{ marginTop: 4, color: '#9ca3af' }}>
                    {structureLocked.retryAfterSeconds
                      ? `Try again in ~${structureLocked.retryAfterSeconds}s.`
                      : 'Please try again shortly.'}
                  </div>
                  <button
                    onClick={onRetryStructure}
                    style={{
                      marginTop: 10,
                      padding: '4px 10px',
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid #e5e7eb',
                      background: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                </>
              ) : (
                '⚠ Failed to load. Check connection.'
              )}
            </div>
          )}
          {!structureLoading &&
            !structureError &&
            (categories.length === 0 ? (
              <div style={{ padding: 20, color: '#9ca3af', fontSize: 13 }}>
                No articles found.
              </div>
            ) : (
              categories.map((c, i) => (
                <CategoryNode
                  key={c.id ?? i}
                  cat={c}
                  depth={0}
                  defaultOpen={i === 0}
                  activeId={activeId}
                  onOpen={onOpenArticle}
                />
              ))
            ))}
        </div>
      </div>
    </aside>
  );
}