import { forwardRef } from 'react';
import { safeRichHtml } from '@/lib/sanitize';

interface SafeHtmlProps {
  html: unknown;
  className?: string;
}

export const SafeHtml = forwardRef<HTMLDivElement, SafeHtmlProps>(
  function SafeHtml({ html, className }, ref) {
    return (
      <div
        ref={ref}
        className={className}
        dangerouslySetInnerHTML={{ __html: safeRichHtml(html) }}
      />
    );
  },
);
