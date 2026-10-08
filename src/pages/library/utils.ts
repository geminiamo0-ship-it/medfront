import type { LibraryCategory } from '@/api/library';
import { MEDIA_CDN } from '@/lib/env';

export const DARK_KEY = 'dm';

export function countArticles(cat: LibraryCategory): number {
  return (
    (cat.articles?.length ?? 0) +
    (cat.children ?? []).reduce((acc, k) => acc + countArticles(k), 0)
  );
}

export function fixImageUrls(html: string): string {
  return html.replace(
    /(<img[^>]+src=["'])(?!http|data:)([^"'>]+)(["'])/gi,
    (_m, pre: string, path: string, post: string) => {
      const clean = path.replace(/^\/+/, '');
      return pre + MEDIA_CDN + clean + post;
    },
  );
}

/** Cancel the last spotlight when navigating again within the same reader. */
const activeReferenceJumps = new WeakMap<HTMLElement, () => void>();

function visibleReferenceTarget(element: HTMLElement): HTMLElement {
  // Imported articles sometimes use an empty marker immediately before the
  // actual heading, or an inline marker inside the paragraph to be highlighted.
  // Never substitute the card header for an explicitly linked word/phrase.
  if (element.matches('h1,h2,h3,h4,h5,h6') || (element.textContent ?? '').trim()) return element;
  const sibling = element.nextElementSibling;
  if (sibling instanceof HTMLElement && (sibling.textContent ?? '').trim()) return sibling;
  const paragraph = element.closest<HTMLElement>('p,li,h1,h2,h3,h4,h5,h6');
  if (paragraph && (paragraph.textContent ?? '').trim()) return paragraph;
  const parent = element.parentElement;
  return parent && (parent.textContent ?? '').trim() ? parent : element;
}

function readerScrollport(container: HTMLElement): HTMLElement | null {
  // The nearest scrollable ancestor is important for the full Library, its
  // split pane and the Library iframe inside AMBOSS Exam Runner.
  for (let parent = container.parentElement; parent; parent = parent.parentElement) {
    const overflow = window.getComputedStyle(parent).overflowY;
    if (/(auto|scroll)/.test(overflow) && parent.scrollHeight > parent.clientHeight + 1) {
      return parent;
    }
  }
  return null;
}

/**
 * Find the EXACT imported AMBOSS anchor, expand its card if needed, center it
 * inside the article reader and pulse the target (not the enclosing card).
 * Returns false for missing explicit anchors without guessing another section.
 * All entry points (full Library, same-article links and split panes) call this.
 */
export function scrollToAnchor(container: HTMLElement | null, anchor: string, term?: string): boolean {
  if (!container) return false;
  let element: HTMLElement | null = null;
  if (anchor) {
    try {
      element = container.querySelector<HTMLElement>('#' + CSS.escape(anchor));
      if (!element) {
        element = Array.from(container.querySelectorAll<HTMLElement>('[name]'))
          .find((node) => node.getAttribute('name') === anchor) ?? null;
      }
    } catch {
      return false;
    }
  }
  // A supplied anchor has authority over title guesses. Never navigate to a
  // similarly named section if that explicit target is absent.
  if (!element && !anchor && term) {
    const requested = term.trim().toLowerCase();
    if (requested) {
      element = Array.from(container.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,strong,b'))
        .find((node) => {
          const title = (node.textContent ?? '').trim().toLowerCase();
          return title === requested || title.startsWith(requested);
        }) ?? null;
    }
  }
  if (!element) return false;

  const card = element.closest<HTMLElement>('.amboss-card');
  card?.classList.remove('collapsed');
  const target = visibleReferenceTarget(element);
  const scrollport = readerScrollport(container);
  const owner = scrollport ?? container;
  activeReferenceJumps.get(owner)?.();

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cancelled = false;
  let interrupted = false;
  const correctionTimers: number[] = [];
  let cleanupTimer: number | null = null;
  let firstFrame = 0;
  let secondFrame = 0;
  const onUserScrollIntent = () => { interrupted = true; };
  const cancel = () => {
    cancelled = true;
    window.cancelAnimationFrame(firstFrame);
    window.cancelAnimationFrame(secondFrame);
    correctionTimers.forEach((timer) => window.clearTimeout(timer));
    if (cleanupTimer !== null) window.clearTimeout(cleanupTimer);
    window.removeEventListener('wheel', onUserScrollIntent);
    window.removeEventListener('touchstart', onUserScrollIntent);
    window.removeEventListener('pointerdown', onUserScrollIntent);
    window.removeEventListener('keydown', onUserScrollIntent);
    target.classList.remove('amboss-reference-spotlight');
    if (activeReferenceJumps.get(owner) === cancel) activeReferenceJumps.delete(owner);
  };
  activeReferenceJumps.set(owner, cancel);

  // Reapplying the class restarts two gentle pulses for each actual navigation.
  target.classList.remove('amboss-reference-spotlight');
  void target.offsetWidth;
  target.classList.add('amboss-reference-spotlight');

  const center = (behavior: ScrollBehavior) => {
    if (cancelled) return;
    if (!scrollport) {
      target.scrollIntoView({ block:'center', inline:'nearest', behavior });
      return;
    }
    const targetRect = target.getBoundingClientRect();
    const viewportRect = scrollport.getBoundingClientRect();
    const drift = (targetRect.top + targetRect.height / 2)
      - (viewportRect.top + viewportRect.height / 2);
    if (Math.abs(drift) < 2) return;
    const maximum = Math.max(0, scrollport.scrollHeight - scrollport.clientHeight);
    scrollport.scrollTo({
      top: Math.max(0, Math.min(maximum, scrollport.scrollTop + drift)),
      behavior,
    });
  };

  // React has committed the Library content at this point. Two frames let the
  // expanded card settle before measuring the correct reader and target.
  firstFrame = window.requestAnimationFrame(() => {
    secondFrame = window.requestAnimationFrame(() => {
      center(reduceMotion ? 'instant' : 'smooth');
      if (reduceMotion) return;
      // One correction accommodates late fonts/images; never recenter after
      // a person starts scrolling or interacting.
      window.addEventListener('wheel', onUserScrollIntent, { passive:true });
      window.addEventListener('touchstart', onUserScrollIntent, { passive:true });
      window.addEventListener('pointerdown', onUserScrollIntent, { passive:true });
      window.addEventListener('keydown', onUserScrollIntent);
      // Long native smooth scrolls and late layout changes can take longer
      // on phone viewports. Re-check the exact reader center a few times, not
      // just once; stop immediately if the user starts controlling the page.
      // Bounded corrections avoid permanent scroll observers or loops.
      for (const delay of [300, 700, 1150]) {
        correctionTimers.push(window.setTimeout(() => {
          if (!interrupted) center('instant');
        }, delay));
      }
    });
  });
  cleanupTimer = window.setTimeout(cancel, reduceMotion ? 1200 : 2100);
  return true;
}

export function clearMarks(con: HTMLElement): void {
  con.querySelectorAll('mark.msr').forEach((m) => {
    const t = document.createTextNode(m.textContent || '');
    m.parentNode?.replaceChild(t, m);
  });
}

/** Wrap every regex match in the subtree with <mark class="msr"> (port of hlTxt). */
export function wrapMatches(node: Node, re: RegExp): void {
  if (node.nodeType === 3) {
    const value = node.nodeValue || '';
    re.lastIndex = 0;
    if (!re.test(value)) {
      re.lastIndex = 0;
      return;
    }
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(value))) {
      if (match.index > last) frag.appendChild(document.createTextNode(value.slice(last, match.index)));
      const mark = document.createElement('mark');
      mark.className = 'msr';
      mark.textContent = match[0];
      frag.appendChild(mark);
      last = match.index + match[0].length;
      if (match[0].length === 0) re.lastIndex++;
    }
    if (last < value.length) frag.appendChild(document.createTextNode(value.slice(last)));
    node.parentNode?.replaceChild(frag, node);
  } else if (node.nodeType === 1) {
    const el = node as HTMLElement;
    if (!['SCRIPT', 'STYLE', 'MARK'].includes(el.tagName)) {
      Array.from(node.childNodes).forEach((c) => wrapMatches(c, re));
    }
  }
}