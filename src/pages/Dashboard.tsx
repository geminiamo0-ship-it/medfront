import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SectionLoader } from '@/components/PulseLoader';
import { getMainBanks, getPerformanceOverview, type MainBank } from '@/api/tests';
import { STEPS, stepLabel } from '@/lib/nav';

const STEP_KEY = 'mp_step';

export default function DashboardPage() {
  const [step, setStep] = useState<number>(() => {
    const saved = Number(localStorage.getItem(STEP_KEY));
    return saved >= 1 && saved <= 5 ? saved : 1;
  });

  useEffect(() => {
    localStorage.setItem(STEP_KEY, String(step));
  }, [step]);

  const banksQuery = useQuery({
    queryKey: ['main-banks', step],
    queryFn: () => getMainBanks(step),
  });

  const perfQuery = useQuery({
    queryKey: ['performance-overview', step],
    queryFn: () => getPerformanceOverview(step),
  });

  const summary = perfQuery.data?.data?.summary;
  const accuracy = summary ? Number(summary.accuracy) : null;
  const solved = summary?.questionsAnswered ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Step tabs */}
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {STEPS.map((s) => {
          const active = s.step === step;
          return (
            <button
              key={s.step}
              type="button"
              onClick={() => setStep(s.step)}
              className={`flex min-w-[168px] shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                active
                  ? 'border-mp bg-mp text-white shadow-glow'
                  : 'border-line bg-surface text-ink hover:border-mp/40 hover:bg-surface2'
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-mp/10 text-mp'
                }`}
              >
                {s.step}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{s.title}</span>
                <span className={`block truncate text-xs ${active ? 'text-white/80' : 'text-ink-muted'}`}>
                  {s.subtitle}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Performance overview */}
      <div className="mt-5 flex items-center justify-between rounded-2xl border border-line bg-surface px-6 py-5 shadow-card">
        <div>
          <h2 className="text-lg font-bold text-ink">Performance Overview</h2>
          <p className="text-sm text-ink-muted">Track your mastery across {stepLabel(step)}</p>
        </div>
        <div className="flex items-center gap-8">
          <div className="text-right">
            <div className="text-2xl font-extrabold text-mp">
              {perfQuery.isLoading ? '—' : `${(accuracy ?? 0).toFixed(1)}%`}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Accuracy
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold text-ink">
              {perfQuery.isLoading ? '—' : (solved ?? 0)}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Solved
            </div>
          </div>
        </div>
      </div>

      {/* Curated banks */}
      <div className="mt-10">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink">
          Curated Question Banks
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Select a primary bank to begin your practice
        </p>

        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {banksQuery.isLoading && (
            <div className="col-span-full">
              <SectionLoader minHeight={230} label="Loading banks" />
            </div>
          )}

          {banksQuery.isError && (
            <div className="col-span-full rounded-2xl border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">
              Could not load question banks. Please refresh.
            </div>
          )}

          {banksQuery.data?.length === 0 && (
            <div className="col-span-full rounded-2xl border border-line bg-surface px-6 py-10 text-center text-ink-muted">
              No banks available for {stepLabel(step)} yet.
            </div>
          )}

          {banksQuery.data?.map((bank) => (
            <BankCard key={bank.id} bank={bank} step={step} />
          ))}
        </div>
      </div>

      {/* Floating assistant */}
      <Link
        to="/ai-analyst"
        className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-mp text-white shadow-pop transition-transform hover:scale-105"
        aria-label="AI assistant"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="m22 2-7 20-4-9-9-4 20-7Z" />
        </svg>
      </Link>
    </div>
  );
}

function BankCard({ bank, step }: { bank: MainBank; step: number }) {
  return (
    <Link
      to={`/qbank?bank=${bank.id}&step=${step}`}
      className="group flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-mp/40 hover:shadow-pop"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xl font-extrabold tracking-tight text-ink">{bank.name}</h3>
        {bank.isLocked && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn/10 px-2 py-0.5 text-[11px] font-semibold text-warn">
            <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="2.5">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Premium
          </span>
        )}
      </div>

      <div className="mt-3 h-1 w-10 rounded-full bg-mp transition-all duration-300 group-hover:w-16" />

      <p className="mt-5 text-sm text-ink-muted">Start practicing now.</p>

      <div className="mt-auto flex items-center justify-between border-t border-line pt-4">
        <span className="text-sm font-semibold text-mp">View Questions</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-4 w-4 text-mp transition-transform duration-300 group-hover:translate-x-1"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      </div>
    </Link>
  );
}