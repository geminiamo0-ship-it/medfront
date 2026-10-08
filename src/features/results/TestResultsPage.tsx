import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { SectionLoader } from '@/components/PulseLoader';
import { getTestResults, type DifficultyKey } from './api';

const labels: Record<DifficultyKey, string> = {
  very_easy: 'Very Easy', easy: 'Easy', medium: 'Medium',
  hard: 'Hard', very_hard: 'Very Hard', unclassified: 'Unclassified',
};
const order: DifficultyKey[] = ['very_easy', 'easy', 'medium', 'hard', 'very_hard', 'unclassified'];
const number = (value: unknown) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
const duration = (value: unknown) => {
  const seconds = Math.floor(number(value));
  if (seconds >= 3600) return Math.floor(seconds / 3600) + 'h ' + String(Math.floor((seconds % 3600) / 60)).padStart(2, '0') + 'm';
  if (seconds >= 60) return Math.floor(seconds / 60) + 'm ' + String(seconds % 60).padStart(2, '0') + 's';
  return seconds + 's';
};
function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="text-2xl font-extrabold tabular-nums text-ink">{value}</div>
      <div className="mt-1 text-xs font-semibold text-ink-muted">{title}</div>
    </div>
  );
}
function ScoreRing({ correct, incorrect, omitted, total }: {
  correct: number; incorrect: number; omitted: number; total: number;
}) {
  const circleLength = 2 * Math.PI * 53;
  const c = circleLength * correct / Math.max(total, 1);
  const i = circleLength * incorrect / Math.max(total, 1);
  const o = circleLength * omitted / Math.max(total, 1);
  const percent = total ? Math.round(correct / total * 100) : 0;
  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 160 160" width="182" height="182" role="img" aria-label={'Accuracy ' + percent + ' percent'}>
        <circle cx="80" cy="80" r="53" stroke="#E5EBEE" strokeWidth="13" fill="none" />
        <g transform="rotate(-90 80 80)" strokeWidth="13" fill="none">
          <circle cx="80" cy="80" r="53" stroke="#39B68C" strokeDasharray={c + ' ' + circleLength} />
          <circle cx="80" cy="80" r="53" stroke="#E66D72" strokeDasharray={i + ' ' + circleLength} strokeDashoffset={-c} />
          <circle cx="80" cy="80" r="53" stroke="#9AA6B2" strokeDasharray={o + ' ' + circleLength} strokeDashoffset={-(c + i)} />
        </g>
        <text x="80" y="76" textAnchor="middle" fontWeight="700" fontSize="27" fill="#1A1A1B">{percent}%</text>
        <text x="80" y="96" textAnchor="middle" fontSize="11" fill="#576F76">ACCURACY</text>
      </svg>
      <div className="grid w-full grid-cols-3 gap-2 text-center text-xs">
        <div><span className="font-bold text-ok">{correct}</span><span className="block text-ink-muted">Correct</span></div>
        <div><span className="font-bold text-bad">{incorrect}</span><span className="block text-ink-muted">Incorrect</span></div>
        <div><span className="font-bold text-ink-muted">{omitted}</span><span className="block text-ink-muted">Omitted</span></div>
      </div>
    </div>
  );
}

export default function TestResultsPage() {
  const { testId: id } = useParams();
  const testId = Number(id);
  const validId = Number.isSafeInteger(testId) && testId > 0;
  const report = useQuery({
    queryKey: ['test-results', testId],
    queryFn: () => getTestResults(testId),
    enabled: validId, staleTime: 60_000, retry: 1,
  });
  const test = report.data?.test;
  const details = report.data?.analytics?.sessionBreakdown;
  const bankId = test?.filters?.questionBankIds?.[0] ?? test?.blockBankId;
  const backUrl = bankId
    ? '/qbank/' + bankId + '/previous-tests?step=' + (test?.step ?? 1)
    : '/qbank';
  const total = number(test?.totalQuestions);
  const answered = number(test?.answeredQuestions);
  const correct = number(test?.correctAnswers);
  const incorrect = details ? number(details.incorrectQuestions) : Math.max(0, answered - correct);
  const omitted = details ? number(details.omittedQuestions) : Math.max(0, total - answered);
  const elapsed = number(test?.timeSpentSeconds);
  const average = report.data?.analytics?.overall?.averageTimePerQuestion ?? (answered ? elapsed / answered : 0);
  const tiers = order.map(key => details?.byDifficultyTier.find(d => d.key === key))
    .filter((item): item is NonNullable<typeof item> => !!item && item.total > 0);
  const topics = details?.studyRecommendations.slice(0, 6) ?? [];

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-ink sm:px-6" data-testid="test-results-page">
      <div className="mx-auto max-w-6xl">
        <Link to={backUrl} className="text-sm font-semibold text-link hover:underline">← Previous Tests</Link>
        <div className="mb-6 mt-5">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">MedPark · Session Results</p>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Session Performance</h1>
          {test && <p className="mt-2 text-sm text-ink-muted">{test.title} · {test.type} mode</p>}
        </div>
        {!validId ? <p role="alert">Invalid test ID.</p>
        : report.isLoading ? <SectionLoader minHeight={260} label="Loading session results" />
        : report.isError ? (
          <section className="rounded-xl border border-line bg-surface p-6" role="alert">
            <h2 className="font-bold">Could not load session results</h2>
            <p className="mt-2 text-sm text-ink-muted">
              {report.error instanceof ApiError && report.error.status === 423
                ? 'Block results are locked until the required blocks are completed.'
                : report.error instanceof ApiError && [401, 403, 404].includes(report.error.status)
                  ? 'Results are unavailable for this account or session.'
                  : 'Check your connection and try again.'}
            </p>
            <button type="button" onClick={() => void report.refetch()} className="mt-4 rounded-lg border border-line px-4 py-2 text-sm font-semibold">Try again</button>
          </section>
        ) : !test || test.status !== 'completed' ? (
          <section className="rounded-xl border border-line bg-surface p-6">
            <h2 className="font-bold">This test is not completed yet.</h2>
            <p className="mt-2 text-sm text-ink-muted">Finish the block to view final results.</p>
            <Link to={'/test/' + testId} className="mt-4 inline-block text-sm font-semibold text-link hover:underline">Return to exam</Link>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Metric title="Accuracy" value={(total ? correct / total * 100 : 0).toFixed(1) + '%'} />
              <Metric title="Completed Questions" value={answered + '/' + total} />
              <Metric title="Correct" value={String(correct)} />
              <Metric title="Incorrect" value={String(incorrect)} />
              <Metric title="Omitted" value={String(omitted)} />
              <Metric title="Total Time Spent" value={duration(elapsed)} />
              <Metric title="Avg. / Answered Q" value={answered ? duration(average) : '—'} />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby="results-score-heading">
                <h2 id="results-score-heading" className="text-lg font-bold">Your Results</h2>
                <div className="mt-5"><ScoreRing correct={correct} incorrect={incorrect} omitted={omitted} total={total} /></div>
              </section>
              <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby="results-topics-heading">
                <h2 id="results-topics-heading" className="text-lg font-bold">Study Recommendations</h2>
                <p className="mt-1 text-xs text-ink-muted">Topics with incorrect answers in this session</p>
                {!details ? <p className="mt-7 text-sm text-ink-muted">Topic insights are not available yet.</p>
                : topics.length === 0 ? <p className="mt-7 text-sm text-ink-muted">No topics with incorrect answers.</p>
                : <div className="mt-5 space-y-4">{topics.map(topic => (
                  <div key={topic.topicId}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-semibold">{topic.name}</span>
                      <span className="shrink-0 tabular-nums text-ink-muted">{topic.correct}/{topic.total} correct</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface2">
                      <div className="h-full rounded-full bg-ok" style={{ width: (topic.total ? topic.correct / topic.total * 100 : 0) + '%' }} />
                    </div>
                  </div>
                ))}</div>}
                <p className="mt-6 text-xs text-ink-faint">This describes the session, not your overall ability.</p>
              </section>
            </div>
            <section className="mt-5 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby="results-difficulty-heading">
              <h2 id="results-difficulty-heading" className="text-lg font-bold">Performance by Difficulty</h2>
              {!details ? <p className="mt-5 text-sm text-ink-muted">Difficulty details are not available yet.</p>
              : tiers.length === 0 ? <p className="mt-5 text-sm text-ink-muted">No classified questions.</p>
              : <div className="mt-5 space-y-4">{tiers.map(item => (
                <div key={item.key} className="grid grid-cols-[85px_1fr_90px] items-center gap-3 sm:grid-cols-[120px_1fr_110px]">
                  <span className="text-sm font-semibold">{labels[item.key]}</span>
                  <div role="meter" aria-label={labels[item.key] + ' correct answers'}
                    aria-valuemin={0} aria-valuemax={item.total} aria-valuenow={item.correct}
                    className="h-2 overflow-hidden rounded-full bg-surface2">
                    <div className="h-full rounded-full bg-ok" style={{ width: (item.total ? item.correct / item.total * 100 : 0) + '%' }} />
                  </div>
                  <span className="text-right text-xs font-semibold tabular-nums text-ink-muted">{item.correct}/{item.total} correct</span>
                </div>
              ))}</div>}
            </section>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Link to={backUrl} className="rounded-xl border border-line bg-surface px-5 py-3 text-center text-sm font-bold hover:bg-surface2">Previous Tests</Link>
              <Link to={'/test/' + testId} className="rounded-xl bg-ink px-5 py-3 text-center text-sm font-bold text-white">Review Questions</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
