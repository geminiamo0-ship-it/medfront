import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getQuestionBanks } from '@/api/tests';
import { providerGradient, providerInitials } from './bankTheme';

const STUB_ITEMS = ['Performance', 'Search', 'Notes', 'Flashcards', 'My Notebook', 'Help'] as const;

const NAV_ITEMS = [
  { to: '.', label: 'Welcome', end: true },
  { to: 'create-test', label: 'Create Test' },
  { to: 'previous-tests', label: 'Previous Tests' },
] as const;

type QuestionBankSummary = {
  id: number;
  name: string;
  code: string;
};

export default function QbankWorkspace() {
  const { bankId } = useParams();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const id = Number(bankId);
  const stepParam = new URLSearchParams(location.search).get('step');
  const step = stepParam && Number(stepParam) >= 1 && Number(stepParam) <= 5 ? Number(stepParam) : 1;

  const qbQuery = useQuery({
    queryKey: ['question-bank', step, id],
    queryFn: () => getQuestionBanks(step),
  });
  const questionBank = qbQuery.data?.find((b) => b.id === id) ?? null;

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSidebarOpen(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  if (!qbQuery.isLoading && !questionBank) {
    return (
      <div className="min-h-screen bg-canvas px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-6 text-center shadow-card sm:p-10">
          <h1 className="text-lg font-extrabold text-ink">Bank not found</h1>
          <p className="mt-2 text-sm text-ink-muted">
            This bank doesn't exist for Step {step}, or it failed to load.
          </p>
          <Link
            to={`/qbank?step=${step}`}
            className="mt-6 inline-flex rounded-xl bg-mp px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-mp-hover"
          >
            Back to banks
          </Link>
        </div>
      </div>
    );
  }

  const sidebarBank = questionBank
    ? { id: questionBank.id, name: questionBank.name, code: questionBank.code }
    : null;

  return (
    <div className="flex min-h-screen min-w-0 bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-ink text-white lg:flex">
        <SidebarContent bank={sidebarBank} />
      </aside>

      {sidebarOpen && (
        <>
          <button
            type="button"
            aria-label="Close QBank menu"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] lg:hidden"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[86vw] flex-col bg-ink text-white shadow-pop lg:hidden">
            <SidebarContent
              bank={sidebarBank}
              onClose={() => setSidebarOpen(false)}
              onNavigate={() => setSidebarOpen(false)}
            />
          </aside>
        </>
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:ml-60">
        <header className="sticky top-0 z-20 flex h-14 min-w-0 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur sm:gap-3 sm:px-4 lg:px-6">
          <button
            type="button"
            aria-label="Open QBank menu"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft transition-colors hover:border-mp/40 hover:bg-surface2 hover:text-ink lg:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" stroke="currentColor" strokeWidth="2.25">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <WorkspaceTitle />
            <div className="truncate text-[11px] font-medium text-ink-faint lg:hidden">
              {questionBank?.name ?? 'QBank'}
            </div>
          </div>

          <Link
            to={`/qbank?step=${step}`}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface2 hover:text-ink sm:px-3"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v14H4zM4 10h16M9 10v9" />
            </svg>
            <span className="hidden sm:inline">Banks</span>
          </Link>
        </header>

        <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-5 sm:px-5 sm:py-6 lg:px-6 lg:py-8">
          <Outlet
            context={{
              bank: questionBank
                ? {
                    id: questionBank.id,
                    name: questionBank.name,
                    code: questionBank.code,
                    displayOrder: questionBank.displayOrder,
                    isPremium: questionBank.isPremium,
                    isLocked: questionBank.isLocked,
                  }
                : null,
              step,
              bankId: id,
            }}
          />
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  bank,
  onClose,
  onNavigate,
}: {
  bank: QuestionBankSummary | null;
  onClose?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="border-b border-white/10 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white shadow-pop"
            style={{ background: providerGradient(bank?.code ?? '') }}
          >
            {providerInitials(bank?.name ?? 'Bank')}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{bank?.name ?? 'Loading…'}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">QBank</div>
          </div>
          {onClose && (
            <button
              type="button"
              aria-label="Close QBank menu"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/65 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={'end' in item ? item.end : false}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}

        {STUB_ITEMS.map((label) => (
          <span
            key={label}
            className="flex min-h-11 cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-white/30"
            title="Coming soon"
          >
            {label}
          </span>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-4 text-[11px] text-white/40">MedPark QBank</div>
    </>
  );
}

function WorkspaceTitle() {
  const location = useLocation();
  let title = 'Welcome';
  if (location.pathname.endsWith('/create-test')) title = 'Create Test';
  else if (location.pathname.endsWith('/previous-tests')) title = 'Previous Tests';
  else if (/\/test\/\d+/.test(location.pathname)) title = 'Test';

  return <div className="truncate text-sm font-bold text-ink sm:text-base">{title}</div>;
}
