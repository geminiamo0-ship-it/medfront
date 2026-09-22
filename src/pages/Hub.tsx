import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Logo } from '@/components/Logo';
import { TiltCard } from '@/components/hub/TiltCard';
import { Button } from '@/components/ui/Button';

function initials(name?: string): string {
  if (!name) return 'MP';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default function HubPage() {
  const { user, logout } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      {/* Ambient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 animate-floaty rounded-full bg-mp/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] animate-floaty rounded-full bg-link/10 blur-3xl"
        style={{ animationDelay: '1.6s' }}
      />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/hub" className="flex items-center gap-2">
            <Logo className="h-7 w-7" />
            <span className="text-lg font-bold tracking-tight text-ink">MedPark</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mp/10 text-xs font-bold text-mp">
                {initials(user?.name)}
              </div>
              <span className="max-w-[10rem] truncate text-sm font-medium text-ink-soft">
                {user?.name ?? 'Student'}
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Hero + cards */}
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-14 sm:py-20">
        <div className="animate-fade-up text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            What would you like to focus on today?
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-ink-muted">
            Practice high-yield questions or dive into the medical library.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          <TiltCard to="/qbank" glowRgb="255,69,0" className="animate-fade-up">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-mp/10 text-mp transition-transform duration-300 group-hover:scale-110">
              <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" stroke="currentColor" strokeWidth="1.8">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-2xl font-bold text-ink">Question Banks</h2>
            <p className="mt-2 text-ink-muted">
              Practice exam questions, build custom tests, and track your performance.
            </p>
            <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-mp">
              Start practicing
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </span>
          </TiltCard>

          <TiltCard
            to="/library"
            glowRgb="0,121,211"
            className="animate-fade-up"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-link/10 text-link transition-transform duration-300 group-hover:scale-110">
              <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" stroke="currentColor" strokeWidth="1.8">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.25v13m0-13C10.8 5.5 9.25 5 7.5 5S4.17 5.5 3 6.25v13C4.17 18.5 5.75 18 7.5 18s3.33.5 4.5 1.25m0-13C13.17 5.5 14.75 5 16.5 5s3.33.5 4.5 1.25v13C19.83 18.5 18.25 18 16.5 18s-3.33.5-4.5 1.25"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-2xl font-bold text-ink">Medical Library</h2>
            <p className="mt-2 text-ink-muted">
              Explore detailed medical articles, high-yield notes, and references.
            </p>
            <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-link">
              Explore library
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </span>
          </TiltCard>
        </div>
      </main>
    </div>
  );
}