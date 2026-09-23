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

export default function QbankWorkspace() {
  const { bankId } = useParams();
  const location = useLocation();

  const id = Number(bankId);
  const stepParam = new URLSearchParams(location.search).get('step');
  const step = stepParam && Number(stepParam) >= 1 && Number(stepParam) <= 5 ? Number(stepParam) : 1;

  // bankId is a question-bank id (e.g. 19 = "UW (Step 1)"); resolve it to get
  // the provider branding and the qBankCode for statistics.
  const qbQuery = useQuery({
    queryKey: ['question-bank', step, id],
    queryFn: () => getQuestionBanks(step),
  });
  const questionBank = qbQuery.data?.find((b) => b.id === id) ?? null;

  if (!qbQuery.isLoading && !questionBank) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-line bg-surface p-10 shadow-card">
          <h1 className="text-lg font-extrabold text-ink">Bank not found</h1>
          <p className="mt-2 text-sm text-ink-muted">
            This bank doesn't exist for Step {step}, or it failed to load.
          </p>
          <Link
            to={`/qbank?step=${step}`}
            className="mt-6 inline-block rounded-xl bg-mp px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-mp-hover"
          >
            Back to banks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-ink text-white">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white shadow-pop"
              style={{ background: providerGradient(questionBank?.code ?? '') }}
            >
              {providerInitials(questionBank?.name ?? 'Bank')}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{questionBank?.name ?? 'Loading…'}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
                QBank
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
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
              className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-white/30"
              title="Coming soon"
            >
              {label}
            </span>
          ))}
        </nav>

        <div className="border-t border-white/10 px-5 py-4 text-[11px] text-white/40">
          MedPark QBank
        </div>
      </aside>

      {/* Content */}
      <div className="ml-60 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-6 backdrop-blur">
          <Link
            to={`/qbank?step=${step}`}
            className="flex h-8 items-center gap-2 rounded-lg bg-mp px-3 text-xs font-bold text-white transition-colors hover:bg-mp-hover"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Link>
          <WorkspaceTitle />
          <Link
            to={`/qbank?step=${step}`}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface2 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z" />
            </svg>
            Home
          </Link>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
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

function WorkspaceTitle() {
  const location = useLocation();
  let title = 'Welcome';
  if (location.pathname.endsWith('/create-test')) title = 'Create Test';
  else if (location.pathname.endsWith('/previous-tests')) title = 'Previous Tests';
  else if (/\/test\/\d+/.test(location.pathname)) title = 'Test';
  return <span className="text-base font-bold text-ink">{title}</span>;
}
