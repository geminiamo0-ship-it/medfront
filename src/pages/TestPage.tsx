import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { PulseLoader } from '@/components/PulseLoader';

export default function TestPage() {
  const { testId } = useParams();

  const testQuery = useQuery({
    queryKey: ['test', testId],
    queryFn: () => api.get<{ id: number; title: string; status: string; totalQuestions: number }>(`/tests/${testId}`),
  });
  const test = testQuery.data as { title?: string; status?: string; totalQuestions?: number } | undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="rounded-2xl border border-line bg-surface p-10 shadow-card">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-mp/10">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-mp" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
          </svg>
        </span>
        <h1 className="mt-5 text-xl font-extrabold tracking-tight text-ink">
          {test?.title ?? `Test #${testId}`}
        </h1>
        <p className="mt-2 flex min-h-20 items-center justify-center text-sm text-ink-muted">
          {test ? (
            `${test.status?.replace('_', ' ')} · ${test.totalQuestions} questions`
          ) : (
            <PulseLoader size={56} label="Loading test" />
          )}
        </p>
        <p className="mt-6 rounded-xl bg-mp/5 px-4 py-3 text-sm text-ink-soft">
          The question runner is coming in the next round. Your test has been created and saved.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-block rounded-xl bg-mp px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-mp-hover"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
