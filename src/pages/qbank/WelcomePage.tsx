import { useOutletContext } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getQbankStatistics } from '@/api/tests';
import { ApiError } from '@/api/client';
import { SectionLoader } from '@/components/PulseLoader';
import type { MainBank } from '@/api/tests';

export interface WorkspaceContext {
  bank: MainBank | null;
  step: number;
  bankId: number;
}

export function useWorkspace() {
  return useOutletContext<WorkspaceContext>();
}

function Donut({
  pct,
  label,
  color,
  track = '#F0F2F5',
}: {
  pct: number;
  label: string;
  color: string;
  track?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = 62;
  const c = 2 * Math.PI * r;
  const arc = (clamped / 100) * c;

  return (
    <div className="relative h-40 w-40">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke={track} strokeWidth="14" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${arc} ${c - arc}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-ink">{clamped}%</span>
        <span className="text-xs font-semibold text-ink-muted">{label}</span>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2.5 last:border-0">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="min-w-8 rounded-full bg-surface2 px-2.5 py-0.5 text-center text-xs font-bold text-ink">
        {value}
      </span>
    </div>
  );
}

/** Bell curve with "you" and "median" markers, like the UWorld percentile chart. */
function BellCurve({ youPct, medianPct }: { youPct: number; medianPct: number }) {
  const W = 560;
  const H = 170;
  const mid = W / 2;
  const sigma = W / 7;
  const curve = Array.from({ length: 121 }, (_, i) => {
    const x = (i / 120) * W;
    const y = H - 18 - Math.exp(-((x - mid) ** 2) / (2 * sigma ** 2)) * (H - 40);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const markerX = (pct: number) => Math.max(12, Math.min(W - 12, (pct / 100) * W));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <path d={curve} fill="none" stroke="#CBD5E1" strokeWidth="1.5" />
      {/* median marker */}
      <line x1={markerX(medianPct)} y1={H - 18} x2={markerX(medianPct)} y2={18} stroke="#0079D3" strokeWidth="2" />
      <text x={markerX(medianPct)} y={14} textAnchor="middle" className="fill-link text-[11px] font-semibold">
        {medianPct}th
      </text>
      {/* you marker */}
      <circle cx={markerX(youPct)} cy={H - 34} r="6" fill="none" stroke="#46D160" strokeWidth="2.5" />
      <text x={markerX(youPct)} y={H - 42} textAnchor="middle" className="fill-ok text-[11px] font-semibold">
        {youPct}th
      </text>
      <line x1="0" y1={H - 18} x2={W} y2={H - 18} stroke="#E5EBEE" strokeWidth="1" />
    </svg>
  );
}

export default function WelcomePage() {
  const { bank, step, bankId } = useWorkspace();

  const statsQuery = useQuery({
    queryKey: ['qbank-statistics', bank?.code, step],
    queryFn: () => getQbankStatistics(bank!.code, step),
    enabled: bank != null,
  });

  const stats = statsQuery.data?.data;
  const scorePct = stats ? Number(stats.score.percentage) : 0;
  const usagePct = stats ? Number(stats.usage.percentage) : 0;

  // Block banks (NBME forms, Self Assessments) return HTTP 423 until every
  // block is completed — show a friendly locked state instead of an error.
  const statsError = statsQuery.error;
  const locked =
    statsError instanceof ApiError &&
    (statsError.status === 423 || /locked/i.test(statsError.message ?? ''));

  if (statsQuery.isLoading) {
    return <SectionLoader minHeight={420} label="Loading statistics" />;
  }

  if (statsQuery.isError && locked) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-10 text-center shadow-card">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warn/10">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-warn" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <h2 className="mt-4 text-lg font-extrabold text-ink">Results are locked</h2>
        <p className="mt-2 text-sm text-ink-muted">
          {statsError instanceof ApiError ? statsError.message : 'Results are locked.'} Finish this
          bank's blocks to unlock your statistics.
        </p>
        <Link
          to="create-test"
          className="mt-6 inline-block rounded-xl bg-mp px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-mp-hover"
        >
          Continue with a new test
        </Link>
      </div>
    );
  }

  if (statsQuery.isError || !stats) {
    return (
      <div className="rounded-2xl border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">
        Could not load statistics. Please refresh.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Statistics</h1>
        <span className="text-xs font-semibold text-ink-faint">Bank #{bankId}</span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Score */}
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <div className="flex items-start gap-8">
            <Donut pct={scorePct} label="Correct" color="#46D160" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-ink">Your Score</h2>
              <div className="mt-2">
                <StatRow label="Total Correct" value={stats.score.totalCorrect} />
                <StatRow label="Total Incorrect" value={stats.score.totalIncorrect} />
                <StatRow label="Total Omitted" value={stats.score.totalOmitted} />
              </div>
            </div>
          </div>
        </section>

        {/* Answer changes */}
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h2 className="text-sm font-bold text-ink">Answer Changes</h2>
          <div className="mt-2">
            <StatRow label="Correct to Incorrect" value={stats.answerChanges.correctToIncorrect} />
            <StatRow label="Incorrect to Correct" value={stats.answerChanges.incorrectToCorrect} />
            <StatRow label="Incorrect to Incorrect" value={stats.answerChanges.incorrectToIncorrect} />
          </div>
        </section>

        {/* Usage */}
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <div className="flex items-start gap-8">
            <Donut pct={usagePct} label="Used" color="#FF4500" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-ink">QBank Usage</h2>
              <div className="mt-2">
                <StatRow label="Used Questions" value={stats.usage.usedQuestions.toLocaleString()} />
                <StatRow label="Unused Questions" value={stats.usage.unusedQuestions.toLocaleString()} />
                <StatRow label="Total Questions" value={stats.usage.totalQuestions.toLocaleString()} />
              </div>
            </div>
          </div>
        </section>

        {/* Test counts */}
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h2 className="text-sm font-bold text-ink">Test Count</h2>
          <div className="mt-2">
            <StatRow label="Tests Created" value={stats.testCount.created} />
            <StatRow label="Tests Completed" value={stats.testCount.completed} />
            <StatRow label="Suspended Tests" value={stats.testCount.suspended} />
          </div>
        </section>

        {/* Percentile */}
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-card lg:col-span-2">
          <h2 className="text-sm font-bold text-ink">Percentile Rank</h2>
          <div className="mt-3 grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
            <BellCurve youPct={stats.percentileRank} medianPct={stats.medianPercentile} />
            <div>
              <StatRow label="Your Score (rank)" value={`${scorePct}%`} />
              <StatRow label="Median Score" value={`${stats.medianScore}%`} />
              <StatRow label="Your Average Time Spent (sec)" value={stats.yourAverageTimeSpent} />
              <StatRow label="Others' Average Time Spent (sec)" value={stats.othersAverageTimeSpent} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
