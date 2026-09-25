import { useMemo, useRef, useState } from 'react';
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
import type { SystemWithTopics } from '@/api/tests';
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

function CountPill({ n }: { n: number | undefined }) {
  return (
    <span className="inline-flex min-w-9 justify-center rounded-full border border-line px-2 py-0.5 text-[11px] font-bold text-ink-soft">
      {n ?? '—'}
    </span>
  );
}

function splitColumns<T>(items: T[]): T[][] {
  // Even/odd split matches the backend's documented fallback layout.
  const cols: T[][] = [[], []];
  items.forEach((item, i) => cols[i % 2].push(item));
  return cols;
}

export default function CreateTestPage() {
  const { bank, step, bankId } = useOutletContext<WorkspaceContext>();
  const navigate = useNavigate();
  const [timed, setTimed] = useState(false);
  const [modes, setModes] = useState<Array<keyof QuestionCounts>>(['unused']);
  const [tiers, setTiers] = useState<DifficultyTier[]>([]);
  const [subjectIds, setSubjectIds] = useState<number[]>([]);
  const [systemIds, setSystemIds] = useState<number[]>([]);
  const [topicIds, setTopicIds] = useState<number[]>([]);
  const [numQuestions, setNumQuestions] = useState(40);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      questionBankIds: [bankId],
      ...(subjectIds.length > 0 ? { subjectIds } : {}),
      ...(systemIds.length > 0 ? { systemIds } : {}),
      ...(topicIds.length > 0 ? { topicIds } : {}),
      ...(tiers.length > 0 ? { difficulty: tiers } : {}),
    }),
    [bankId, subjectIds, systemIds, topicIds, tiers],
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
        // Counts not loaded yet — signal "unknown" so the header shows … and
        // Create stays disabled, instead of flashing a misleading 0.
        if (!countsQuery.data) return Promise.resolve({ count: null as unknown as number });
        const single = countsQuery.data[modes[0]];
        return Promise.resolve({ count: typeof single === 'number' ? single : 0 });
      }
      return getMixedModeCount(step, { ...filters, modes });
    },
    enabled: modes.length > 0 && (modes.length > 1 || countsQuery.data != null),
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
  const subjectColumns = useMemo(() => splitColumns(subjects), [subjects]);

  const systemsQuery = useQuery({
    queryKey: ['test-systems', step, filters],
    queryFn: () => getSystemsWithTopics(step, filters),
  });
  const systems = useMemo(
    () => (systemsQuery.data ?? []) as SystemWithTopics[],
    [systemsQuery.data],
  );
  const systemColumns = useMemo(() => splitColumns(systems), [systems]);

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
              <CountPill n={counts?.[m.key]} />
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
              <CountPill n={tierCounts?.[t.key]} />
            </label>
          ))}
        </div>
      </section>

      {/* Subjects — two-column matrix */}
      <section className="mt-5 rounded-2xl border border-line bg-surface px-6 py-5 shadow-card">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink">
          Subjects{' '}
          {subjectIds.length > 0 && <span className="text-mp">({subjectIds.length} selected)</span>}
        </h2>
        {subjectsQuery.isLoading ? (
          <div className="mt-4 h-32 animate-pulse rounded-xl bg-surface2" />
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
            {subjectColumns.map((col, ci) => (
              <div key={ci} className="space-y-1">
                {col.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5 text-sm text-ink-soft transition-colors hover:bg-surface2/60"
                  >
                    <input
                      type="checkbox"
                      checked={subjectIds.includes(s.id)}
                      onChange={() => toggle(subjectIds, s.id, setSubjectIds)}
                      className="h-4 w-4 shrink-0 accent-mp"
                    />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <CountPill n={s.questionCount} />
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Systems — two-column matrix with expandable topics + global topic search */}
      <SystemsSection
        systemsQueryIsLoading={systemsQuery.isLoading}
        systemColumns={systemColumns}
        systems={systems}
        systemIds={systemIds}
        topicIds={topicIds}
        onToggleSystem={setSystemIds}
        onToggleTopic={setTopicIds}
        onDropSystemTopics={(topicIdSet) => setTopicIds((prev) => prev.filter((t) => !topicIdSet.has(t)))}
      />

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

/* ── Systems: matrix + per-system topic expander + global topic search ── */

function SystemsSection({
  systemsQueryIsLoading,
  systemColumns,
  systems,
  systemIds,
  topicIds,
  onToggleSystem,
  onToggleTopic,
  onDropSystemTopics,
}: {
  systemsQueryIsLoading: boolean;
  systemColumns: SystemWithTopics[][];
  systems: SystemWithTopics[];
  systemIds: number[];
  topicIds: number[];
  onToggleSystem: (setter: (prev: number[]) => number[]) => void;
  onToggleTopic: (setter: (prev: number[]) => number[]) => void;
  onDropSystemTopics: (topicIdSet: Set<number>) => void;
}) {
  const [expanded, setExpanded] = useState<number[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  function toggleSystemRow(sys: SystemWithTopics) {
    if (systemIds.includes(sys.id)) {
      onToggleSystem((prev) => prev.filter((s) => s !== sys.id));
      onDropSystemTopics(new Set((sys.topics ?? []).map((t) => t.id)));
    } else {
      onToggleSystem((prev) => [...prev, sys.id]);
    }
  }

  function toggleTopicRow(sys: SystemWithTopics, topicId: number) {
    if (topicIds.includes(topicId)) {
      onToggleTopic((prev) => prev.filter((t) => t !== topicId));
    } else {
      onToggleTopic((prev) => [...prev, topicId]);
      if (!systemIds.includes(sys.id)) {
        onToggleSystem((prev) => [...prev, sys.id]);
      }
    }
  }

  return (
    <section className="relative mt-5 rounded-2xl border border-line bg-surface px-6 py-5 shadow-card">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink">
          Systems{' '}
          {systemIds.length > 0 && <span className="text-mp">({systemIds.length} selected)</span>}
        </h2>
        <TopicSearchButton
          systems={systems}
          topicIds={topicIds}
          open={searchOpen}
          onOpenChange={setSearchOpen}
          onApply={(ids) => {
            onToggleTopic(() => ids);
            // Ensure the parents of applied topics are selected so the
            // backend's system AND topic filters stay consistent.
            const parentSystems = new Set<number>();
            for (const sys of systems) {
              if ((sys.topics ?? []).some((t) => ids.includes(t.id))) parentSystems.add(sys.id);
            }
            for (const pid of parentSystems) {
              if (!systemIds.includes(pid)) onToggleSystem((prev) => [...prev, pid]);
            }
          }}
        />
      </div>

      {systemsQueryIsLoading ? (
        <div className="mt-4 h-32 animate-pulse rounded-xl bg-surface2" />
      ) : systems.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">No systems available for this selection.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
          {systemColumns.map((col, ci) => (
            <div key={ci}>
              {col.map((sys) => {
                const isOpen = expanded.includes(sys.id);
                return (
                  <div key={sys.id} className="border-b border-line/60 last:border-0">
                    <div className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-sm text-ink-soft transition-colors hover:bg-surface2/60">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={systemIds.includes(sys.id)}
                          onChange={() => toggleSystemRow(sys)}
                          className="h-4 w-4 shrink-0 accent-mp"
                        />
                        <span className="min-w-0 flex-1 truncate">{sys.name}</span>
                      </label>
                      <CountPill n={sys.questionCount} />
                      <button
                        type="button"
                        aria-label={isOpen ? 'Hide topics' : 'Show topics'}
                        onClick={() =>
                          setExpanded((prev) =>
                            prev.includes(sys.id) ? prev.filter((x) => x !== sys.id) : [...prev, sys.id],
                          )
                        }
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm font-bold transition-colors ${
                          isOpen
                            ? 'border-mp bg-mp text-white'
                            : 'border-line text-ink-muted hover:border-mp/50 hover:text-mp'
                        }`}
                      >
                        {isOpen ? '−' : '+'}
                      </button>
                    </div>

                    {isOpen && (
                      <div className="mb-2 ml-9 space-y-0.5 border-l-2 border-line pl-3">
                        {(sys.topics ?? []).length === 0 ? (
                          <p className="py-1 text-xs text-ink-faint">No topics with questions.</p>
                        ) : (
                          (sys.topics ?? []).map((t) => {
                            const checked = topicIds.includes(t.id);
                            const zero = (t.questionCount ?? 0) === 0;
                            return (
                              <label
                                key={t.id}
                                className={`flex items-center gap-2.5 rounded-lg px-1 py-1 text-sm transition-colors ${
                                  zero
                                    ? 'cursor-not-allowed text-ink-faint'
                                    : 'cursor-pointer text-ink-soft hover:bg-surface2/60'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={zero}
                                  onChange={() => toggleTopicRow(sys, t.id)}
                                  className="h-3.5 w-3.5 shrink-0 accent-mp"
                                />
                                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                                <CountPill n={t.questionCount} />
                              </label>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** "Search topics" pill + dropdown panel that filters every topic in the bank. */
function TopicSearchButton({
  systems,
  topicIds,
  open,
  onOpenChange,
  onApply,
}: {
  systems: SystemWithTopics[];
  topicIds: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (topicIds: number[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<number[]>(topicIds);
  const wrapRef = useRef<HTMLDivElement>(null);

  // All topics flattened, with their parent system name for context.
  const allTopics = useMemo(
    () =>
      systems.flatMap((sys) =>
        (sys.topics ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          count: t.questionCount ?? 0,
          systemName: sys.name,
        })),
      ),
    [systems],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTopics;
    return allTopics.filter(
      (t) => t.name.toLowerCase().includes(q) || t.systemName.toLowerCase().includes(q),
    );
  }, [allTopics, query]);

  function openPanel() {
    setPending(topicIds);
    setQuery('');
    onOpenChange(true);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => (open ? onOpenChange(false) : openPanel())}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
          open
            ? 'border-mp bg-mp text-white'
            : 'border-link/40 bg-link/5 text-link hover:bg-link/10'
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m20 20-3.5-3.5" />
        </svg>
        Search topics
      </button>

      {open && (
        <>
          {/* Click-away layer */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => onOpenChange(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
            <div className="border-b border-line p-3">
              <div className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 focus-within:border-mp">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-ink-faint" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" d="m20 20-3.5-3.5" />
                </svg>
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type to filter topics..."
                  className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-ink-muted">No topics match.</p>
              ) : (
                filtered.map((t) => {
                  const checked = pending.includes(t.id);
                  const zero = t.count === 0;
                  return (
                    <label
                      key={`${t.id}-${t.systemName}`}
                      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                        zero ? 'cursor-not-allowed text-ink-faint' : 'cursor-pointer text-ink-soft hover:bg-surface2'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={zero}
                        onChange={() =>
                          setPending((prev) =>
                            prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                          )
                        }
                        className="h-4 w-4 shrink-0 accent-mp"
                      />
                      <span className="min-w-0 flex-[1.2] truncate font-medium text-ink">{t.name}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-ink-faint">{t.systemName}</span>
                      <span className="inline-flex min-w-9 shrink-0 justify-center rounded-full border border-line px-2 py-0.5 text-[11px] font-bold text-ink-soft">
                        {t.count}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-line px-3 py-2.5">
              <span className="text-xs font-semibold text-ink-muted">{pending.length} selected</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPending([])}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-ink-muted transition-colors hover:bg-surface2 hover:text-ink"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onApply(pending);
                    onOpenChange(false);
                  }}
                  className="rounded-lg bg-link px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-link/90"
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        </>
      )}
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
