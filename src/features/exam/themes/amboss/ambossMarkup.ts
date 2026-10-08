import { safeRichHtml } from '@/lib/sanitize';


function rewriteAmbossLibraryLinks(root: ParentNode): void {
  root.querySelectorAll<HTMLAnchorElement>('a').forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';
    const hash = href.includes('#') ? href.slice(href.indexOf('#') + 1) : '';
    const hashParams = new URLSearchParams(hash);

    const externalId =
      anchor.getAttribute('data-learningcard-id')?.trim() ||
      hashParams.get('xid')?.trim() ||
      '';

    if (!externalId) return;

    const sectionAnchor =
      anchor.getAttribute('data-anker')?.trim() ||
      hashParams.get('anker')?.trim() ||
      '';

    const params = new URLSearchParams({
      source: 'amboss',
      article: externalId,
    });
    if (sectionAnchor) params.set('anchor', sectionAnchor);

    anchor.setAttribute('href', `/library?${params.toString()}`);
    anchor.setAttribute('data-medpark-library-link', '1');
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
  });
}


/** Reuse the existing AMBOSS article deep-link conversion inside image descriptions. */
export function prepareAmbossImageDescription(value: string): string {
  const safe = safeRichHtml(value);
  if (typeof DOMParser === 'undefined') return safe;
  const document = new DOMParser().parseFromString(safe, 'text/html');
  rewriteAmbossLibraryLinks(document.body);
  return safeRichHtml(document.body.innerHTML);
}

export interface ParsedAmbossQuestion {
  stemHtml: string;
  hintHtml: string;
}

export function parseAmbossQuestionHtml(value: unknown): ParsedAmbossQuestion {
  const safe = safeRichHtml(value);
  if (typeof DOMParser === 'undefined') {
    return { stemHtml: safe, hintHtml: '' };
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(`<div id="amboss-root">${safe}</div>`, 'text/html');
  const root = document.getElementById('amboss-root');
  if (!root) return { stemHtml: safe, hintHtml: '' };

  root.querySelectorAll('style').forEach((node) => node.remove());
  rewriteAmbossLibraryLinks(root);

  const hints = Array.from(root.querySelectorAll('.amboss-hint'));
  const hintHtml = hints
    .map((node) =>
      node.innerHTML
        .replace(/^\s*<br\s*\/?>\s*<b>\s*Hint:\s*<\/b>\s*<br\s*\/?>/i, '')
        .trim(),
    )
    .filter(Boolean)
    .join('<br>');

  hints.forEach((node) => node.remove());

  // Imported images are sometimes appended after the final paragraph, making
  // a plain CSS float appear *below* the stem. Group freestanding images at the
  // start so the approved AMBOSS thumbnail rail sits beside the question text.
  // Leave tables, figures and linked images in their original context.
  const stemImages = Array.from(root.querySelectorAll('img'))
    .filter((image) => !image.closest('table, figure, a'));
  if (stemImages.length) {
    const rail = document.createElement('div');
    rail.className = 'amboss-stem-image-rail';
    for (const image of stemImages) rail.appendChild(image);
    root.insertBefore(rail, root.firstChild);
  }

  return {
    stemHtml: safeRichHtml(root.innerHTML),
    hintHtml: safeRichHtml(hintHtml),
  };
}


export interface ParsedAmbossExplanation {
  optionExplanations: Record<string, string>;
  learningObjectiveHtml: string;
}

/**
 * Imported AMBOSS data can store all option explanations inside the question
 * explanation blob instead of question_options.explanation_html:
 *
 *   <div><b>a (Incorrect):</b><br>...</div>
 *   <div><b>b (Incorrect):</b><br>...</div>
 *   ...
 *   <div class="amboss-learning-obj">...</div>
 *
 * Keep this adapter theme-local so the shared Exam Core and other themes do
 * not need to understand AMBOSS import markup.
 */
export function parseAmbossExplanationHtml(value: unknown): ParsedAmbossExplanation {
  const safe = safeRichHtml(value);
  const empty: ParsedAmbossExplanation = {
    optionExplanations: {},
    learningObjectiveHtml: '',
  };

  if (!safe || typeof DOMParser === 'undefined') return empty;

  const parser = new DOMParser();
  const document = parser.parseFromString(`<div id="amboss-explanation-root">${safe}</div>`, 'text/html');
  const root = document.getElementById('amboss-explanation-root');
  if (!root) return empty;

  root.querySelectorAll('style').forEach((node) => node.remove());
  rewriteAmbossLibraryLinks(root);

  const learningNodes = Array.from(root.querySelectorAll('.amboss-learning-obj'));
  const learningObjectiveHtml = learningNodes
    .map((node) => node.innerHTML.trim())
    .filter(Boolean)
    .join('<br>');
  learningNodes.forEach((node) => node.remove());

  const optionExplanations: Record<string, string> = {};

  for (const child of Array.from(root.children)) {
    if (!(child instanceof HTMLElement) || child.tagName !== 'DIV') continue;

    const first = child.firstElementChild;
    if (!(first instanceof HTMLElement) || first.tagName !== 'B') continue;

    const match = first.textContent?.match(
      /^\s*([a-z])\s*\(\s*(?:correct|incorrect)\s*\)\s*:\s*$/i,
    );
    if (!match) continue;

    const optionKey = match[1].toUpperCase();
    const clone = child.cloneNode(true) as HTMLElement;
    clone.firstElementChild?.remove();

    while (clone.firstChild) {
      const node = clone.firstChild;
      if (node.nodeType === Node.TEXT_NODE && !(node.textContent ?? '').trim()) {
        node.remove();
        continue;
      }
      if (node instanceof HTMLBRElement) {
        node.remove();
        continue;
      }
      break;
    }

    const html = safeRichHtml(clone.innerHTML.trim());
    if (html) optionExplanations[optionKey] = html;
  }

  return {
    optionExplanations,
    learningObjectiveHtml: safeRichHtml(learningObjectiveHtml),
  };
}
