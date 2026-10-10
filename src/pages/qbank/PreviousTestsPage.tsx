import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPreviousTestsSummary, repeatSavedTest, deleteSavedTest, type PreviousTestSummaryItem } from '@/api/tests';
import { SectionLoader } from '@/components/PulseLoader';
import { type WorkspaceContext } from './WelcomePage';
import { invalidateQbankProgressQueries } from '@/lib/qbankProgressQueries';
import PreviousTestActions from './PreviousTestActions';

/** Dates are consistently the test creation date, rendered in the learner's local timezone. */
function formatCreatedDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function displayScore(test: PreviousTestSummaryItem): string {
  if (test.status !== 'completed') return '—';
  const raw = test.percentageScore;
  if (typeof raw !== 'string' && typeof raw !== 'number') return '—';
  if (String(raw).trim() === '') return '—';
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value.toFixed(1) + '%' : '—';
}

function displayStatus(status: string): string {
  if (status === 'completed') return 'Completed';
  if (status === 'suspended') return 'Suspended';
  if (status === 'in_progress') return 'In Progress';
  return 'Unavailable';
}

function displayMode(type: string): string {
  return type === 'tutor' ? 'Tutor' : type === 'timed' ? 'Timed' : '—';
}

/** Server alone resolves Custom vs legacy All and preserved provenance. */
function displayPool(test: PreviousTestSummaryItem): string {
  return test.questionPoolLabel?.trim() || '—';
}

function TestName({ test }: { test: PreviousTestSummaryItem }) {
  const [expanded, setExpanded] = useState(false);
  const name = test.title?.trim() || 'Test #' + test.id;
  const long = name.length > 42;
  const systems = test.selectedSystemNames ?? [];
  const topics = test.selectedTopicNames ?? [];
  const hasDetails = systems.length > 0 || topics.length > 0;
  return (
    <div className="min-w-0">
      <span className="block truncate font-semibold text-ink" title={name}>{name}</span>
      {(long || hasDetails) && (
        <>
          <button
            type="button"
            className="mt-1 min-h-9 rounded px-1 text-xs font-semibold text-link hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
            aria-expanded={expanded}
            aria-label={(expanded ? 'Hide' : 'Show') + ' full name of ' + name}
            onClick={() => setExpanded((previous) => !previous)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setExpanded(false);
            }}
          >
            {expanded ? 'Hide details' : (long ? 'Full name' : 'Details')}
          </button>
          {expanded && (
            <div className="mt-1 max-w-full space-y-2 break-words rounded-lg border border-line bg-surface2 p-2 text-xs font-normal leading-relaxed text-ink-soft">
              {long && <p>{name}</p>}
              {systems.length > 0 && <p><strong>Systems:</strong> {systems.join(', ')}</p>}
              {topics.length > 0 && <p><strong>Topics:</strong> {topics.join(', ')}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PreviousTestsPage() {
  const { bankId, step } = useOutletContext<WorkspaceContext>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [repeatingId, setRepeatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState('');
  const [repeatFeedback, setRepeatFeedback] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copyFeedback, setCopyFeedback] = useState('');

  const testsQuery = useQuery({
    queryKey: ['previous-tests-summary', step, bankId, page],
    queryFn: () => getPreviousTestsSummary(step, bankId, page),
  });
  const tests = testsQuery.data?.items ?? [];
  const hasMore = testsQuery.data?.hasMore ?? false;

  async function repeatTest(id: number) {
    if (repeatingId !== null) return;
    setRepeatingId(id);
    setRepeatFeedback('');
    try {
      const result = await repeatSavedTest(id);
      await invalidateQbankProgressQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ['previous-tests-summary'] });
      navigate('/test/' + result.id);
    } catch (error) {
      // A POST could have committed before the connection dropped. Never auto-retry.
      setRepeatFeedback(
        (error instanceof Error ? error.message + '. ' : '') +
        'If the connection failed, check Previous Tests before repeating again.',
      );
    } finally {
      setRepeatingId(null);
    }
  }

  async function deleteTest(id: number) {
    if (deletingId !== null || repeatingId !== null) return;
    setDeletingId(id);
    setDeleteFeedback('');
    try {
      await deleteSavedTest(id);
      await invalidateQbankProgressQueries(queryClient);
      await queryClient.invalidateQueries({ queryKey: ['previous-tests-summary'] });
      setDeleteFeedback('Test deleted. Other saved attempts and their question progress remain unchanged.');
    } catch (error) {
      setDeleteFeedback((error instanceof Error ? error.message : 'Delete failed') + '. Refresh to confirm saved tests before trying again.');
    } finally {
      setDeletingId(null);
    }
  }

  async function copyTestId(id: number) {
    setCopiedId(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(String(id));
      setCopiedId(id);
      setCopyFeedback('Internal Test ID #' + id + ' copied. This is not a UWorld question ID.');
    } catch {
      setCopyFeedback('Copy unavailable. Internal Test ID: ' + id + ' (select this ID to copy manually).');
    }
  }

  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Previous Tests</h1>
          <p className="mt-1 text-sm text-ink-muted">Your saved blocks, results, and sessions.</p>
        </div>
        <Link
          to={'/qbank/' + bankId + '/create-test?step=' + step}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-link hover:bg-surface2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
        >
          Create Test
        </Link>
      </div>

      {copyFeedback && <p role="status" aria-live="polite" className="mt-3 break-words text-xs text-ink-muted">{copyFeedback}</p>}
      {deleteFeedback && <p role="status" aria-live="polite" className="mt-3 text-sm text-ink-muted">{deleteFeedback}</p>}
      {repeatFeedback && <p role="alert" className="mt-3 break-words text-sm text-bad">{repeatFeedback}</p>}

      <div className="mt-5 min-w-0 rounded-2xl border border-line bg-surface shadow-card">
        {testsQuery.isLoading ? (
          <SectionLoader minHeight={260} label="Loading previous tests" />
        ) : testsQuery.isError ? (
          <div className="px-5 py-8 text-sm">
            <p className="text-bad">Could not load previous tests. Your saved exams have not been changed.</p>
            <button type="button" onClick={() => void testsQuery.refetch()} className="mt-3 min-h-11 rounded-lg border border-line px-4 font-semibold text-link hover:bg-surface2">Try again</button>
          </div>
        ) : tests.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-ink-muted">
            {page > 1 ? 'No tests on this page.' : 'No tests yet.'} <Link to={'/qbank/' + bankId + '/create-test?step=' + step} className="font-semibold text-link hover:underline">Create your first test</Link>.
          </div>
        ) : (
          <>
            <div className="hidden xl:block">
              <table className="w-full table-fixed text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs font-semibold text-ink-muted">
                    <th scope="col" className="w-[8%] px-3 py-4">Score</th>
                    <th scope="col" className="w-[25%] px-3 py-4">Test name</th>
                    <th scope="col" className="w-[12%] px-3 py-4">Created</th>
                    <th scope="col" className="w-[8%] px-3 py-4">Mode</th>
                    <th scope="col" className="w-[11%] px-3 py-4">Question pool</th>
                    <th scope="col" className="w-[8%] px-3 py-4">Qs</th>
                    <th scope="col" className="w-[12%] px-3 py-4">Status</th>
                    <th scope="col" className="w-[16%] px-3 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((test, index) => (
                    <tr key={test.id} className="border-b border-line last:border-b-0 hover:bg-surface2/40">
                      <td className="px-3 py-3.5 font-bold tabular-nums text-ink">{displayScore(test)}</td>
                      <th scope="row" className="min-w-0 px-3 py-3.5 text-left font-normal"><TestName test={test} /></th>
                      <td className="px-3 py-3.5 text-ink-muted"><time dateTime={test.createdAt}>{formatCreatedDate(test.createdAt)}</time></td>
                      <td className="px-3 py-3.5 text-ink-muted">{displayMode(test.type)}</td>
                      <td className="px-3 py-3.5 text-ink-muted">{displayPool(test)}</td>
                      <td className="px-3 py-3.5 tabular-nums text-ink-muted">{test.totalQuestions}</td>
                      <td className="px-3 py-3.5 font-medium text-ink-soft">{displayStatus(test.status)}</td>
                      <td className="px-3 py-3.5"><PreviousTestActions test={test} copiedId={copiedId} onCopy={(id) => void copyTestId(id)} onRepeat={(id) => void repeatTest(id)} onDelete={(id) => void deleteTest(id)} repeatingId={repeatingId} deletingId={deletingId} menuAbove={index >= tests.length - 2} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid min-w-0 gap-0 xl:hidden">
              {tests.map((test, index) => (
                <article key={test.id} className="min-w-0 border-b border-line p-4 last:border-b-0 sm:p-5">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1"><TestName test={test} /></div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-extrabold tabular-nums text-ink">{displayScore(test)}</p>
                      <p className="text-xs font-medium text-ink-muted">{displayStatus(test.status)}</p>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-4">
                    <div><dt className="text-ink-faint">Created</dt><dd className="mt-1 text-ink-soft"><time dateTime={test.createdAt}>{formatCreatedDate(test.createdAt)}</time></dd></div>
                    <div><dt className="text-ink-faint">Mode</dt><dd className="mt-1 text-ink-soft">{displayMode(test.type)}</dd></div>
                    <div><dt className="text-ink-faint">Question pool</dt><dd className="mt-1 text-ink-soft">{displayPool(test)}</dd></div>
                    <div><dt className="text-ink-faint">Questions</dt><dd className="mt-1 tabular-nums text-ink-soft">{test.totalQuestions}</dd></div>
                  </dl>
                  <div className="mt-4"><PreviousTestActions test={test} copiedId={copiedId} onCopy={(id) => void copyTestId(id)} onRepeat={(id) => void repeatTest(id)} onDelete={(id) => void deleteTest(id)} repeatingId={repeatingId} deletingId={deletingId} menuAbove={index >= tests.length - 2} /></div>
                </article>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
              <p className="text-xs text-ink-faint">
                Created dates use your timezone. Old tests with unknown pool provenance show —.
              </p>
              <div className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
                <button type="button" disabled={page === 1 || testsQuery.isFetching}
                  className="min-h-11 rounded-lg border border-line px-3 disabled:opacity-40"
                  onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
                <span>Page {page}</span>
                <button type="button" disabled={!hasMore || testsQuery.isFetching}
                  className="min-h-11 rounded-lg border border-line px-3 disabled:opacity-40"
                  onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
