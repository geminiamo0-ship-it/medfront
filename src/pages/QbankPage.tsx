import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getMainBanks,
  getQuestionBanks,
  type MainBank,
  type QuestionBankWithProgress,
} from '@/api/tests';
import { STEPS, stepLabel } from '@/lib/nav';

const STEP_KEY = 'mp_step';

/** Per-provider gradients, mirroring the backend main-bank seeds. */
const PROVIDER_GRADIENTS: Array<[prefix: string, gradient: string]> = [
  ['UWORLD', 'linear-gradient(135deg, #1e3c72 0%, #2a69ac 100%)'],
  ['AMBOSS', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'],
  ['MEHLMAN', 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'],
  ['NBME', 'linear-gradient(135deg, #c0392b 0%, #e74c3c 100%)'],
  ['CMS', 'linear-gradient(135deg, #f39c12 0%, #f1c40f 100%)'],
  ['PASS_MED', 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)'],
  ['PASTEST', 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'],
  ['PAST_PAPERS', 'linear-gradient(135deg, #475569 0%, #334155 100%)'],
  ['ONEXAM', 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)'],
  ['MRCP_PART', 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)'],
  ['MEDPARK', 'linear-gradient(135deg, #ff4500 0%, #ff7849 100%)'],
];

function providerGradient(code: string): string {
  const normalized = code.trim().toUpperCase();
  for (const [prefix, gradient] of PROVIDER_GRADIENTS) {
    if (normalized.startsWith(prefix)) return gradient;
  }
  return 'linear-gradient(135deg, #ff4500 0%, #ff7849 100%)';
}

function providerInitials(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
}

function PremiumBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn/10 px-2 py-0.5 text-[11px] font-semibold text-warn">
      <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="2.5">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      Premium
    </span>
  );
}

export default function QbankPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawStep = Number(searchParams.get('step'));
  const step = rawStep >= 1 && rawStep <= 5 ? rawStep : 1;
  const rawBank = Number(searchParams.get('bank'));
  const bankParam = Number.isFinite(rawBank) && rawBank > 0 ? rawBank : null;

  useEffect(() => {
    localStorage.setItem(STEP_KEY, String(step));
  }, [step]);

  const banksListQuery = useQuery({
    queryKey: ['main-banks', step],
    queryFn: () => getMainBanks(step),
  });

  const mainBanks = useMemo(() => banksListQuery.data ?? [], [banksListQuery.data]);
  const selectedBank = useMemo(
    () => mainBanks.find((b) => b.id === bankParam) ?? null,
    [mainBanks, bankParam],
  );

  const questionBanksQuery = useQuery({
    queryKey: ['question-banks', step, selectedBank?.id],
    queryFn: () => getQuestionBanks(step, selectedBank!.id),
    enabled: selectedBank != null,
  });
  const questionBanks = useMemo(
    () => questionBanksQuery.data ?? [],
    [questionBanksQuery.data],
  );

  function selectStep(next: number) {
    const params = new URLSearchParams();
    params.set('step', String(next));
    if (bankParam != null) params.set('bank', String(bankParam));
    setSearchParams(params);
  }

  function selectBank(id: number) {
    const params = new URLSearchParams();
    params.set('step', String(step));
    params.set('bank', String(id));
    setSearchParams(params);
  }

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
              onClick={() => selectStep(s.step)}
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

      {/* Breadcrumb */}
      <nav className="mt-5 flex items-center gap-1.5 text-sm text-ink-muted">
        <Link to="/dashboard" className="transition-colors hover:text-mp">
          Dashboard
        </Link>
        <span className="text-ink-faint">â€º</span>
        <span>{stepLabel(step)}</span>
        {selectedBank && (
          <>
            <span className="text-ink-faint">â€º</span>
            <span className="font-semibold text-ink">{selectedBank.name}</span>
          </>
        )}
      </nav>

      {/* Selected provider view: all banks underneath it */}
      {selectedBank ? (
        <section className="mt-4">
          <div className="flex items-center gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold text-white shadow-card"
              style={{ background: providerGradient(selectedBank.code) }}
            >
              {providerInitials(selectedBank.name)}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-ink">
                {selectedBank.name}
              </h1>
              <p className="text-sm text-ink-muted">
                {questionBanksQuery.isLoading
                  ? 'Loading banksâ€¦'
                  : `${questionBanks.length} bank${questionBanks.length === 1 ? '' : 's'} underneath`}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {questionBanksQuery.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-52 animate-pulse rounded-2xl border border-line bg-surface" />
              ))}

            {questionBanksQuery.isError && (
              <div className="col-span-full rounded-2xl border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">
                Could not load question banks. Please refresh.
              </div>
            )}

            {!questionBanksQuery.isLoading && !questionBanksQuery.isError && questionBanks.length === 0 && (
              <div className="col-span-full rounded-2xl border border-line bg-surface px-6 py-10 text-center text-ink-muted">
                No question banks under {selectedBank.name} yet.
              </div>
            )}

            {questionBanks.map((bank) => (
              <BankCard key={bank.id} bank={bank} />
            ))}
          </div>
        </section>
      ) : (
        /* Provider selection fallback */
        <section className="mt-4">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            Choose a Bank
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Select a primary bank for {stepLabel(step)} to see all of its question banks
          </p>

          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {banksListQuery.isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-2xl border border-line bg-surface" />
              ))}

            {banksListQuery.isError && (
              <div className="col-span-full rounded-2xl border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">
                Could not load banks. Please refresh.
              </div>
            )}

            {!banksListQuery.isLoading && !banksListQuery.isError && mainBanks.length === 0 && (
              <div className="col-span-full rounded-2xl border border-line bg-surface px-6 py-10 text-center text-ink-muted">
                No banks available for {stepLabel(step)} yet.
              </div>
            )}

            {mainBanks.map((bank) => (
              <ProviderCard
                key={bank.id}
                bank={bank}
                selected={bank.id === bankParam}
                onSelect={() => selectBank(bank.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProviderCard({
  bank,
  selected,
  onSelect,
}: {
  bank: MainBank;
  selected: boolean;
  onSelect: () => void;
}) {
  const locked = bank.isLocked;
  return (
    <button
      type="button"
      onClick={locked ? undefined : onSelect}
      disabled={locked}
      className={`group flex flex-col rounded-2xl border bg-surface p-6 text-left shadow-card transition-all duration-300 ${
        selected
          ? 'border-mp ring-1 ring-mp/40'
          : 'border-line hover:-translate-y-1 hover:border-mp/40 hover:shadow-pop'
      } ${locked ? 'cursor-not-allowed opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white shadow-card"
          style={{ background: providerGradient(bank.code) }}
        >
          {providerInitials(bank.name)}
        </span>
        {locked && <PremiumBadge />}
      </div>

      <h3 className="mt-4 text-lg font-extrabold tracking-tight text-ink">{bank.name}</h3>

      <div className="mt-auto flex items-center justify-between border-t border-line pt-4">
        <span className="text-sm font-semibold text-mp">
          {locked ? 'Subscribe to unlock' : 'View banks'}
        </span>
        {!locked && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4 text-mp transition-transform duration-300 group-hover:translate-x-1"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        )}
      </div>
    </button>
  );
}

function BankCard({ bank }: { bank: QuestionBankWithProgress }) {
  const total = Math.max(0, bank.totalQuestions);
  const used = Math.min(Math.max(0, bank.usedQuestions), total);
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;

  return (
    <div
      className={`group flex flex-col rounded-2xl border bg-surface p-6 shadow-card transition-all duration-300 ${
        bank.isLocked ? 'border-line opacity-75' : 'border-line hover:-translate-y-1 hover:border-mp/40 hover:shadow-pop'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-extrabold leading-snug tracking-tight text-ink">
          {bank.name}
        </h3>
        {bank.isLocked && <PremiumBadge />}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {bank.isBlockBank && (
          <span className="rounded-full bg-mp/10 px-2 py-0.5 text-[11px] font-semibold text-mp">
            Block Ã—{bank.blockSize}
          </span>
        )}
        <span className="text-xs font-semibold text-ink-muted">
          {total.toLocaleString()} questions
        </span>
      </div>

      {bank.description && (
        <p className="mt-3 line-clamp-2 text-sm text-ink-muted">{bank.description}</p>
      )}

      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-ink-muted">
            {used.toLocaleString()} / {total.toLocaleString()} used
          </span>
          <span className={pct >= 100 ? 'text-ok' : 'text-mp'}>{pct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-ok' : 'bg-mp'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
