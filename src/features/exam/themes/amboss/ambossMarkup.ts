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
