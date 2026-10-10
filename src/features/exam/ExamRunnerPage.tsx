import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PulseLoader } from '@/components/PulseLoader';
import { resolveExamTheme } from './registry';
import { useExamRunner } from './core/useExamRunner';
import { AmbossTheme } from './themes/amboss/AmbossTheme';
import { UWorldTheme } from './themes/uworld/UWorldTheme';

export function ExamRunnerPage() {
  const { testId } = useParams();
  const [searchParams] = useSearchParams();
  const originalReview = searchParams.get('review') === 'original';
  const controller = useExamRunner(testId, originalReview);

  if (controller.testQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <PulseLoader size={64} label="Loading exam" />
      </div>
    );
  }

  if (controller.testQuery.isError || !controller.test || !controller.currentQuestion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
          <h1 className="text-xl font-extrabold text-ink">Unable to open this test</h1>
          <p className="mt-3 text-sm text-ink-muted">The exam could not be loaded. Try again or return to your dashboard.</p>
          <Link to="/dashboard" className="mt-6 inline-block rounded-xl bg-mp px-5 py-3 text-sm font-bold text-white">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const theme = resolveExamTheme(controller.test);
  if (theme === 'amboss') {
    return (
      <>
        {controller.test.reviewMode === 'original' && (
          <div role="status" className="sticky top-0 z-50 border-b border-line bg-surface px-4 py-2 text-center text-sm font-semibold text-ink shadow-card">
            Reviewing your first recorded answer for each question (across all saved tests)
          </div>
        )}
        <AmbossTheme controller={controller} />
      </>
    );
  }

  if (theme === 'uworld') {
    return (
      <>
        {controller.test.reviewMode === 'original' ? (
          <div role="status" className="sticky top-0 z-50 border-b border-line bg-surface px-4 py-2 text-center text-sm font-semibold text-ink">Reviewing your first recorded answer for each question</div>
        ) : null}
        <UWorldTheme controller={controller} />
      </>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="max-w-xl rounded-2xl border border-line bg-surface p-10 text-center shadow-card">
        <h1 className="text-xl font-extrabold text-ink">{controller.test.title}</h1>
        <p className="mt-3 text-sm text-ink-muted">
          This test is ready, but its dedicated visual theme has not been implemented yet.
        </p>
        <Link to="/dashboard" className="mt-6 inline-block rounded-xl bg-mp px-5 py-3 text-sm font-bold text-white">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
