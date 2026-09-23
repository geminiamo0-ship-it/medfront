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

/**
 * Scroll to an anchor inside a container.
 * Order: #id / [name] / [data-anker] (excluding cross-ref links, which also
 * carry data-anker and would otherwise send us to the wrong place), then a
 * text fallback on the term.
 */
export function scrollToAnchor(container: HTMLElement | null, anchor: string, term?: string): boolean {
  if (!container) return false;
  let el: HTMLElement | null = null;

  if (anchor) {
    const a = anchor.replace(/"/g, '\\"');
    try {
      // The real anchor target is `#Z…` / `<span data-type="anker" id="Z…">`.
      // Do NOT match `[data-anker]` — that attribute lives on the SOURCE link
      // (a span), which appears earlier in the doc and would scroll us to the
      // wrong place.
      el = container.querySelector(
        `#${CSS.escape(anchor)}, [name="${a}"], [data-type="anker"][id="${a}"]`,
      ) as HTMLElement | null;
    } catch {
      el = null;
    }
  }

  if (!el && term) {
    const t = term.trim().toLowerCase();
    if (t) {
      const heads = container.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, b');
      for (const h of Array.from(heads)) {
        const txt = (h.textContent || '').trim().toLowerCase();
        if (txt === t || txt.startsWith(t)) {
          el = h as HTMLElement;
          break;
        }
      }
    }
  }

  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const prev = el.style.backgroundColor;
  el.style.transition = 'background-color .3s';
  el.style.backgroundColor = 'rgba(255,69,0,.25)';
  window.setTimeout(() => {
    el!.style.backgroundColor = prev;
  }, 1200);
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