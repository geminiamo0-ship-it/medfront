import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { SectionLoader } from '@/components/PulseLoader';
import { getTestResults } from './api';
import {
  DIFFICULTY_ORDER,
  DifficultyBreakdown,
  ResultsOverview,
  StudyRecommendations,
  SummaryMetrics,
} from './ResultsVisuals';
import './results.css';

const nonNegative = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

export default function TestResultsPage() {
  const { testId: id } = useParams();
  const testId = Number(id);
  const validId = Number.isSafeInteger(testId) && testId > 0;
  const report = useQuery({
    queryKey: ['test-results', testId],
    queryFn: () => getTestResults(testId),
    enabled: validId,
    staleTime: 60_000,
    retry: 1,
  });

  const test = report.data?.test;
  const details = report.data?.analytics?.sessionBreakdown;
  const bankId = test?.filters?.questionBankIds?.[0] ?? test?.blockBankId;
  const backUrl = bankId
    ? '/qbank/' + bankId + '/previous-tests?step=' + (test?.step ?? 1)
    : '/qbank';

  // All source numbers remain from the authenticated test-results contract.
  // A single formatted value drives both the headline and the donut center.
  const total = nonNegative(test?.totalQuestions);
  const answered = nonNegative(test?.answeredQuestions);
  const correct = nonNegative(test?.correctAnswers);
  const incorrect = details ? nonNegative(details.incorrectQuestions) : Math.max(0, answered - correct);
  const omitted = details ? nonNegative(details.omittedQuestions) : Math.max(0, total - answered);
  const elapsed = nonNegative(test?.timeSpentSeconds);
  const average = nonNegative(
    report.data?.analytics?.overall?.averageTimePerQuestion ?? (answered ? elapsed / answered : 0),
  );
  const accuracy = (total ? correct / total * 100 : 0).toFixed(1) + '%';
  const tiers = DIFFICULTY_ORDER
    .map(key => details?.byDifficultyTier.find(item => item.key === key))
    .filter((item): item is NonNullable<typeof item> => !!item && item.total > 0);
  const topics = details?.studyRecommendations.slice(0, 6) ?? [];

  return (
    <main className="mp-results" data-testid="test-results-page" dir="ltr">
      <div className="mp-results__shell">
        <Link to={backUrl} className="mp-results__breadcrumb">← Previous Tests</Link>
        <header className="mp-results__header">
          <div>
            <p className="mp-results__kicker">MEDPARK / SESSION RESULTS</p>
            <h1 className="mp-results__heading">Session Performance</h1>
            {test && <p className="mp-results__session-meta">{test.title} · {test.type} mode</p>}
          </div>
          {test?.status === 'completed' && (
            <span className="mp-results__completed" data-testid="results-completed-count">
              {answered} of {total} answered
            </span>
          )}
        </header>

        {!validId ? (
          <section className="mp-results__state" role="alert">Invalid test ID.</section>
        ) : report.isLoading ? (
          <SectionLoader minHeight={240} label="Loading session results" />
        ) : report.isError ? (
          <section className="mp-results__state" role="alert">
            <h2 className="mp-results__state-title">Could not load session results</h2>
            <p className="mp-results__state-copy">
              {report.error instanceof ApiError && report.error.status === 423
                ? 'Block results are locked until the required blocks are completed.'
                : report.error instanceof ApiError && [401, 403, 404].includes(report.error.status)
                  ? 'Results are unavailable for this account or session.'
                  : 'Check your connection and try again.'}
            </p>
            <button type="button" className="mp-results__action" onClick={() => void report.refetch()}>
              Try again
            </button>
          </section>
        ) : !test || test.status !== 'completed' ? (
          <section className="mp-results__state">
            <h2 className="mp-results__state-title">This test is not completed yet.</h2>
            <p className="mp-results__state-copy">Finish the block to view final results.</p>
            <Link to={'/test/' + testId} className="mp-results__action">Return to exam</Link>
          </section>
        ) : (
          <>
            <SummaryMetrics
              accuracy={accuracy} correct={correct} total={total}
              answered={answered} average={average} elapsed={elapsed}
            />
            <div className="mp-results__panels">
              <ResultsOverview
                accuracy={accuracy} correct={correct}
                incorrect={incorrect} omitted={omitted} total={total}
              />
              <StudyRecommendations
                topics={topics} available={!!details} omitted={omitted}
              />
            </div>
            <DifficultyBreakdown tiers={tiers} available={!!details} />
            <nav className="mp-results__actions" aria-label="Session results actions">
              <Link to={backUrl} className="mp-results__action">Previous Tests</Link>
              <Link to={'/test/' + testId} className="mp-results__action mp-results__action--primary">
                Review Questions
              </Link>
            </nav>
          </>
        )}
      </div>
    </main>
  );
}
