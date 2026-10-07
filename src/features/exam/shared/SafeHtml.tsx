import { safeRichHtml } from '@/lib/sanitize';

interface SafeHtmlProps {
  html: unknown;
  className?: string;
}

export function SafeHtml({ html, className }: SafeHtmlProps) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: safeRichHtml(html) }}
    />
  );
}
