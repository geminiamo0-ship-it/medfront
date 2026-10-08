import { Link, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPreviousTests } from '@/api/tests';
import { SectionLoader } from '@/components/PulseLoader';
import { type WorkspaceContext } from './WelcomePage';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PreviousTestsPage() {
  const { bankId, step } = useOutletContext<WorkspaceContext>();

  const testsQuery = useQuery({
    queryKey: ['previous-tests', step, bankId],
    queryFn: () => getPreviousTests(step, bankId),
  });
  const tests = testsQuery.data ?? [];

  return (
    <div>
      <h1 className="text-xl font-extrabold tracking-tight text-ink">Previous Tests</h1>

      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        {testsQuery.isLoading ? (
          <SectionLoader minHeight={260} label="Loading tests" />
        ) : testsQuery.isError ? (
          <div className="border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">Could not load tests. Please refresh.</div>
        ) : tests.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-ink-muted">
            No tests yet.{' '}
            <Link
              to={`/qbank/${bankId}/create-test?step=${step}`}
              className="font-semibold text-link hover:underline"
            >
              Create your first test
            </Link>
            .
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-3.5">Score</th>
                <th className="px-5 py-3.5">Name</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Mode</th>
                <th className="px-5 py-3.5"># Qs</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0 hover:bg-surface2/60">
                  <td className="px-5 py-3.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mp/10 text-xs font-extrabold text-mp">
                      {Math.round(Number(t.percentageScore))}%
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-ink">{t.title}</td>
                  <td className="px-5 py-3.5 text-ink-muted">{formatDate(t.completedAt ?? t.createdAt)}</td>
                  <td className="px-5 py-3.5 capitalize text-ink-muted">{t.type}</td>
                  <td className="px-5 py-3.5 text-ink-muted">{t.totalQuestions}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${
                        t.status === 'completed'
                          ? 'bg-ok/10 text-ok'
                          : t.status === 'suspended' || t.status === 'in_progress'
                            ? 'bg-warn/10 text-warn'
                            : 'bg-surface2 text-ink-muted'
                      }`}
                    >
                      {t.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      to={t.status === "completed" ? "/test/" + t.id + "/results" : "/test/" + t.id}
                      className="font-semibold text-link transition-colors hover:text-mp"
                    >
                      {t.status === 'completed' ? 'Results' : 'Open'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
