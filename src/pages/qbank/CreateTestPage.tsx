import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  createTest,
  getDifficultyCounts,
  getMixedModeCount,
  getQuestionCounts,
  getSubjects,
  getSystemsWithTopics,
  type DifficultyTier,
  type QuestionCounts,
} from '@/api/tests';
import type { SubjectCount, SystemWithTopics } from '@/api/tests';
import { type WorkspaceContext } from './WelcomePage';

/** Checkbox order mirrors the real UWorld Create Test screen. */
const MODES: Array<{ key: keyof QuestionCounts; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'unused', label: 'Unused' },
  { key: 'used', label: 'Used' },
  { key: 'incorrect', label: 'Incorrect' },
  { key: 'correct', label: 'Correct' },
  { key: 'marked', label: 'Marked' },
  { key: 'marked_correct', label: 'Marked Correct' },
  { key: 'marked_incorrect', label: 'Marked Incorrect' },
  { key: 'omitted', label: 'Omitted' },
  { key: 'suspended', label: 'Suspended' },
];

const TIERS: Array<{ key: DifficultyTier; label: string }> = [
  { key: 'very_hard', label: 'Very Hard' },
  { key: 'hard', label: 'Hard' },
  { key: 'medium', label: 'Medium' },
  { key: 'easy', label: 'Easy' },
  { key: 'very_easy', label: 'Very Easy' },
];

export default function CreateTestPage() {
  const { bank, step, bankId } = useOutletContext<WorkspaceContext>();
  const navigate = useNavigate();
  const [timed, setTimed] = useState(false);
  const [modes, setModes] = useState<Array<keyof QuestionCounts>>(['unused']);
  const [tiers, setTiers] = useState<DifficultyTier[]>([]);
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
      ...(tiers.length > 0 ? { difficulty: tiers } : {}),
    }),
    [bankId, subjectIds, systemIds, tiers],
  );

  const countsQuery = useQuery({
    queryKey: ['test-counts', step, filters],
    queryFn: () => getQuestionCounts(step, filters),
  });
  const counts = countsQuery.data;

  const availabilityQuery = useQuery({
    queryKey: ['test-availability', step, filters, [...modes].sort().join(',')],
    queryFn: () => {
      if (modes.length === 1) {
        const single = countsQuery.data?.[modes[0]];
        return Promise.resolve({ count: typeof single === 'number' ? single : 0 });
      }
      return getMixedModeCount(step, { ...filters, modes });
    },
    enabled: modes.length > 0,
    // Keep the previous availability visible while the mixed count refetches.
    placeholderData: (prev) => prev,
  });
  const available = availabilityQuery.data?.count ?? null;

  const difficultyQuery = useQuery({
    queryKey: ['difficulty-counts', step, bankId],
    queryFn: () => getDifficultyCounts(step, [bankId]),
  });
  const tierCounts = difficultyQuery.data;

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

  function toggleMode(key: keyof QuestionCounts) {
    setModes((prev) => {
      const next = prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key];
      return next.length > 0 ? next : prev;
    });
  }

  function toggle<T>(list: T[], value: T, set: (v: T[]) => void) {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const single = modes.length === 1 ? modes[0] : null;
      const res = await createTest({
        title: `${bank?.name ?? 'Bank'} — ${modes.length === 1 ? single : 'mixed'}`,
        type: timed ? 'timed' : 'tutor',
        // Multi-mode selection rides as mode='mixed' + filters.modes on the backend.
        mode: single ?? 'mixed',
        step,
        totalQuestions: Math.max(1, Math.min(200, numQuestions)),
        filters: single ? filters : { ...filters, modes },
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

      {/* Standard Mode */}
      <section className="mt-5 rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex items-baseline gap-3 border-b border-line px-6 py-4">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink">Standard Mode</h2>
          <span className="text-xs font-semibold text-ink-muted">
            Available: <span className="font-bold text-link">{available ?? '…'}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-5">
          {MODES.map((m) => (
            <label key={m.key} className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={modes.includes(m.key)}
                onChange={() => toggleMode(m.key)}
                className="h-4 w-4 accent-mp"
              />
              <span className={modes.includes(m.key) ? 'font-bold text-ink' : ''}>{m.label}</span>
              <span className="rounded-full bg-mp/10 px-2 py-0.5 text-[11px] font-bold text-mp">
                {counts?.[m.key] ?? '—'}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Difficulty */}
      <section className="mt-5 rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex items-baseline gap-3 border-b border-line px-6 py-4">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink">Difficulty</h2>
          <span className="text-xs font-semibold text-ink-muted">
            {tiers.length === 0 ? 'All difficulties' : `${tiers.length} selected`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-5">
          {TIERS.map((t) => (
            <label key={t.key} className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={tiers.includes(t.key)}
                onChange={() => toggle(tiers, t.key, setTiers)}
                className="h-4 w-4 accent-mp"
              />
              <span className={tiers.includes(t.key) ? 'font-bold text-ink' : ''}>{t.label}</span>
              <span className="rounded-full bg-mp/10 px-2 py-0.5 text-[11px] font-bold text-mp">
                {tierCounts?.[t.key] ?? '—'}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Subjects */}
      <section className="mt-5 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink">
          Subject {subjectIds.length > 0 && <span className="text-mp">({subjectIds.length} selected)</span>}
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
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink">
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

      {/* Test mode + count + create */}
      <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <div className="flex items-center gap-6">
          <span className="text-sm font-bold text-ink">Test Mode</span>
          <ModeToggle active={!timed} label="Tutor" onClick={() => setTimed(false)} />
          <ModeToggle active={timed} label="Timed" onClick={() => setTimed(true)} />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-3 text-sm text-ink-soft">
            <span className="font-bold text-ink">Questions</span>
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
            disabled={creating || available == null || available === 0}
            className="rounded-xl bg-mp px-6 py-3 text-sm font-bold text-white shadow-card transition-colors hover:bg-mp-hover disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create Test'}
          </button>
        </div>
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
