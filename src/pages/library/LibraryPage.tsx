import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getArticle,
  getStructure,
  markRead,
  searchLibrary,
  toggleBookmark,
  type LibraryArticleContent,
  type LibraryArticleRef,
  type LibraryCategory,
} from '@/api/library';
import { MEDIA_CDN } from '@/lib/env';
import { safeRichHtml } from '@/lib/sanitize';
import { LIBRARY_SOURCES } from '@/lib/nav';
import './library.css';

const DARK_KEY = 'dm';

function countArticles(cat: LibraryCategory): number {
  return (
    (cat.articles?.length ?? 0) +
    (cat.children ?? []).reduce((acc, k) => acc + countArticles(k), 0)
  );
}

function fixImageUrls(html: string): string {
  return html.replace(
    /(<img[^>]+src=["'])(?!http|data:)([^"'>]+)(["'])/gi,
    (_m, pre: string, path: string, post: string) => {
      const clean = path.replace(/^\/+/, '');
      return pre + MEDIA_CDN + clean + post;
    },
  );
}

export default function LibraryPage() {
  const [params, setParams] = useSearchParams();

  const [source, setSource] = useState(() => params.get('source') || 'usmle');
  const [sourceOpen, setSourceOpen] = useState(false);

  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [structureLoading, setStructureLoading] = useState(true);
  const [structureError, setStructureError] = useState(false);

  const [articleId, setArticleId] = useState<number | null>(null);
  const [articleTitle, setArticleTitle] = useState('');
  const [article, setArticle] = useState<LibraryArticleContent | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [isRead, setIsRead] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dark, setDark] = useState(() => localStorage.getItem(DARK_KEY) === '1');

  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'title' | 'advanced'>('title');
  const [results, setResults] = useState<LibraryArticleRef[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const articleRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string, err = false) => {
    setToast({ msg: String(msg ?? ''), err });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  const sourceLabel = useMemo(
    () => LIBRARY_SOURCES.find((s) => s.id === source)?.label ?? 'USMLE Step 1-3',
    [source],
  );

  // ── Structure ────────────────────────────────────────────────────────────
  const loadStructure = useCallback(async (src: string) => {
    setStructureLoading(true);
    setStructureError(false);
    try {
      const data = await getStructure(src);
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setStructureError(true);
      setCategories([]);
    } finally {
      setStructureLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStructure(source);
  }, [source, loadStructure]);

  const allArticlesFlat = useMemo(() => {
    const out: LibraryArticleRef[] = [];
    const walk = (c: LibraryCategory) => {
      (c.articles ?? []).forEach((a) =>
        out.push({ ...a, title: a.title || a.name, category: c.name }),
      );
      (c.children ?? []).forEach(walk);
    };
    categories.forEach(walk);
    return out;
  }, [categories]);

  // ── Article ──────────────────────────────────────────────────────────────
  const openArticle = useCallback(
    async (id: number, title: string) => {
      setArticleId(id);
      setArticleTitle(title || 'Article');
      setArticleLoading(true);
      setArticle(null);
      try {
        const art = await getArticle(id);
        setArticle(art);
        setIsRead(!!art.isRead);
        setIsBookmarked(!!art.isBookmarked);
      } catch {
        showToast('Failed to load article', true);
      } finally {
        setArticleLoading(false);
      }
    },
    [showToast],
  );

  const onToggleRead = useCallback(async () => {
    if (!articleId) return;
    try {
      await markRead(articleId);
      setIsRead((v) => !v);
      showToast(isRead ? 'Marked unread' : 'Marked as read');
    } catch {
      showToast('Failed', true);
    }
  }, [articleId, isRead, showToast]);

  const onToggleBookmark = useCallback(async () => {
    if (!articleId) return;
    try {
      await toggleBookmark(articleId);
      setIsBookmarked((v) => !v);
      showToast(isBookmarked ? 'Bookmark removed' : 'Bookmarked');
    } catch {
      showToast('Failed', true);
    }
  }, [articleId, isBookmarked, showToast]);

  const articleHtml = useMemo(() => {
    if (!article) return '';
    const raw =
      article.contentHtml ||
      article.content_html ||
      article.content ||
      '<p style="color:#9ca3af">No content.</p>';
    return safeRichHtml(fixImageUrls(raw));
  }, [article]);

  // Attach image handlers + size the annotation canvas after each article render.
  useEffect(() => {
    const con = articleRef.current;
    if (!con) return;
    con.querySelectorAll('img').forEach((img) => {
      img.style.cursor = 'zoom-in';
      img.onerror = function onerr(this: HTMLImageElement) {
        this.style.display = 'none';
      };
    });
  }, [articleHtml]);

  // ── Source switch ────────────────────────────────────────────────────────
  const switchSource = useCallback(
    (id: string, label: string) => {
      setSource(id);
      setSourceOpen(false);
      setResults(null);
      setQuery('');
      setParams({ source: id }, { replace: true });
      void label;
    },
    [setParams],
  );

  // ── Search ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    const t = window.setTimeout(async () => {
      setSearching(true);
      let combined: LibraryArticleRef[] = [];
      if (searchMode === 'title') {
        const qL = query.trim().toLowerCase();
        combined = allArticlesFlat.filter((a) =>
          (a.title || '').toLowerCase().includes(qL),
        );
      }
      try {
        const d = await searchLibrary(query.trim(), source);
        const remote = Array.isArray(d)
          ? d
          : d.items || d.results || d.articles || [];
        const seen = new Set(combined.map((x) => Number(x.id)));
        for (const item of remote) {
          const idNum = Number(item.id);
          if (!seen.has(idNum)) {
            seen.add(idNum);
            combined.push({
              id: item.id,
              title: item.title || item.name || 'Untitled',
              category: item.category || '',
              excerpt: item.excerpt || '',
              isRead: item.isRead,
              isBookmarked: item.isBookmarked,
            });
          }
        }
      } catch {
        /* keep local results */
      }
      setResults(combined);
      setSearching(false);
    }, 250);
    return () => window.clearTimeout(t);
  }, [query, searchMode, source, allArticlesFlat]);

  // ── Dark mode ────────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(DARK_KEY, dark ? '1' : '0');
  }, [dark]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.();
    else void document.exitFullscreen?.();
  };

  return (
    <div className={`library-root${dark ? ' dark-mode' : ''}`}>
      {/* NAV */}
      <nav id="nav">
        <button
          className="tb"
          id="tnav-sb"
          title="Toggle Sidebar"
          style={{ marginRight: 4 }}
          onClick={() => setSidebarOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>

        <Link to="/hub" className="logo">
          <img src="/favicon.svg" alt="MedPark" />
          <span>MedPark</span>
        </Link>

        <div className="vdiv" />

        <div id="lsw">
          <button id="lbtn" onClick={() => setSourceOpen((o) => !o)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span id="ll">{sourceLabel}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div id="ldd" className={sourceOpen ? 'open' : ''}>
            {LIBRARY_SOURCES.map((s) => (
              <div
                key={s.id}
                className={`lo${s.id === source ? ' active' : ''}`}
                data-s={s.id}
                onClick={() => switchSource(s.id, s.label)}
              >
                {s.label}
              </div>
            ))}
          </div>
        </div>

        <div id="navr">
          <div id="iasw">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input type="text" id="ias" placeholder="Search in article..." disabled />
          </div>
          <button
            className={`tb${dark ? ' act' : ''}`}
            id="tdm"
            title="Toggle Dark Mode"
            onClick={() => setDark((v) => !v)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>
          <button className="tb" title="Fullscreen" onClick={toggleFullscreen}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </button>
          <Link to="/hub" className="abtn">
            ← Hub
          </Link>
        </div>
      </nav>

      {/* LAYOUT */}
      <div id="layout">
        <aside id="sb" className={sidebarOpen ? '' : 'col'}>
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
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="smm">
                <button
                  className={`smb${searchMode === 'title' ? ' act' : ''}`}
                  onClick={() => setSearchMode('title')}
                >
                  Title
                </button>
                <button
                  className={`smb${searchMode === 'advanced' ? ' act' : ''}`}
                  onClick={() => setSearchMode('advanced')}
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
                    onClick={() => {
                      void openArticle(Number(a.id), a.title || a.name || 'Untitled');
                      setQuery('');
                      setResults(null);
                    }}
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
                  <div className="sp" />
                </div>
              )}
              {!structureLoading && structureError && (
                <div style={{ padding: 20, color: '#ef4444', fontSize: 13 }}>
                  ⚠ Failed to load. Check connection.
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
                      activeId={articleId}
                      onOpen={openArticle}
                    />
                  ))
                ))}
            </div>
          </div>
        </aside>

        <button id="sbh" onClick={() => setSidebarOpen((v) => !v)} title="Toggle Sidebar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <main id="main">
          <div id="pane-primary">
            <div id="ahdr">
              <span
                id="atitle"
                style={articleId ? { color: '#111' } : { color: '#9ca3af', fontSize: 14, fontWeight: 400 }}
              >
                {articleId ? articleTitle : 'Select an article from the sidebar'}
              </span>
              <div id="aacts">
                <button
                  className={`abtn${isRead ? ' ra' : ''}`}
                  id="btnr"
                  onClick={() => void onToggleRead()}
                  style={{ display: articleId ? 'flex' : 'none' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {isRead ? 'Read ✓' : 'Mark Read'}
                </button>
                <button
                  className={`abtn${isBookmarked ? ' ba' : ''}`}
                  id="btnb"
                  onClick={() => void onToggleBookmark()}
                  style={{ display: articleId ? 'flex' : 'none' }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill={isBookmarked ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                  {isBookmarked ? 'Bookmarked' : 'Bookmark'}
                </button>
              </div>
            </div>

            <div id="ascroll">
              {!articleId && (
                <div id="empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  <h3>Choose an article</h3>
                  <p style={{ fontSize: 13 }}>Select any article from the sidebar to start reading</p>
                </div>
              )}

              <div id="art-wrap">
                {articleLoading && (
                  <div id="acon" style={{ display: 'block' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="sk" style={{ height: 26, width: i === 0 ? '55%' : '100%' }} />
                      ))}
                    </div>
                  </div>
                )}
                {!articleLoading && article && (
                  <div
                    id="acon"
                    ref={articleRef}
                    style={{ display: 'block' }}
                    dangerouslySetInnerHTML={{ __html: articleHtml }}
                  />
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      <div id="toast" className={toast ? 'show' : ''} style={toast?.err ? { background: '#ef4444' } : undefined}>
        {toast ? toast.msg : ''}
      </div>
    </div>
  );
}

function CategoryNode({
  cat,
  depth,
  defaultOpen,
  activeId,
  onOpen,
}: {
  cat: LibraryCategory;
  depth: number;
  defaultOpen?: boolean;
  activeId: number | null;
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