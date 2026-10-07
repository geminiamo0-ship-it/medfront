import { safeRichHtml } from '@/lib/sanitize';

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
