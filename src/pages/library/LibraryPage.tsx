import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import {
  getArticle,
  getStructure,
  markRead,
  requestAiSummary,
  searchLibrary,
  toggleBookmark,
  type LibraryArticleContent,
  type LibraryArticleRef,
  type LibraryCategory,
} from '@/api/library';
import { createNote, getNotes, updateNote, type NotebookNote } from '@/api/notebook';
import { createTest, getQuestionBanks, getSystemsWithTopics } from '@/api/tests';
import { MEDIA_CDN } from '@/lib/env';
import { safeRichHtml } from '@/lib/sanitize';
import { LIBRARY_SOURCES } from '@/lib/nav';
import {
  fixOfflineMedia,
  restoreInlineStyles,
  setupAmbossInteractions,
  stripInlineStylesForDark,
  transformToAmbossCards,
} from './amboss';
import { useAnnotations } from './useAnnotations';
import { Toast } from './Toast';
import { Lightbox } from './Lightbox';
import { AmbossImageViewer, type ImageViewerData } from './AmbossImageViewer';
import { ImageHoverCard } from './ImageHoverCard';
import { AmbossPopover, type PopoverData } from './AmbossPopover';
import { AiSummaryPanel } from './AiSummaryPanel';
import { SplitPane, type SplitData } from './SplitPane';
import { AmbossToolbar } from './AmbossToolbar';
import { LibrarySidebar } from './LibrarySidebar';
import {
  clearMarks,
  DARK_KEY,
  fixImageUrls,
  scrollToAnchor,
  wrapMatches,
} from './utils';
import './library.css';

export default function LibraryPage() {
  const [params, setParams] = useSearchParams();

  const [source, setSource] = useState(() => params.get('source') || 'usmle');
  const [sourceOpen, setSourceOpen] = useState(false);

  const [articleId, setArticleId] = useState<number | string | null>(null);
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

  const [iaQuery, setIaQuery] = useState('');
  const [iaTotal, setIaTotal] = useState(0);
  const [iaCurrent, setIaCurrent] = useState(0);
  const [lbSrc, setLbSrc] = useState<string | null>(null);
  const [lbZoom, setLbZoom] = useState(1);

  const [nbOpen, setNbOpen] = useState(false);
  const [notes, setNotes] = useState<NotebookNote[]>([]);
  const [noteId, setNoteId] = useState<number | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteSearch, setNoteSearch] = useState('');
  const [nbWidth, setNbWidth] = useState(420);

  const [aiContent, setAiContent] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [creatingTest, setCreatingTest] = useState(false);

  const [highYield, setHighYield] = useState(false);
  const [keyExam, setKeyExam] = useState(false);
  const [popover, setPopover] = useState<PopoverData | null>(null);
  const [hoverCard, setHoverCard] = useState<{
    imgSrc: string;
    title: string;
    left: number;
    top: number;
  } | null>(null);
  const [imageViewer, setImageViewer] = useState<ImageViewerData | null>(null);
  const [split, setSplit] = useState<SplitData | null>(null);

  const popoverTimer = useRef<number | null>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const [pendingAnchor, setPendingAnchor] = useState<{ anchor: string; term: string } | null>(null);
  const [pendingSplitAnchor, setPendingSplitAnchor] = useState<{
    anchor: string;
    term: string;
  } | null>(null);

  const nbedRef = useRef<HTMLDivElement>(null);

  const articleRef = useRef<HTMLDivElement>(null);
  const iaMarksRef = useRef<HTMLElement[]>([]);
  const iaIdxRef = useRef(0);
  const anncRef = useRef<SVGSVGElement>(null);

  const showToast = useCallback((msg: string, err = false) => {
    setToast({ msg: String(msg ?? ''), err });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  const gotoMatch = useCallback((i: number) => {
    const marks = iaMarksRef.current;
    if (!marks.length) return;
    marks[iaIdxRef.current]?.classList.remove('cur');
    const next = ((i % marks.length) + marks.length) % marks.length;
    iaIdxRef.current = next;
    marks[next].classList.add('cur');
    marks[next].scrollIntoView({ behavior: 'smooth', block: 'center' });
    setIaCurrent(next + 1);
  }, []);

  const runInArticleSearch = useCallback(
    (q: string) => {
      const con = articleRef.current;
      if (!con) return;
      clearMarks(con);
      iaMarksRef.current = [];
      iaIdxRef.current = 0;
      if (!q.trim()) {
        setIaTotal(0);
        setIaCurrent(0);
        return;
      }
      const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      wrapMatches(con, re);
      const marks = Array.from(con.querySelectorAll('mark.msr')) as HTMLElement[];
      iaMarksRef.current = marks;
      if (!marks.length) {
        setIaTotal(0);
        setIaCurrent(0);
        return;
      }
      setIaTotal(marks.length);
      gotoMatch(0);
    },
    [gotoMatch],
  );

  const annotations = useAnnotations({
    articleId,
    containerRef: articleRef,
    svgRef: anncRef,
    onToast: showToast,
    onToggleSidebar: () => setSidebarOpen((v) => !v),
  });

  // ── Notebook ───────────────────────────────────────────────────────────────
  const loadNotes = useCallback(async () => {
    try {
      const d = await getNotes();
      setNotes(Array.isArray(d) ? d : []);
    } catch {
      /* ignore */
    }
  }, []);

  const openNote = useCallback(
    (id: number) => {
      const n = notes.find((x) => x.id === id);
      if (!n) return;
      setNoteId(id);
      setNoteTitle(n.title || 'Untitled');
      if (nbedRef.current) nbedRef.current.innerHTML = safeRichHtml(n.content || '<p><br/></p>');
    },
    [notes],
  );

  const addNote = useCallback(async () => {
    try {
      const d = await createNote({ title: 'Untitled', content: '' });
      setNotes((prev) => [...prev, d]);
      setNoteId(d.id);
      setNoteTitle(d.title || 'Untitled');
      if (nbedRef.current) nbedRef.current.innerHTML = '';
      showToast('Note created');
    } catch {
      showToast('Create failed', true);
    }
  }, [showToast]);

  const saveNote = useCallback(async () => {
    if (!noteId) {
      showToast('Select a note first', true);
      return;
    }
    const title = noteTitle || 'Untitled';
    const content = safeRichHtml(nbedRef.current?.innerHTML || '');
    if (nbedRef.current) nbedRef.current.innerHTML = content;
    try {
      await updateNote(noteId, { title, content });
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, title, content } : n)));
      showToast('Saved ✓');
    } catch {
      showToast('Save failed', true);
    }
  }, [noteId, noteTitle, showToast]);

  const insertArticleRef = useCallback(() => {
    if (!articleId) {
      showToast('No article open', true);
      return;
    }
    const ed = nbedRef.current;
    if (!ed) return;
    ed.focus();
    const link = document.createElement('a');
    link.href = '#';
    link.dataset.libraryArticleId = String(articleId);
    link.dataset.libraryArticleTitle = String(articleTitle || 'Article');
    link.style.cssText = 'color:var(--mp);font-weight:500;text-decoration:underline';
    link.textContent = '📖 ' + String(articleTitle || 'Article');
    document.execCommand('insertHTML', false, link.outerHTML + '<br/>');
    showToast('Article reference inserted');
  }, [articleId, articleTitle, showToast]);

  const execFormat = useCallback((cmd: string, val?: string) => {
    nbedRef.current?.focus();
    document.execCommand(cmd, false, val);
  }, []);

  const exportPdf = useCallback(() => {
    const title = noteTitle || 'Note';
    const safeTitle = title
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const content = safeRichHtml(nbedRef.current?.innerHTML || '');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<!DOCTYPE html><html><head><title>${safeTitle}</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet"/><style>body{font-family:Inter,sans-serif;padding:48px;max-width:800px;margin:auto;line-height:1.7;color:#1f2937}h1{font-size:24px;font-weight:700;margin-bottom:20px}a{color:#FF4500}</style></head><body><h1>${safeTitle}</h1>${content}</body></html>`,
    );
    w.document.close();
    w.print();
  }, [noteTitle]);

  const toggleNotebook = useCallback(() => {
    setNbOpen((v) => {
      const next = !v;
      if (next) void loadNotes();
      return next;
    });
  }, [loadNotes]);

  const filteredNotes = useMemo(
    () =>
      notes.filter((n) =>
        (n.title || 'Untitled').toLowerCase().includes(noteSearch.toLowerCase()),
      ),
    [notes, noteSearch],
  );

  // Notebook drawer resize handle.
  useEffect(() => {
    const rz = document.getElementById('nbrz');
    if (!rz) return;
    let resizing = false;
    let startX = 0;
    let startW = 0;
    const onDown = (e: MouseEvent) => {
      resizing = true;
      startX = e.clientX;
      startW = document.getElementById('nbdr')?.offsetWidth ?? 420;
      e.preventDefault();
    };
    const onMove = (e: MouseEvent) => {
      if (!resizing) return;
      const w = Math.max(320, Math.min(700, startW + (startX - e.clientX)));
      setNbWidth(w);
    };
    const onUp = () => {
      resizing = false;
    };
    rz.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      rz.removeEventListener('mousedown', onDown);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [nbOpen]);

  // ── AI summary ───────────────────────────────────────────────────────────────
  const reqAi = useCallback(async () => {
    if (!articleId) return;
    setAiLoading(true);
    try {
      const d = await requestAiSummary(articleId);
      setAiContent(d.content || d.summary || '');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'AI failed', true);
    } finally {
      setAiLoading(false);
    }
  }, [articleId, showToast]);

  // ── Create topic test (q-bank sources) ───────────────────────────────────────
  const createTopicTest = useCallback(async () => {
    const title = articleTitle || 'Article';
    if (!articleId || !title) return;
    setCreatingTest(true);
    try {
      const banks = await getQuestionBanks();
      if (!Array.isArray(banks)) throw new Error('Failed to load question banks.');

      const map: Record<string, string> = {
        pm_library_part_2: 'MRCP_PART_2',
        passmedicine: 'MRCP_PART_1',
        pastest_2: 'PASTEST_S5',
        pastest: 'PASTEST_S4',
      };
      const code = map[source.toLowerCase()];
      const match = code ? banks.find((b) => b.code === code) : undefined;
      const targetBankId = match?.id ?? null;
      const targetStep = match?.step ?? 1;

      const filters = targetBankId ? { questionBankIds: [targetBankId] } : {};
      const systems = await getSystemsWithTopics(targetStep, filters);

      let finalTopicId: number | null = null;
      if (Array.isArray(systems)) {
        for (const sys of systems) {
          const topic = sys.topics?.find(
            (t) => t.name.toLowerCase().trim() === title.toLowerCase().trim(),
          );
          if (topic) {
            finalTopicId = topic.id;
            break;
          }
        }
      }
      if (!finalTopicId) {
        throw new Error('Could not find matching topic in Q-Bank for: ' + title);
      }

      const payload: Record<string, unknown> = {
        title: `${title} Practice`,
        type: 'tutor',
        mode: 'unused',
        step: targetStep,
        totalQuestions: 40,
        filters: {
          topicIds: [finalTopicId],
          ...(targetBankId ? { questionBankIds: [targetBankId] } : {}),
        },
      };

      const testData = await createTest(payload);
      window.location.href = `/dashboard/test/${testData.id}`;
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : (err as Error).message || 'Test Creation Failed', true);
    } finally {
      setCreatingTest(false);
    }
  }, [articleId, articleTitle, source, showToast]);

  const ambossMode = source === 'amboss';
  const qbankSource = ['passmedicine', 'pm_library_part_2', 'pastest', 'pastest_2'].includes(
    source,
  );
  const articleHtml = useMemo(() => {
    if (!article) return '';
    const raw =
      article.contentHtml ||
      article.content_html ||
      article.content ||
      '<p style="color:#9ca3af">No content.</p>';
    let html = safeRichHtml(fixImageUrls(raw));
    if (ambossMode) html = transformToAmbossCards(html);
    return html;
  }, [article, ambossMode]);

  // ── Amboss mode handlers ─────────────────────────────────────────────────────
  const hideHoverCard = useCallback(() => setHoverCard(null), []);

  const showHoverCard = useCallback((btn: HTMLElement) => {
    const imgSrc = btn.dataset.imgSrc || '';
    if (!imgSrc) return;
    const title = btn.dataset.title || 'Image';
    const rect = btn.getBoundingClientRect();
    let left = rect.left - 70;
    let top = rect.bottom + 8;
    if (left < 10) left = 10;
    if (left + 180 > window.innerWidth) left = window.innerWidth - 190;
    if (top + 140 > window.innerHeight) top = rect.top - 140;
    setHoverCard({ imgSrc, title, left, top });
  }, []);

  const showPopover = useCallback((el: HTMLElement) => {
    if (popoverTimer.current) window.clearTimeout(popoverTimer.current);
    let title = el.getAttribute('data-title') || el.textContent?.trim() || '';
    try {
      if (title && /^[A-Za-z0-9+/=]+$/.test(title) && title.length > 8) {
        title = decodeURIComponent(escape(atob(title)));
      }
    } catch {
      try {
        title = atob(title);
      } catch {
        /* ignore */
      }
    }

    let description = el.getAttribute('data-offline-popover') || '';
    if (!description && el.getAttribute('data-content')) {
      const c = el.getAttribute('data-content') as string;
      try {
        description = decodeURIComponent(escape(atob(c)));
      } catch {
        try {
          description = atob(c);
        } catch {
          description = c;
        }
      }
    }
    const targetId =
      el.getAttribute('data-learningcard-id') || el.getAttribute('data-lxid') || '';
    if (!description && !targetId) return;
    if (!description) {
      description = '<p style="color:#64748b; font-style:italic;">Clinical definition reference</p>';
    }
    description = fixOfflineMedia(description);

    const rect = el.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 8;
    if (left + 360 > window.innerWidth) left = window.innerWidth - 370;
    if (left < 12) left = 12;
    if (top + 260 > window.innerHeight) {
      const alt = rect.top - 268;
      top = alt > 60 ? alt : 60;
    }
    if (top < 60) top = 60;

    setPopover({
      title: title || 'Medical Term',
      bodyHtml: safeRichHtml(description),
      showFooter: !!targetId,
      targetId,
      anchor: el.getAttribute('data-anker') || '',
      left,
      top,
    });
  }, []);

  const showTipPopover = useCallback((anchor: HTMLElement, contentHtml: string) => {
    const rect = anchor.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 8;
    if (left + 360 > window.innerWidth) left = window.innerWidth - 370;
    if (left < 12) left = 12;
    if (top + 260 > window.innerHeight) {
      const alt = rect.top - 268;
      top = alt > 60 ? alt : 60;
    }
    if (top < 60) top = 60;
    setPopover({
      title: 'Learning Tip',
      bodyHtml: safeRichHtml(contentHtml),
      showFooter: false,
      targetId: '',
      anchor: '',
      left,
      top,
    });
  }, []);

  const scheduleClosePopover = useCallback(() => {
    if (popoverTimer.current) window.clearTimeout(popoverTimer.current);
    popoverTimer.current = window.setTimeout(() => setPopover(null), 350);
  }, []);

  const openImageViewer = useCallback(
    (imgSrc: string, title: string, desc: string, overlaySrc: string) => {
      const overlay = overlaySrc
        ? overlaySrc.replace(/^(?:\/?offline_media\/|\/+)/, MEDIA_CDN + 'offline_media/')
        : '';
      setImageViewer({
        imgSrc,
        title: title || 'Medical Illustration',
        descHtml: safeRichHtml(
          desc || '<p>No detailed clinical description available for this image.</p>',
        ),
        overlaySrc: overlay,
        showOverlay: false,
        zoom: 1,
      });
      setHoverCard(null);
    },
    [],
  );

  const openSplitScreen = useCallback(async (targetId: string, title: string, anchor = '') => {
    setPopover(null);
    setPendingSplitAnchor(anchor ? { anchor, term: title || '' } : null);
    setSplit({ title: title || 'Referenced Article', html: '', loading: true });
    try {
      const art = await getArticle(targetId);
      let html = art.contentHtml || art.content_html || art.content || '<p>No content.</p>';
      html = safeRichHtml(fixImageUrls(html));
      html = transformToAmbossCards(html);
      setSplit({ title: art.name || art.title || title, html, loading: false });
    } catch {
      setSplit({
        title,
        html: '<div style="padding:20px;color:#ef4444">⚠ Could not load referenced article.</div>',
        loading: false,
      });
    }
  }, []);

  const toggleKeyExam = useCallback(() => {
    setKeyExam((v) => {
      const next = !v;
      showToast(next ? '🔑 Key exam info ON' : 'Key exam info OFF');
      return next;
    });
  }, [showToast]);

  const toggleAllCards = useCallback(() => {
    const cards = articleRef.current?.querySelectorAll('.amboss-card');
    if (!cards?.length) return;
    const anyOpen = Array.from(cards).some((c) => !c.classList.contains('collapsed'));
    cards.forEach((c) => c.classList.toggle('collapsed', anyOpen));
  }, []);

  // Wire Amboss interactions + dark-mode style stripping after each render.
  useEffect(() => {
    const con = articleRef.current;
    if (!con || !article) return;
    if (ambossMode) {
      setupAmbossInteractions(con, {
        onShowPopover: showPopover,
        onShowTipPopover: showTipPopover,
        onShowHoverCard: showHoverCard,
        onHideHoverCard: hideHoverCard,
        onOpenImageViewer: openImageViewer,
        onInsertArticleRef: insertArticleRef,
      });
    }
    if (dark) stripInlineStylesForDark(con);
    else restoreInlineStyles(con);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleHtml, ambossMode, dark]);

  useEffect(() => {
    const con = splitRef.current;
    if (!con || !split?.html) return;
    setupAmbossInteractions(con, {
      onShowPopover: showPopover,
      onShowTipPopover: showTipPopover,
      onShowHoverCard: showHoverCard,
      onHideHoverCard: hideHoverCard,
      onOpenImageViewer: openImageViewer,
      onInsertArticleRef: insertArticleRef,
    });
    if (dark) stripInlineStylesForDark(con);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [split, dark]);

  // 'k' toggles key-exam mode while in Amboss mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      if (e.key.toLowerCase() === 'k' && ambossMode) toggleKeyExam();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ambossMode, toggleKeyExam]);

  const sourceLabel = useMemo(
    () => LIBRARY_SOURCES.find((s) => s.id === source)?.label ?? 'USMLE Step 1-3',
    [source],
  );

  // ── Structure (cached + deduped per source) ────────────────────────────────
  // TanStack Query collapses StrictMode's double-invoke into one in-flight
  // request and reuses the result per source, so dev navigation can't trip the
  // backend's anti-scraping limits.
  const structureQuery = useQuery({
    queryKey: ['library-structure', source],
    queryFn: () => getStructure(source),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const categories = useMemo(
    () => (Array.isArray(structureQuery.data) ? structureQuery.data : []),
    [structureQuery.data],
  );
  const structureLoading = structureQuery.isLoading;
  const structureError = structureQuery.isError;
  const structureLocked =
    structureQuery.error instanceof ApiError && structureQuery.error.status === 423
      ? ((structureQuery.error.payload as { retryAfterSeconds?: number } | undefined) ?? {})
      : null;

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
    async (id: number | string, title: string, anchor = '') => {
      setArticleId(id);
      setArticleTitle(title || 'Article');
      setArticleLoading(true);
      setArticle(null);
      setPendingAnchor(anchor ? { anchor, term: title || '' } : null);
      setIaQuery('');
      setIaTotal(0);
      setIaCurrent(0);
      iaMarksRef.current = [];
      iaIdxRef.current = 0;
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

  /**
   * Navigate to a cross-reference. If the anchor already exists in the open
   * article we just scroll to it (no refetch); otherwise open/split and jump.
   */
  const goToReference = useCallback(
    (targetId: string, title: string, anchor: string, mode: 'open' | 'split') => {
      setPopover(null);
      // Split always opens the split pane — even when it's the same article.
      if (mode === 'split') {
        void openSplitScreen(targetId, title, anchor);
        return;
      }
      // Open: if the target section is already in the current article, just jump.
      if (scrollToAnchor(articleRef.current, anchor, title)) return;
      void openArticle(targetId, title, anchor);
    },
    [openArticle, openSplitScreen],
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

  // Attach image handlers after each article render.
  useEffect(() => {
    const con = articleRef.current;
    if (!con) return;
    con.querySelectorAll('img').forEach((img) => {
      img.style.cursor = 'zoom-in';
      img.onclick = () => {
        setLbSrc(img.src);
        setLbZoom(1);
      };
      img.onerror = function onerr(this: HTMLImageElement) {
        this.style.display = 'none';
      };
    });
  }, [articleHtml]);

  // Clear + reload highlights whenever a new article renders.
  useEffect(() => {
    if (!article || article.id == null) return;
    annotations.resetForArticle(Number(article.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article]);

  // Size the annotation canvas to the article height.
  useEffect(() => {
    if (!article) return;
    const t = window.setTimeout(() => {
      const con = articleRef.current;
      const cv = anncRef.current;
      if (con && cv) cv.style.height = Math.max(con.offsetHeight, con.scrollHeight) + 'px';
    }, 120);
    return () => window.clearTimeout(t);
  }, [article]);

  // Jump to the referenced anchor once the article is rendered.
  useEffect(() => {
    if (!pendingAnchor) return;
    let tries = 0;
    let timer = 0;
    const attempt = () => {
      if (scrollToAnchor(articleRef.current, pendingAnchor.anchor, pendingAnchor.term)) {
        setPendingAnchor(null);
        return;
      }
      if (tries++ < 12) timer = window.setTimeout(attempt, 150);
      else setPendingAnchor(null);
    };
    timer = window.setTimeout(attempt, 80);
    return () => window.clearTimeout(timer);
  }, [pendingAnchor, article]);

  // Same, for the split-screen pane.
  useEffect(() => {
    if (!pendingSplitAnchor) return;
    let tries = 0;
    let timer = 0;
    const attempt = () => {
      if (scrollToAnchor(splitRef.current, pendingSplitAnchor.anchor, pendingSplitAnchor.term)) {
        setPendingSplitAnchor(null);
        return;
      }
      if (tries++ < 12) timer = window.setTimeout(attempt, 150);
      else setPendingSplitAnchor(null);
    };
    timer = window.setTimeout(attempt, 120);
    return () => window.clearTimeout(timer);
  }, [pendingSplitAnchor, split]);

  // Esc closes the lightbox.
  useEffect(() => {
    if (!lbSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLbSrc(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lbSrc]);

  const downloadImage = useCallback(() => {
    if (!lbSrc) return;
    const a = document.createElement('a');
    a.href = lbSrc;
    a.download = 'medpark-image.jpg';
    a.click();
  }, [lbSrc]);

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
    <div
      className={`library-root${dark ? ' dark-mode' : ''}${ambossMode ? ' amboss-mode' : ''}${
        keyExam ? ' show-key-exam' : ''
      }${highYield ? ' show-high-yield' : ''}`}
    >
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

        <div className="vdiv" />
        <button
          className={`tb${annotations.tool === 'pencil' ? ' act' : ''}`}
          id="tp"
          title="Pencil"
          onClick={() => annotations.setTool('pencil')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </button>
        <button
          className={`tb${annotations.tool === 'highlighter' ? ' act' : ''}`}
          id="th"
          title="Highlighter"
          onClick={() => annotations.setTool('highlighter')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 11-6 6v3h3l6-6" />
            <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
          </svg>
        </button>
        <button
          className={`tb${annotations.tool === 'eraser' ? ' act' : ''}`}
          id="te"
          title="Eraser"
          onClick={() => annotations.setTool('eraser')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
            <path d="M22 21H7" />
          </svg>
        </button>
        <button
          className={`tb${annotations.tool === 'laser' ? ' act' : ''}`}
          id="tl"
          title="Laser"
          onClick={() => annotations.setTool('laser')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        </button>
        <div className="tsep" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {['#facc15', '#86efac', '#93c5fd', '#fca5a5', '#c4b5fd'].map((c) => (
            <div
              key={c}
              className={`cd${annotations.color === c ? ' sel' : ''}`}
              style={{ background: c }}
              onClick={() => annotations.setColor(c)}
            />
          ))}
        </div>
        <div className="tsep" />
        <button className="tb" title="Undo Ctrl+Z" onClick={() => void annotations.undo()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </button>
        <button className="tb" title="Redo Ctrl+Y" onClick={() => void annotations.redo()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
          </svg>
        </button>

        <div id="navr">
          <div id="iasw">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              id="ias"
              placeholder="Search in article..."
              value={iaQuery}
              onChange={(e) => {
                setIaQuery(e.target.value);
                runInArticleSearch(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  gotoMatch(e.shiftKey ? iaIdxRef.current - 1 : iaIdxRef.current + 1);
                }
              }}
            />
            <span id="iac" style={{ display: iaTotal ? 'inline' : 'none', fontSize: 11, color: '#9ca3af' }}>
              {iaCurrent}/{iaTotal}
            </span>
          </div>
          <button
            className={`tb${nbOpen ? ' act' : ''}`}
            id="tnb"
            title="Notebook"
            onClick={toggleNotebook}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </button>
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
        <LibrarySidebar
          collapsed={!sidebarOpen}
          query={query}
          onQueryChange={setQuery}
          searchMode={searchMode}
          onSearchModeChange={(m) => setSearchMode(m)}
          results={results}
          searching={searching}
          onOpenSearchResult={(id, title) => {
            void openArticle(id, title);
            setQuery('');
            setResults(null);
          }}
          structureLoading={structureLoading}
          structureError={structureError}
          structureLocked={structureLocked}
          onRetryStructure={() => void structureQuery.refetch()}
          categories={categories}
          activeId={articleId}
          onOpenArticle={(id, title) => void openArticle(id, title)}
        />

        <button id="sbh" onClick={() => setSidebarOpen((v) => !v)} title="Toggle Sidebar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <main
          id="main"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'row',
            overflow: 'hidden',
            minWidth: 0,
            position: 'relative',
          }}
        >
          <div
            id="pane-primary"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              height: '100%',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div id="ahdr">
              <span
                id="atitle"
                style={articleId ? { color: '#111' } : { color: '#9ca3af', fontSize: 14, fontWeight: 400 }}
              >
                {articleId ? articleTitle : 'Select an article from the sidebar'}
              </span>
              <div id="aacts">
                <AmbossToolbar
                  visible={ambossMode}
                  keyExam={keyExam}
                  highYield={highYield}
                  onToggleKeyExam={toggleKeyExam}
                  onToggleAllCards={toggleAllCards}
                  onToggleHighYield={() => setHighYield((v) => !v)}
                />
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
                <button
                  className="abtn"
                  id="btnai"
                  onClick={() => void reqAi()}
                  style={{ display: articleId ? 'flex' : 'none' }}
                  disabled={aiLoading}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a10 10 0 1 0 10 10" />
                    <path d="m22 2-10 10" />
                  </svg>
                  {aiLoading ? '...' : 'AI Summary'}
                </button>
                <button
                  className="abtn"
                  id="btnct"
                  onClick={() => void createTopicTest()}
                  style={{
                    display: articleId && qbankSource ? 'flex' : 'none',
                    background: 'var(--mp)',
                    color: '#fff',
                    borderColor: 'var(--mps)',
                  }}
                  disabled={creatingTest}
                >
                  <svg style={{ width: 13, height: 13 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  {creatingTest ? 'Creating Test...' : 'Create Test'}
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
                <svg
                  id="annc"
                  ref={anncRef}
                  xmlns="http://www.w3.org/2000/svg"
                  className={
                    annotations.tool === 'pencil' ||
                    annotations.tool === 'eraser' ||
                    annotations.tool === 'laser'
                      ? 'on'
                      : ''
                  }
                />
              </div>
            </div>
          </div>
          {split && (
            <SplitPane data={split} contentRef={splitRef} onClose={() => setSplit(null)} />
          )}
        </main>
      </div>

      {/* AMBOSS POPOVER */}
      {popover && (
        <AmbossPopover
          data={popover}
          onEnter={() => {
            if (popoverTimer.current) window.clearTimeout(popoverTimer.current);
          }}
          onLeave={scheduleClosePopover}
          onClose={() => setPopover(null)}
          onGoToReference={(targetId, title, anchor, mode) => goToReference(targetId, title, anchor, mode)}
          onOpenDirect={(targetId, title) => {
            setPopover(null);
            void openArticle(targetId, title);
          }}
        />
      )}

      {/* AMBOSS IMAGE HOVER CARD */}
      {hoverCard && (
        <ImageHoverCard
          data={hoverCard}
          onOpenViewer={(imgSrc, title) => openImageViewer(imgSrc, title, '', '')}
        />
      )}

      {/* AMBOSS IMAGE VIEWER */}
      {imageViewer && (
        <AmbossImageViewer
          data={imageViewer}
          onUpdate={(patch) => setImageViewer((v) => (v ? { ...v, ...patch } : v))}
          onClose={() => setImageViewer(null)}
        />
      )}

      {/* LIGHTBOX */}
      <Lightbox
        src={lbSrc}
        zoom={lbZoom}
        onClose={() => setLbSrc(null)}
        onZoom={(d) => setLbZoom((z) => Math.max(0.2, Math.min(6, z + d)))}
        onReset={() => setLbZoom(1)}
        onDownload={downloadImage}
      />

      {/* AI SUMMARY PANEL */}
      {aiContent !== null && <AiSummaryPanel content={aiContent} onClose={() => setAiContent(null)} />}

      {/* NOTEBOOK */}
      <div
        id="nbdr"
        className={nbOpen ? 'open' : ''}
        style={{ '--nbw': `${nbWidth}px` } as CSSProperties}
      >
        <div id="nbrz" />
        <div id="nbhdr">
          <h3>📓 Notebook</h3>
          <button id="nbaibtn" onClick={insertArticleRef} title="Insert current article reference">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            Insert Article
          </button>
          <button id="nbplus" onClick={() => void addNote()}>
            + Note
          </button>
          <button id="nbcl" onClick={() => setNbOpen(false)}>
            ✕
          </button>
        </div>
        <div id="nbsr">
          <input
            type="text"
            placeholder="Search notes..."
            value={noteSearch}
            onChange={(e) => setNoteSearch(e.target.value)}
          />
        </div>
        <div id="nbbody">
          <div id="nbtree">
            {filteredNotes.length === 0 ? (
              <div style={{ padding: '10px 8px', fontSize: 11, color: '#9ca3af' }}>No notes yet.</div>
            ) : (
              filteredNotes.map((n) => (
                <div
                  key={n.id}
                  className={`nbt${noteId === n.id ? ' act' : ''}`}
                  onClick={() => openNote(n.id)}
                >
                  {n.title || 'Untitled'}
                </div>
              ))
            )}
          </div>
          <div id="nbew">
            <input
              type="text"
              id="nbti"
              placeholder="Untitled note..."
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
            />
            <div id="nbtbar">
              <button className="nbtl" onClick={() => execFormat('bold')}>
                <b>B</b>
              </button>
              <button className="nbtl" onClick={() => execFormat('italic')}>
                <i>I</i>
              </button>
              <button className="nbtl" onClick={() => execFormat('underline')}>
                <u>U</u>
              </button>
              <button className="nbtl" onClick={() => execFormat('strikeThrough')}>
                <s>S</s>
              </button>
              <button className="nbtl" onClick={() => execFormat('insertOrderedList')}>
                1.
              </button>
              <button className="nbtl" onClick={() => execFormat('insertUnorderedList')}>
                •
              </button>
              <select
                onChange={(e) => {
                  execFormat('fontSize', e.currentTarget.value);
                  e.currentTarget.selectedIndex = 0;
                }}
                className="nbtl"
                style={{ width: 46, padding: '2px 4px' }}
                defaultValue=""
              >
                <option value="">Sz</option>
                <option value="1">S</option>
                <option value="3">M</option>
                <option value="5">L</option>
                <option value="7">XL</option>
              </select>
              <input
                type="color"
                onChange={(e) => execFormat('foreColor', e.currentTarget.value)}
                className="nbtl"
                style={{ width: 26, height: 24, padding: 0, cursor: 'pointer' }}
                title="Color"
              />
            </div>
            <div id="nbed" ref={nbedRef} contentEditable suppressContentEditableWarning spellCheck={false} />
            <div id="nbft">
              <button id="nbsv" onClick={() => void saveNote()}>
                💾 Save
              </button>
              <button id="nbex" onClick={exportPdf}>
                📄 PDF
              </button>
              <span id="nbsync" />
            </div>
          </div>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
