import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  createTest,
  getQuestionCounts,
  getSubjects,
  getSystemsWithTopics,
  type QuestionCounts,
} from '@/api/tests';
import type { SubjectCount, SystemWithTopics } from '@/api/tests';
import { type WorkspaceContext } from './WelcomePage';

const MODES: Array<{ key: keyof QuestionCounts; label: string }> = [
  { key: 'unused', label: 'Unused' },
  { key: 'incorrect', label: 'Incorrect' },
  { key: 'marked', label: 'Marked' },
  { key: 'all', label: 'All' },
];

export default function CreateTestPage() {
  const { bank, step, bankId } = useOutletContext<WorkspaceContext>();
  const navigate = useNavigate();
  const [timed, setTimed] = useState(false);
  const [mode, setMode] = useState<keyof QuestionCounts>('unused');
  const [subjectIds, setSubjectIds] = useState<number[]>([]);
  const [systemIds, setSystemIds] = useState<number[]>([]);
  const [numQuestions, setNumQuestions] = useState(40);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      questionBankIds: [bankId],
      ...(subjectIds.length > 0 ? { subjectIds } : {}),
      ...(systemIds.length > 0 ? { systemIds } : {}),
    }),
    [bankId, subjectIds, systemIds],
  );

  const countsQuery = useQuery({
    queryKey: ['test-counts', step, filters, mode],
    queryFn: () => getQuestionCounts(step, filters),
  });
  const counts = countsQuery.data;

  const subjectsQuery = useQuery({
    queryKey: ['test-subjects', step, bankId],
    queryFn: () => getSubjects(step, [bankId]),
  });
  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);
  const subjectColumns = useMemo(() => {
    const cols: SubjectCount[][] = [[], []];
    subjects.forEach((s) => cols[s.columnIndex === 1 ? 1 : 0].push(s));
    return cols;
  }, [subjects]);

  const systemsQuery = useQuery({
    queryKey: ['test-systems', step, filters],
    queryFn: () => getSystemsWithTopics(step, filters),
  });
  const systems = (systemsQuery.data ?? []) as SystemWithTopics[];

  function toggle(list: number[], id: number, set: (v: number[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await createTest({
        title: `${bank?.name ?? 'Bank'} — ${mode}`,
        type: timed ? 'timed' : 'tutor',
        mode,
        step,
        totalQuestions: Math.max(1, Math.min(200, numQuestions)),
        filters,
      });
      const testId = (res as { id?: number }).id ?? null;
      if (testId) navigate(`/test/${testId}`);
      else setError('Test created but no ID returned.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create test.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-extrabold tracking-tight text-ink">Create Test</h1>

      {error && (
        <div className="mt-4 rounded-2xl border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">{error}</div>
      )}

      {/* Test Mode */}
      <section className="mt-5 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h2 className="text-sm font-bold text-ink">Test Mode</h2>
        <div className="mt-4 flex items-center gap-6">
          <ModeToggle active={!timed} label="Tutor" onClick={() => setTimed(false)} />
          <ModeToggle active={timed} label="Timed" onClick={() => setTimed(true)} />
        </div>
      </section>

      {/* Question Mode */}
      <section className="mt-5 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h2 className="text-sm font-bold text-ink">Question Mode</h2>
        <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
          {MODES.map((m) => (
            <label key={m.key} className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
              <input
                type="radio"
                name="mode"
                checked={mode === m.key}
                onChange={() => setMode(m.key)}
                className="h-4 w-4 accent-mp"
              />
              <span className={mode === m.key ? 'font-bold text-ink' : ''}>{m.label}</span>
              <span className="rounded-full bg-mp/10 px-2 py-0.5 text-[11px] font-bold text-mp">
                {counts?.[m.key] ?? '—'}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Subjects */}
      <section className="mt-5 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h2 className="text-sm font-bold text-ink">
          Subjects {subjectIds.length > 0 && <span className="text-mp">({subjectIds.length} selected)</span>}
        </h2>
        {subjectsQuery.isLoading ? (
          <div className="mt-4 h-32 animate-pulse rounded-xl bg-surface2" />
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-x-12 sm:grid-cols-2">
            {subjectColumns.map((col, ci) => (
              <div key={ci} className="space-y-2.5">
                {col.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      checked={subjectIds.includes(s.id)}
                      onChange={() => toggle(subjectIds, s.id, setSubjectIds)}
                      className="h-4 w-4 accent-mp"
                    />
                    <span>{s.name}</span>
                    <span className="rounded-full bg-mp/10 px-2 py-0.5 text-[11px] font-bold text-mp">
                      {s.questionCount}
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Systems */}
      <section className="mt-5 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h2 className="text-sm font-bold text-ink">
          Systems {systemIds.length > 0 && <span className="text-mp">({systemIds.length} selected)</span>}
        </h2>
        {systemsQuery.isLoading ? (
          <div className="mt-4 h-32 animate-pulse rounded-xl bg-surface2" />
        ) : systems.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No systems available for this selection.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-x-12 gap-y-2.5 sm:grid-cols-2">
            {systems.map((sys) => (
              <label key={sys.id} className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={systemIds.includes(sys.id)}
                  onChange={() => toggle(systemIds, sys.id, setSystemIds)}
                  className="h-4 w-4 accent-mp"
                />
                <span>{sys.name}</span>
              </label>
            ))}
          </div>
        )}
      </section>

      {/* Count + create */}
      <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <label className="flex items-center gap-3 text-sm text-ink-soft">
          <span className="font-bold text-ink">Number of questions</span>
          <input
            type="number"
            min={1}
            max={200}
            value={numQuestions}
            onChange={(e) => setNumQuestions(Number(e.target.value))}
            className="w-24 rounded-lg border border-line px-3 py-2 text-sm focus:border-mp focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={creating || !counts}
          className="rounded-xl bg-mp px-6 py-3 text-sm font-bold text-white shadow-card transition-colors hover:bg-mp-hover disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create Test'}
        </button>
      </section>
    </div>
  );
}

function ModeToggle({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-full border px-5 py-2.5 text-sm font-bold transition-all ${
        active ? 'border-mp bg-mp text-white shadow-glow' : 'border-line bg-surface text-ink-muted hover:border-mp/40'
      }`}
    >
      <span className={`flex h-4 w-7 items-center rounded-full p-0.5 ${active ? 'bg-white/30' : 'bg-surface2'}`}>
        <span className={`h-3 w-3 rounded-full bg-white transition-transform ${active ? 'translate-x-3' : ''}`} />
      </span>
      {label}
    </button>
  );
}
