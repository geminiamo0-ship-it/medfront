import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  createHighlight,
  deleteHighlight,
  getHighlights,
  type LibraryHighlight,
} from '@/api/library';

export type AnnotationTool = 'pencil' | 'highlighter' | 'eraser' | 'laser' | null;

interface Point {
  x: number;
  y: number;
}
interface Stroke {
  path: SVGPathElement;
  pts: Point[];
}
interface UndoAction {
  type: 'stroke' | 'erase_strokes' | 'highlight' | 'erase_highlight';
  stroke?: Stroke;
  strokes?: Stroke[];
  txt?: string;
  col?: string;
  hid?: string | number | null;
  marks?: HTMLElement[];
}

interface Options {
  articleId: number | null;
  containerRef: RefObject<HTMLDivElement>;
  svgRef: RefObject<SVGSVGElement>;
  onToast: (msg: string, err?: boolean) => void;
  onToggleSidebar: () => void;
}

/**
 * React port of the libraries.html annotation engine: text highlights (saved
 * to the backend) plus freehand pencil / laser strokes and an eraser, with
 * unified undo/redo. All mutable drawing state lives in refs.
 */
export function useAnnotations({
  articleId,
  containerRef,
  svgRef,
  onToast,
  onToggleSidebar,
}: Options) {
  const [tool, setToolState] = useState<AnnotationTool>(null);
  const [color, setColorState] = useState('#facc15');

  const toolRef = useRef<AnnotationTool>(null);
  const colorRef = useRef('#facc15');
  const articleIdRef = useRef<number | null>(null);

  const drw = useRef(false);
  const cp = useRef<SVGPathElement | null>(null);
  const cpts = useRef<Point[]>([]);
  const strks = useRef<Stroke[]>([]);
  const undoStack = useRef<UndoAction[]>([]);
  const redoStack = useRef<UndoAction[]>([]);
  const tref = useRef<{ pid: number; ly: number; el: HTMLElement | null } | null>(null);

  useEffect(() => {
    articleIdRef.current = articleId;
  }, [articleId]);

  const setTool = useCallback((t: AnnotationTool) => {
    const was = toolRef.current === t;
    const next = was ? null : t;
    toolRef.current = next;
    setToolState(next);
  }, []);

  const setColor = useCallback((c: string) => {
    colorRef.current = c;
    setColorState(c);
  }, []);

  // ── Highlights ───────────────────────────────────────────────────────────
  const applyRange = useCallback((rng: Range, col: string, hid: string | number): HTMLElement[] => {
    const nodes: Text[] = [];
    const root = rng.commonAncestorContainer;
    if (root.nodeType === Node.TEXT_NODE) {
      nodes.push(root as Text);
    } else {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (rng.intersectsNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
      });
      let nd: Node | null;
      while ((nd = walker.nextNode())) nodes.push(nd as Text);
    }

    const marks: HTMLElement[] = [];
    for (const n of nodes) {
      const r = document.createRange();
      r.selectNodeContents(n);
      if (n === rng.startContainer) r.setStart(n, rng.startOffset);
      if (n === rng.endContainer) r.setEnd(n, rng.endOffset);
      if (r.collapsed) continue;

      const m = document.createElement('mark');
      m.className = 'mhl';
      m.style.background = col;
      m.style.color = 'inherit';
      m.style.padding = '0';
      if (hid) m.dataset.hid = String(hid);
      m.title = 'Click to remove highlight';
      m.addEventListener('click', (ev) => {
        ev.stopPropagation();
        void eraseHighlightEl(m);
      });
      try {
        r.surroundContents(m);
        marks.push(m);
      } catch {
        /* range spans elements — skip this node */
      }
    }
    return marks;
  }, []);

  const applyHighlight = useCallback(
    (hl: LibraryHighlight) => {
      const con = containerRef.current;
      if (!con) return;
      const txt = hl.text || hl.selectedText;
      if (!txt) return;

      const walker = document.createTreeWalker(con, NodeFilter.SHOW_TEXT);
      let nd: Node | null;
      let full = '';
      const nodes: Text[] = [];
      while ((nd = walker.nextNode())) {
        nodes.push(nd as Text);
        full += nd.nodeValue;
      }
      const idx = full.indexOf(txt);
      if (idx === -1) return;

      let curr = 0;
      let sn: Text | null = null;
      let so = 0;
      let en: Text | null = null;
      let eo = 0;
      for (const n of nodes) {
        const len = n.nodeValue?.length ?? 0;
        if (!sn && curr + len > idx) {
          sn = n;
          so = idx - curr;
        }
        if (sn && curr + len >= idx + txt.length) {
          en = n;
          eo = idx + txt.length - curr;
          break;
        }
        curr += len;
      }
      if (sn && en) {
        const r = document.createRange();
        r.setStart(sn, so);
        r.setEnd(en, eo);
        applyRange(r, hl.color || colorRef.current, hl.id ?? '');
      }
    },
    [applyRange, containerRef],
  );

  const loadHighlights = useCallback(
    async (id: number) => {
      try {
        const hls = await getHighlights(id);
        (Array.isArray(hls) ? hls : []).forEach(applyHighlight);
      } catch {
        /* ignore */
      }
    },
    [applyHighlight],
  );

  const eraseHighlightEl = useCallback(
    async (m: HTMLElement) => {
      const hid = m.dataset.hid || '';
      const curCol = m.style.background || colorRef.current;
      const related = hid
        ? Array.from(document.querySelectorAll(`mark[data-hid="${hid}"]`)) as HTMLElement[]
        : [m];
      const txt = related.map((rm) => rm.textContent || '').join('');

      related.forEach((rm) => {
        if (rm.parentNode) rm.replaceWith(...Array.from(rm.childNodes));
      });

      undoStack.current.push({ type: 'erase_highlight', hid, txt, col: curCol });
      redoStack.current = [];

      if (hid) {
        try {
          await deleteHighlight(hid);
        } catch {
          /* ignore */
        }
      }
      onToast('Highlight erased');
    },
    [onToast],
  );

  const clearAnnotations = useCallback(() => {
    strks.current.forEach((s) => s.path.remove());
    strks.current = [];
    undoStack.current = [];
    redoStack.current = [];
  }, []);

  const undo = useCallback(async () => {
    const stack = undoStack.current;
    if (!stack.length) {
      onToast('Nothing to undo');
      return;
    }
    const act = stack.pop()!;
    redoStack.current.push(act);
    const aid = articleIdRef.current;

    if (act.type === 'stroke' && act.stroke) {
      act.stroke.path.remove();
      strks.current = strks.current.filter((s) => s !== act.stroke);
    } else if (act.type === 'erase_strokes' && act.strokes) {
      act.strokes.forEach((s) => {
        svgRef.current?.appendChild(s.path);
        strks.current.push(s);
      });
    } else if (act.type === 'highlight') {
      const hid = act.hid;
      const marks = hid
        ? (Array.from(document.querySelectorAll(`mark[data-hid="${hid}"]`)) as HTMLElement[])
        : act.marks || [];
      marks.forEach((m) => {
        if (m.parentNode) m.replaceWith(...Array.from(m.childNodes));
      });
      if (hid) {
        try {
          await deleteHighlight(hid);
        } catch {
          /* ignore */
        }
      }
      onToast('Highlight undone');
    } else if (act.type === 'erase_highlight' && act.txt) {
      applyHighlight({ text: act.txt, color: act.col });
      if (aid) {
        try {
          const hl = await createHighlight(aid, { text: act.txt, color: act.col || colorRef.current });
          if (hl?.id) {
            act.hid = hl.id;
            document.querySelectorAll('mark.mhl').forEach((m) => {
              const el = m as HTMLElement;
              if (!el.dataset.hid && (el.textContent || '').includes(act.txt!)) el.dataset.hid = String(hl.id);
            });
          }
        } catch {
          /* ignore */
        }
      }
      onToast('Highlight restored');
    }
  }, [applyHighlight, onToast, svgRef]);

  const redo = useCallback(async () => {
    const stack = redoStack.current;
    if (!stack.length) {
      onToast('Nothing to redo');
      return;
    }
    const act = stack.pop()!;
    undoStack.current.push(act);
    const aid = articleIdRef.current;

    if (act.type === 'stroke' && act.stroke) {
      svgRef.current?.appendChild(act.stroke.path);
      strks.current.push(act.stroke);
    } else if (act.type === 'erase_strokes' && act.strokes) {
      act.strokes.forEach((s) => {
        s.path.remove();
        strks.current = strks.current.filter((x) => x !== s);
      });
    } else if (act.type === 'highlight' && act.txt) {
      applyHighlight({ text: act.txt, color: act.col });
      if (aid) {
        try {
          const hl = await createHighlight(aid, { text: act.txt, color: act.col || colorRef.current });
          if (hl?.id) act.hid = hl.id;
        } catch {
          /* ignore */
        }
      }
      onToast('Highlight redone');
    } else if (act.type === 'erase_highlight') {
      const hid = act.hid;
      const marks = hid
        ? (Array.from(document.querySelectorAll(`mark[data-hid="${hid}"]`)) as HTMLElement[])
        : [];
      marks.forEach((m) => {
        if (m.parentNode) m.replaceWith(...Array.from(m.childNodes));
      });
      if (hid) {
        try {
          await deleteHighlight(hid);
        } catch {
          /* ignore */
        }
      }
      onToast('Highlight erased');
    }
  }, [applyHighlight, onToast, svgRef]);

  // ── Pointer drawing on the annotation SVG ──────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const coords = (e: PointerEvent): Point => {
      const rect = svg.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const canDraw = (e: PointerEvent): boolean => {
      if (e.pointerType === 'touch') return false;
      if (e.pointerType === 'pen') return e.button === 0 || e.button === 5;
      return e.button === 0;
    };

    const erAt = (x: number, y: number) => {
      const rm: Stroke[] = [];
      strks.current.forEach((s) => {
        for (const p of s.pts) {
          if (Math.hypot(p.x - x, p.y - y) < 25) {
            rm.push(s);
            break;
          }
        }
      });
      if (rm.length) {
        rm.forEach((s) => s.path.remove());
        strks.current = strks.current.filter((s) => !rm.includes(s));
        undoStack.current.push({ type: 'erase_strokes', strokes: rm });
        redoStack.current = [];
      }
    };

    const checkEraserAtPoint = (clientX: number, clientY: number) => {
      const els = document.elementsFromPoint(clientX, clientY);
      const m = els.find((el) => el.classList && el.classList.contains('mhl'));
      if (m) void eraseHighlightEl(m as HTMLElement);
    };

    const onPD = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        e.preventDefault();
        tref.current = { pid: e.pointerId, ly: e.clientY, el: document.getElementById('ascroll') };
        svg.setPointerCapture(e.pointerId);
        return;
      }
      const t = toolRef.current;
      if (!canDraw(e) || !t || t === 'highlighter') return;
      e.preventDefault();
      svg.setPointerCapture(e.pointerId);
      drw.current = true;
      const { x, y } = coords(e);
      cpts.current = [{ x, y }];

      if (t === 'eraser') {
        erAt(x, y);
        checkEraserAtPoint(e.clientX, e.clientY);
        return;
      }

      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', t === 'laser' ? '#ef4444' : colorRef.current);
      p.setAttribute('stroke-width', t === 'laser' ? '4' : '2.5');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      if (t === 'pencil') p.setAttribute('opacity', '0.85');
      svg.appendChild(p);
      cp.current = p;
      updP();
    };

    const updP = () => {
      if (!cp.current || cpts.current.length < 2) return;
      cp.current.setAttribute(
        'd',
        cpts.current.reduce((a, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${a} L ${p.x} ${p.y}`), ''),
      );
    };

    const onPM = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && tref.current && tref.current.pid === e.pointerId) {
        e.preventDefault();
        const tr = tref.current;
        if (tr.el) tr.el.scrollTop += tr.ly - e.clientY;
        tr.ly = e.clientY;
        return;
      }
      if (!drw.current) return;
      const t = toolRef.current;
      if (t === 'eraser') {
        const { x, y } = coords(e);
        erAt(x, y);
        checkEraserAtPoint(e.clientX, e.clientY);
        return;
      }
      if (!cp.current) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      evs.forEach((ev) => {
        const rect = svg.getBoundingClientRect();
        cpts.current.push({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
      });
      updP();
    };

    const onPU = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        tref.current = null;
        return;
      }
      if (!drw.current) return;
      drw.current = false;
      const t = toolRef.current;

      if (t === 'laser' && cp.current) {
        const lz = cp.current;
        lz.style.transition = 'opacity 0.8s';
        lz.style.opacity = '0';
        window.setTimeout(() => lz.remove(), 800);
        cp.current = null;
        return;
      }
      if (cp.current && t === 'pencil') {
        const stroke: Stroke = { path: cp.current, pts: [...cpts.current] };
        strks.current.push(stroke);
        undoStack.current.push({ type: 'stroke', stroke });
        redoStack.current = [];
      }
      cp.current = null;
      cpts.current = [];
    };

    svg.addEventListener('pointerdown', onPD);
    svg.addEventListener('pointermove', onPM);
    svg.addEventListener('pointerup', onPU);
    svg.addEventListener('pointercancel', onPU);
    return () => {
      svg.removeEventListener('pointerdown', onPD);
      svg.removeEventListener('pointermove', onPM);
      svg.removeEventListener('pointerup', onPU);
      svg.removeEventListener('pointercancel', onPU);
    };
  }, [svgRef, eraseHighlightEl]);

  // ── Highlighter: mouse selection ───────────────────────────────────────────
  useEffect(() => {
    const onMouseUp = async () => {
      if (toolRef.current !== 'highlighter') return;
      const sel = window.getSelection();
      const aid = articleIdRef.current;
      if (!sel || !sel.toString().trim() || !aid || sel.rangeCount === 0) return;
      const txt = sel.toString().trim();
      if (!txt) return;
      try {
        const r = sel.getRangeAt(0).cloneRange();
        sel.removeAllRanges();
        const curCol = colorRef.current;
        const marks = applyRange(r, curCol, '');
        const action: UndoAction = { type: 'highlight', txt, col: curCol, marks, hid: null };
        undoStack.current.push(action);
        redoStack.current = [];
        const hl = await createHighlight(aid, { text: txt, color: curCol });
        if (hl?.id) {
          action.hid = hl.id;
          marks.forEach((m) => {
            m.dataset.hid = String(hl.id);
          });
        }
      } catch {
        /* ignore */
      }
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [applyRange]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        onToggleSidebar();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        void undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        void redo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [undo, redo, onToggleSidebar]);

  const resetForArticle = useCallback(
    (id: number) => {
      clearAnnotations();
      void loadHighlights(id);
    },
    [clearAnnotations, loadHighlights],
  );

  return { tool, color, setTool, setColor, undo, redo, resetForArticle };
}