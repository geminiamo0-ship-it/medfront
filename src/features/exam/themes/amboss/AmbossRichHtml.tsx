import { forwardRef, useMemo } from 'react';
import { SafeHtml } from '../../shared/SafeHtml';
import { safeRichHtml } from '@/lib/sanitize';

/** Theme-only rendering adapter; never touch the imported table's cells/data. */
export function prepareAmbossTableHtml(value: unknown): string {
  const safe = safeRichHtml(value);
  if (!safe || typeof DOMParser === 'undefined' || !/<table\b/i.test(safe)) return safe;
  const document = new DOMParser().parseFromString(safe, 'text/html');
  document.querySelectorAll('table').forEach((table) => {
    if (table.closest('table table')) return;
    const parent = table.parentElement;
    const existingFrame = parent?.classList.contains('modal-overflow-scroll') ||
      parent?.classList.contains('amboss-table-scroll');
    const frame = existingFrame ? parent : document.createElement('div');
    if (!frame) return;
    if (!existingFrame) {
      table.before(frame);
      frame.appendChild(table);
    }
    frame.classList.add('amboss-table-scroll');
    frame.setAttribute('role', 'region');
    frame.setAttribute('aria-label', 'Medical data table — scroll horizontally to view all columns');
    frame.setAttribute('tabindex', '0');
  });
  return document.body.innerHTML;
}

interface AmbossRichHtmlProps {
  html: unknown;
  className?: string;
}

/** Reuse SafeHtml's strict sanitizer while keeping native table semantics. */
export const AmbossRichHtml = forwardRef<HTMLDivElement, AmbossRichHtmlProps>(
  function AmbossRichHtml({ html, className }, ref) {
    const formatted = useMemo(() => prepareAmbossTableHtml(html), [html]);
    return <SafeHtml ref={ref} html={formatted} className={className} />;
  },
);
