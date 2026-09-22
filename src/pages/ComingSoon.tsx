import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
      <Logo className="h-12 w-12 animate-floaty" />
      <h1 className="mt-6 text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 max-w-sm text-ink-muted">
        This section is being rebuilt. It will land here in an upcoming phase.
      </p>
      <Link
        to="/hub"
        className="mt-6 inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface2"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m6 6-6-6 6-6" />
        </svg>
        Back to hub
      </Link>
    </div>
  );
}