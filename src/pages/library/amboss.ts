import { MEDIA_CDN } from '@/lib/env';

/** decodeURIComponent(escape(atob(x))) with graceful fallbacks. */
export function decodeB64(s: string | null): string {
  if (!s) return s ?? '';
  try {
    return decodeURIComponent(escape(atob(s)));
  } catch {
    try {
      return atob(s);
    } catch {
      return s;
    }
  }
}

function escAttr(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Rewrite offline_media image paths to the CDN. */
export function fixOfflineMedia(html: string): string {
  return html.replace(
    /(<img[^>]+src=["'])(?!http|data:)([^"'>]+)(["'])/gi,
    (_m, pre: string, path: string, post: string) => {
      const clean = path.replace(/^(?:\/?offline_media\/|\/+)/, '');
      return pre + MEDIA_CDN + 'offline_media/' + clean + post;
    },
  );
}

const IMG_BTN_SVG =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

/** Learning-card icon (16x16) used for cross-reference / learning-tip badges. */
const LEARNING_CARD_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" focusable="false"><g stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 2a1 1 0 0 0-1 1v3.222L1.638 7.67c-.091.097-.236.17-.255.3a.2.2 0 0 0 0 .06c.02.13.164.203.255.3L3 9.778V13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"></path><path stroke-linecap="square" stroke-linejoin="bevel" d="M7 6h4m-4 4h4"></path></g></svg>';

/**
 * Port of transformToAmbossCards: turns inline image spans into viewer buttons
 * and splits the article on <h2> into collapsible Amboss cards. Inline onclick
 * handlers are replaced with data-* hooks wired in setupAmbossInteractions.
 */
export function transformToAmbossCards(html: string): string {
  let out = html.replace(
    /<span[^>]*class=["']api["'][^>]*data-type=["']image["'][^>]*data-image-id=["']([^"']+)["'][^>]*data-title=["']([^"']*)["'][^>]*data-description=["']([^"']*)["'][^>]*>.*?<\/span>/gi,
    (_m, imgId: string, rawTitle: string, rawDesc: string) => {
      const t = decodeB64(rawTitle);
      const d = decodeB64(rawDesc);
      const imgSrc = `${MEDIA_CDN}offline_media/${imgId}.jpg`;
      return `<button type="button" class="amboss-inline-img-btn" data-img-src="${escAttr(
        imgSrc,
      )}" data-title="${escAttr(t)}" data-desc="${escAttr(
        d,
      )}" title="View illustration: ${escAttr(t)}">${IMG_BTN_SVG}</button>`;
    },
  );

  if (!out.includes('<h2')) {
    return `<div class="amboss-card"><div class="amboss-card-body">${out}</div></div>`;
  }

  const parts = out.split(/(<h2[^>]*>.*?<\/h2>)/i);
  let result = '';
  let currentHeader = '';
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    if (part.toLowerCase().startsWith('<h2')) {
      currentHeader = part.replace(/<\/?h2[^>]*>/gi, '').trim();
    } else {
      const headerTitle = currentHeader || 'Overview';
      result += `
        <div class="amboss-card">
          <div class="amboss-card-header" data-amboss-toggle>
            <h2><span>${headerTitle}</span></h2>
            <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="amboss-card-body">${part}</div>
          <div class="amboss-card-actions">
            <button class="amboss-action-btn" data-amboss-toggle>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
              COLLAPSE
            </button>
            <button class="amboss-action-btn" data-amboss-insert-ref>📝 NOTES</button>
          </div>
        </div>`;
      currentHeader = '';
    }
  }
  out = result;
  return out;
}

export interface AmbossHandlers {
  onShowPopover: (el: HTMLElement) => void;
  onShowTipPopover: (anchor: HTMLElement, contentHtml: string) => void;
  onShowHoverCard: (btn: HTMLElement) => void;
  onHideHoverCard: () => void;
  onOpenImageViewer: (imgSrc: string, title: string, desc: string, overlaySrc: string) => void;
  onInsertArticleRef: () => void;
}

/** Strip inline backgrounds so CSS dark mode wins. Text colors are KEPT so
 *  coloured spans (and key-exam highlights) stay visible in dark mode. */
export function stripInlineStylesForDark(root: HTMLElement | null): void {
  if (!root) return;
  root
    .querySelectorAll(
      'td, th, tr, table, thead, tbody, tfoot, div, span, p, li, ul, ol, h1, h2, h3, h4, section, article',
    )
    .forEach((el) => {
      const h = el as HTMLElement;
      if (h.tagName === 'MARK' || h.closest('mark')) return;
      const s = h.style;
      if (!s) return;
      if (!h.dataset.origBg && (s.backgroundColor || s.background)) {
        h.dataset.origBg = s.backgroundColor || s.background || '';
      }
      s.removeProperty('background');
      s.removeProperty('background-color');
    });
}

export function restoreInlineStyles(root: HTMLElement | null): void {
  if (!root) return;
  root.querySelectorAll<HTMLElement>('[data-orig-bg]').forEach((el) => {
    if (el.dataset.origBg) el.style.backgroundColor = el.dataset.origBg;
  });
}
export function setupAmbossInteractions(con: HTMLElement, h: AmbossHandlers): void {
  // 1. .extraExplanation → inline image/ref badges
  con.querySelectorAll<HTMLElement>('.extraExplanation').forEach((el) => {
    const raw = el.getAttribute('data-content');
    if (!raw) return;
    const decoded = decodeB64(raw);
    if (decoded.includes('data-type="image"') || decoded.includes('data-image-id')) {
      const idMatch = decoded.match(/data-image-id=["']([^"']+)["']/i);
      const titleMatch = decoded.match(/data-title=["']([^"']*)["']/i);
      const descMatch = decoded.match(/data-description=["']([^"']*)["']/i);
      const imgId = idMatch ? idMatch[1] : '';
      const title = decodeB64(titleMatch ? titleMatch[1] : 'Medical Illustration');
      const desc = decodeB64(descMatch ? descMatch[1] : '');
      if (imgId) {
        const imgSrc = `${MEDIA_CDN}offline_media/${imgId}.jpg`;
        el.className = 'amboss-inline-img-badge';
        el.innerHTML = '&#x1F5BC;';
        el.setAttribute('title', title);
        el.dataset.imgSrc = imgSrc;
        el.dataset.title = title;
        el.dataset.desc = desc;
        el.addEventListener('mouseenter', () => h.onShowHoverCard(el));
        el.addEventListener('mouseleave', () => window.setTimeout(h.onHideHoverCard, 400));
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          h.onOpenImageViewer(imgSrc, title, desc, el.dataset.overlaySrc || '');
        });
      }
    } else {
      el.className = 'amboss-inline-ref-badge';
      el.innerHTML = LEARNING_CARD_SVG;
      el.setAttribute('title', 'Learning tip');
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        h.onShowPopover(el);
      });
    }
  });

  // 2. Learning tips → popover (hide the inline content box, show on click)
  con.querySelectorAll<HTMLElement>('.lamp-container').forEach((lamp) => {
    const trigger = (lamp.querySelector('.lamp-trigger') as HTMLElement) || lamp;
    let content = lamp.querySelector<HTMLElement>('.lamp-content');
    if (!content && lamp.nextElementSibling?.classList.contains('lamp-content')) {
      content = lamp.nextElementSibling as HTMLElement;
    }
    if (!content) return;
    content.style.display = 'none';
    trigger.style.cursor = 'pointer';
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      h.onShowTipPopover(trigger, content!.innerHTML);
    });
  });

  // 3. Medical term popovers
  con.querySelectorAll<HTMLElement>(
    'span.api, a.api, span.dictionary, a.dictionary, span.linksuggest, a.linksuggest',
  ).forEach((el) => {
    if (
      el.classList.contains('amboss-inline-img-badge') ||
      el.classList.contains('amboss-inline-ref-badge')
    )
      return;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      h.onShowPopover(el);
    });
  });

  // 4. Images → viewer
  con.querySelectorAll<HTMLImageElement>('img.pm-img, table img').forEach((img) => {
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      h.onOpenImageViewer(
        img.src,
        img.getAttribute('title') || 'Medical Illustration',
        img.getAttribute('data-description') || '',
        img.getAttribute('data-overlay-src') || img.getAttribute('data-overlay') || '',
      );
    });
  });

  // 5. Inline image buttons → hover card + viewer
  con.querySelectorAll<HTMLElement>('.amboss-inline-img-btn').forEach((btn) => {
    btn.addEventListener('mouseenter', () => h.onShowHoverCard(btn));
    btn.addEventListener('mouseleave', () => window.setTimeout(h.onHideHoverCard, 400));
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      h.onOpenImageViewer(
        btn.dataset.imgSrc || '',
        btn.dataset.title || '',
        btn.dataset.desc || '',
        '',
      );
    });
  });

  // 6. Card collapse + notes
  con.querySelectorAll<HTMLElement>('[data-amboss-toggle]').forEach((el) => {
    el.addEventListener('click', () => {
      el.closest('.amboss-card')?.classList.toggle('collapsed');
    });
  });
  con.querySelectorAll<HTMLElement>('[data-amboss-insert-ref]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      h.onInsertArticleRef();
    });
  });
}