import type { ReactNode } from 'react';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function AuthLayout({ title, subtitle, children, footer, wide }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className={`w-full ${wide ? 'max-w-lg' : 'max-w-sm'}`}>
        <div className="mb-8 flex items-center justify-center gap-2">
          <img src="/favicon.svg" alt="MedPark" className="h-8 w-8" />
          <span className="text-2xl font-bold tracking-tight text-mp">MedPark</span>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-7 shadow-card">
          <h1 className="mb-1 text-xl font-bold text-ink">{title}</h1>
          {subtitle && <p className="mb-6 text-sm text-ink-muted">{subtitle}</p>}
          {!subtitle && <div className="mb-6" />}
          {children}
        </div>

        {footer && <div className="mt-5 text-center text-sm text-ink-muted">{footer}</div>}
      </div>
    </div>
  );
}

/** Inline form-level message (error / info / success). */
export function FormMessage({
  kind = 'error',
  children,
}: {
  kind?: 'error' | 'info' | 'success';
  children: ReactNode;
}) {
  const styles = {
    error: 'border-bad/30 bg-bad/5 text-bad',
    info: 'border-link/30 bg-link/5 text-link',
    success: 'border-ok/30 bg-ok/5 text-ok',
  }[kind];

  return (
    <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${styles}`}>{children}</div>
  );
}