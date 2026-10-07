import { useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTest,
  getDifficultyCounts,
  getMixedModeCount,
  getQuestionCounts,
  getSubjects,
  getSystemsWithTopics,
  retrieveTestQuestions,
  type DifficultyTier,
  type QuestionCounts,
} from '@/api/tests';
import type { SystemWithTopics } from '@/api/tests';
import { type WorkspaceContext } from './WelcomePage';
import { SectionLoader } from '@/components/PulseLoader';
import { invalidateQbankProgressQueries } from '@/lib/qbankProgressQueries';

type QuestionStatusMode = keyof QuestionCounts;
type TestFilters = {
  questionBankIds: number[];
  subjectIds?: number[];
  systemIds?: number[];
  topicIds?: number[];
  difficulty?: DifficultyTier[];
  modes?: QuestionStatusMode[];
};

/** Checkbox order mirrors the real UWorld Create Test screen. */
const MODES: Array<{ key: QuestionStatusMode; label: string }> = [
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

// Product/UI limits. The canonical backend currently supports a higher ceiling,
// so increasing these later remains a frontend product decision.
const MAX_TEST_QUESTIONS = 50;
const MAX_CUSTOM_IDS = 50;
const MAX_QUESTION_ID = 2_147_483_647;

interface ParsedCustomIds {
  ids: number[];
  invalidTokens: string[];
}

function parseCustomIds(value: string): ParsedCustomIds {
  const ids: number[] = [];
  const invalidTokens: string[] = [];
  const seenIds = new Set<number>();
  const seenInvalid = new Set<string>();

  for (const token of value.split(',').map((part) => part.trim()).filter(Boolean)) {
    if (!/^\d+$/.test(token)) {
      if (!seenInvalid.has(token)) {
        seenInvalid.add(token);
        invalidTokens.push(token);
      }
      continue;
    }

    const id = Number(token);
    if (!Number.isSafeInteger(id) || id <= 0 || id > MAX_QUESTION_ID) {
      if (!seenInvalid.has(token)) {
        seenInvalid.add(token);
        invalidTokens.push(token);
      }
      continue;
    }

    if (!seenIds.has(id)) {
      seenIds.add(id);
      ids.push(id);
    }
  }

  return { ids, invalidTokens };
}

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

/** Collapse topics that share a name into a single row: ids grouped, counts summed. */
function mergeTopicsByName(
  topics: Array<{ id: number; name: string; questionCount?: number }>,
): Array<{ ids: number[]; name: string; count: number }> {
  const byName = new Map<string, { ids: number[]; name: string; count: number }>();
  for (const t of topics) {
    const key = t.name.trim().toLowerCase();
    const entry = byName.get(key);
    if (entry) {
      if (!entry.ids.includes(t.id)) entry.ids.push(t.id);
      entry.count += t.questionCount ?? 0;
    } else {
      byName.set(key, { ids: [t.id], name: t.name, count: t.questionCount ?? 0 });
    }
  }
  return Array.from(byName.values());
}

export default function CreateTestPage() {
  const { bank, step, bankId } = useOutletContext<WorkspaceContext>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [timed, setTimed] = useState(false);
  const [questionTab, setQuestionTab] = useState<'standard' | 'custom'>('standard');
  const [modes, setModes] = useState<QuestionStatusMode[]>(['unused']);
  const [tiers, setTiers] = useState<DifficultyTier[]>([]);
  const [subjectIds, setSubjectIds] = useState<number[]>([]);
  const [systemIds, setSystemIds] = useState<number[]>([]);
  const [topicIds, setTopicIds] = useState<number[]>([]);
  const [numQuestions, setNumQuestions] = useState(40);
  const [testName, setTestName] = useState('');
  const [uwIdsText, setUwIdsText] = useState('');
  const [retrieveId, setRetrieveId] = useState('');
  const [retrieving, setRetrieving] = useState(false);
  const [retrieveMsg, setRetrieveMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customIdState = useMemo(() => parseCustomIds(uwIdsText), [uwIdsText]);
  const customIds = customIdState.ids;
  const customHasInvalidTokens = customIdState.invalidTokens.length > 0;
  const customTooMany = customIds.length > MAX_CUSTOM_IDS;
  const customCanCreate = customIds.length > 0 && !customHasInvalidTokens && !customTooMany;
  const standardCountInvalid =
    !Number.isInteger(numQuestions) || numQuestions < 1 || numQuestions > MAX_TEST_QUESTIONS;
  const invalidCustomPreview = customIdState.invalidTokens.slice(0, 8).join(', ');
  const invalidCustomMore = Math.max(0, customIdState.invalidTokens.length - 8);

  // Final availability/create filters include the learner's system/topic selections.
  const filters = useMemo<TestFilters>(
    () => ({
      questionBankIds: [bankId],
      ...(subjectIds.length > 0 ? { subjectIds } : {}),
      ...(systemIds.length > 0 ? { systemIds } : {}),
      ...(topicIds.length > 0 ? { topicIds } : {}),
      ...(tiers.length > 0 ? { difficulty: tiers } : {}),
    }),
    [bankId, subjectIds, systemIds, topicIds, tiers],
  );

  // Systems/topics metadata must describe the available matrix, not shrink to
  // the rows already selected by the learner. Subject/difficulty can scope the
  // metadata universe; system/topic selections only scope availability/create.
  const metadataFilters = useMemo<TestFilters>(
    () => ({
      questionBankIds: [bankId],
      ...(subjectIds.length > 0 ? { subjectIds } : {}),
      ...(tiers.length > 0 ? { difficulty: tiers } : {}),
    }),
    [bankId, subjectIds, tiers],
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
    queryKey: ['test-systems', step, metadataFilters],
    queryFn: () => getSystemsWithTopics(step, metadataFilters),
  });
  const systems = useMemo(
    () => (systemsQuery.data ?? []) as SystemWithTopics[],
    [systemsQuery.data],
  );
  const systemColumns = useMemo(() => splitColumns(systems), [systems]);

  function toggleMode(key: QuestionStatusMode) {
    setModes((prev) => {
      // All is mutually exclusive with every narrower status mode.
      // Selecting a narrower mode while All is active replaces All; selecting
      // All clears the narrower modes. This mirrors the backend union rule
      // where ALL dominates every other selection.
      if (key === 'all') return ['all'];

      const withoutAll = prev.filter((mode) => mode !== 'all');
      const next = withoutAll.includes(key)
        ? withoutAll.filter((mode) => mode !== key)
        : [...withoutAll, key];

      // Never leave the status group empty; fall back to All.
      return next.length > 0 ? next : ['all'];
    });
  }

  function toggle<T>(list: T[], value: T, set: (v: T[]) => void) {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  async function handleCreate() {
    const isCustom = questionTab === 'custom';

    if (isCustom && !customCanCreate) {
      if (customHasInvalidTokens) {
        setError('Fix the invalid UWorld IDs before creating the test.');
      } else if (customTooMany) {
        setError(`Custom tests support a maximum of ${MAX_CUSTOM_IDS} unique UWorld IDs.`);
      } else {
        setError('Enter at least one valid UWorld ID.');
      }
      return;
    }

    if (!isCustom && standardCountInvalid) {
      setError(`Standard tests support between 1 and ${MAX_TEST_QUESTIONS} questions.`);
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const single = modes.length === 1 ? modes[0] : null;
      const total = isCustom ? customIds.length : numQuestions;
      const res = await createTest({
        title:
          testName.trim() ||
          (isCustom
            ? `${bank?.name ?? 'Bank'} — custom`
            : `${bank?.name ?? 'Bank'} — ${modes.length === 1 ? single : 'mixed'}`),
        type: timed ? 'timed' : 'tutor',
        mode: isCustom ? 'all' : (single ?? 'mixed_modes'),
        step,
        totalQuestions: total,
        // Timed tests require a time limit server-side (~90s per question).
        ...(timed ? { timeLimitSeconds: Math.max(60, total * 90) } : {}),
        filters: isCustom ? { questionBankIds: [bankId] } : single ? filters : { ...filters, modes },
        ...(isCustom && customIds.length > 0 ? { customQuestionIds: customIds } : {}),
      });
      const testId = res.id ?? null;
      if (testId) {
        // The backend has already persisted test_questions and bumped its
        // filtered-count cache epoch before returning. Mark every frontend
        // progress/availability cache stale now, without blocking navigation
        // on unnecessary refetches while the exam route is opening.
        await invalidateQbankProgressQueries(queryClient);
        navigate(`/test/${testId}`);
      } else {
        setError('Test created but no ID returned.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create test.');
    } finally {
      setCreating(false);
    }
  }

  async function handleRetrieve() {
    const id = Number(retrieveId.trim());
    setRetrieveMsg(null);
    if (!Number.isFinite(id) || id <= 0) {
      setRetrieveMsg('Enter a numeric test ID.');
      return;
    }
    setRetrieving(true);
    try {
      const ids = await retrieveTestQuestions(id);
      if (!Array.isArray(ids) || ids.length === 0) {
        setRetrieveMsg('No questions found for that test ID.');
      } else {
        setUwIdsText(ids.join(','));
        setRetrieveMsg(`Loaded ${ids.length} question ID${ids.length === 1 ? '' : 's'} from test #${id}.`);
      }
    } catch {
      setRetrieveMsg('Could not retrieve questions for that test ID.');
    } finally {
      setRetrieving(false);
    }
  }

  return (
    <div className="min-w-0">
      <h1 className="text-lg font-extrabold tracking-tight text-ink sm:text-xl">Create Test</h1>

      {error && (
        <div className="mt-4 rounded-2xl border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">{error}</div>
      )}

      {/* QUESTION MODE — Standard / Custom */}
      <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-4 sm:px-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink">Question Mode</h2>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
            Total Available
            <span className="rounded-full bg-mp/10 px-2 py-0.5 text-[11px] font-bold text-mp">
              {counts?.all ?? '…'}
            </span>
          </span>
          <div className="flex w-full items-center rounded-full bg-surface2 p-1 sm:ml-auto sm:w-auto">
            <button
              type="button"
              onClick={() => setQuestionTab('standard')}
              className={`min-h-10 flex-1 rounded-full px-4 py-1.5 text-sm font-bold transition-all sm:flex-none sm:px-5 ${
                questionTab === 'standard'
                  ? 'bg-surface text-ink shadow-card'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setQuestionTab('custom')}
              className={`min-h-10 flex-1 rounded-full px-4 py-1.5 text-sm font-bold transition-all sm:flex-none sm:px-5 ${
                questionTab === 'custom'
                  ? 'bg-surface text-ink shadow-card'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Custom
            </button>
          </div>
        </div>
        {questionTab === 'standard' && (
          <>
            <div className="flex flex-wrap items-center gap-2 px-4 py-4 text-xs font-semibold text-ink-muted sm:px-6">
              <span>
                Available: <span className="font-bold text-link">{available ?? '…'}</span>
              </span>
              {modes.length > 1 && (
                <span className="rounded-full border border-mp/20 bg-mp/10 px-2.5 py-1 text-[11px] font-bold text-mp">
                  Mixed · {modes.length} selected
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 px-4 pb-5 sm:grid-cols-2 sm:px-6 md:grid-cols-3 xl:grid-cols-5">
              {MODES.map((m) => (
                <label
                  key={m.key}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2 text-sm text-ink-soft transition-colors hover:border-line hover:bg-surface2/60"
                >
                  <input
                    type="checkbox"
                    checked={modes.includes(m.key)}
                    onChange={() => toggleMode(m.key)}
                    className="h-4 w-4 shrink-0 accent-mp"
                  />
                  <span className={`min-w-0 flex-1 ${modes.includes(m.key) ? 'font-bold text-ink' : ''}`}>
                    {m.label}
                  </span>
                  <CountPill n={counts?.[m.key]} />
                </label>
              ))}
            </div>
          </>
        )}
      </section>

      {questionTab === 'custom' && (
        <section className="mt-5 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink">Test Name</h2>
          <input
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            placeholder="Optional — defaults to the bank name"
            className="mt-3 w-full rounded-lg border border-line bg-surface2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-mp focus:outline-none"
          />

          <div className="mt-5 rounded-xl border border-link/20 bg-link/5 p-4">
            <h3 className="text-sm font-bold text-ink">Instructions on using Custom mode</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              This mode lets you hand-pick exact questions by their UWorld IDs — for faculty/group
              review, or to rebuild the same test inside a group. Only <strong>unused</strong>{' '}
              questions from the selected bank can be used, and the maximum number of questions is{' '}
              <strong>50</strong>. Invalid IDs are rejected.
            </p>
          </div>

          <h2 className="mt-6 text-sm font-extrabold uppercase tracking-wide text-ink">
            Retrieve questions of a test #
          </h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={retrieveId}
              onChange={(e) => setRetrieveId(e.target.value)}
              placeholder="Enter Test ID"
              className="w-full min-w-0 rounded-lg border border-line bg-surface2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-mp focus:outline-none sm:max-w-xl"
            />
            <button
              type="button"
              onClick={() => void handleRetrieve()}
              disabled={retrieving}
              className="min-h-11 w-full rounded-lg bg-link px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-link/90 disabled:opacity-50 sm:w-auto"
            >
              {retrieving ? 'Retrieving…' : 'Retrieve'}
            </button>
          </div>
          {retrieveMsg && <p className="mt-2 text-xs font-semibold text-ink-muted">{retrieveMsg}</p>}

          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink">
            Enter UW IDs separated by comma (,)
          </h2>
          <textarea
            value={uwIdsText}
            onChange={(e) => setUwIdsText(e.target.value)}
            placeholder="e.g. 101,102,103"
            rows={4}
            aria-invalid={customHasInvalidTokens || customTooMany}
            aria-describedby="custom-id-feedback"
            className={`mt-3 w-full resize-y rounded-lg border bg-surface2 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none ${
              customHasInvalidTokens || customTooMany
                ? 'border-bad/60 focus:border-bad'
                : 'border-line focus:border-mp'
            }`}
          />
          <div id="custom-id-feedback" className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-ink-faint">Use comma-separated positive integer UWorld IDs.</span>
            <span
              className={`font-bold ${
                customTooMany || customHasInvalidTokens
                  ? 'text-bad'
                  : customIds.length > 0
                    ? 'text-link'
                    : 'text-ink-faint'
              }`}
            >
              {customIds.length} / {MAX_CUSTOM_IDS} selected
            </span>
          </div>
          {customHasInvalidTokens && (
            <p className="mt-2 break-words text-xs font-semibold text-bad" role="alert">
              Invalid ID{customIdState.invalidTokens.length === 1 ? '' : 's'}: {invalidCustomPreview}
              {invalidCustomMore > 0 ? ` …and ${invalidCustomMore} more` : ''}. Use positive whole numbers only.
            </p>
          )}
          {customTooMany && (
            <p className="mt-2 text-xs font-semibold text-bad" role="alert">
              Maximum {MAX_CUSTOM_IDS} unique UWorld IDs. Your input is preserved; remove {customIds.length - MAX_CUSTOM_IDS} to continue.
            </p>
          )}
        </section>
      )}

      {/* Standard-only filters */}
      {questionTab === 'standard' && (
        <>
      {/* Difficulty */}
      <section className="mt-5 rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex flex-wrap items-baseline gap-2 border-b border-line px-4 py-4 sm:gap-3 sm:px-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink">Difficulty</h2>
          <span className="text-xs font-semibold text-ink-muted">
            {tiers.length === 0 ? 'All difficulties' : `${tiers.length} selected`}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 px-4 py-4 sm:grid-cols-2 sm:px-6 md:grid-cols-3 xl:grid-cols-5">
          {TIERS.map((t) => (
            <label
              key={t.key}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2 text-sm text-ink-soft transition-colors hover:border-line hover:bg-surface2/60"
            >
              <input
                type="checkbox"
                checked={tiers.includes(t.key)}
                onChange={() => toggle(tiers, t.key, setTiers)}
                className="h-4 w-4 shrink-0 accent-mp"
              />
              <span className={`min-w-0 flex-1 ${tiers.includes(t.key) ? 'font-bold text-ink' : ''}`}>
                {t.label}
              </span>
              <CountPill n={tierCounts?.[t.key]} />
            </label>
          ))}
        </div>
      </section>

      {/* Subjects — two-column matrix with a select-all master checkbox */}
      <section className="mt-5 rounded-2xl border border-line bg-surface px-4 py-5 shadow-card sm:px-6">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            aria-label="Select all subjects"
            checked={subjects.length > 0 && subjectIds.length === subjects.length}
            ref={(el) => {
              if (el) el.indeterminate = subjectIds.length > 0 && subjectIds.length < subjects.length;
            }}
            onChange={() => {
              if (subjectIds.length === subjects.length) {
                // Clearing subjects orphans system/topic constraints — reset them.
                setSubjectIds([]);
                setSystemIds([]);
                setTopicIds([]);
              } else {
                setSubjectIds(subjects.map((s) => s.id));
              }
            }}
            className="h-4 w-4 accent-mp"
          />
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink">
            Subjects{' '}
            {subjectIds.length > 0 && <span className="text-mp">({subjectIds.length} selected)</span>}
          </h2>
        </div>
        {subjectsQuery.isLoading ? (
          <div className="mt-4">
            <SectionLoader minHeight={130} label="Loading subjects" />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
            {subjectColumns.map((col, ci) => (
              <div key={ci} className="space-y-1">
                {col.map((s) => (
                  <label
                    key={s.id}
                    className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5 text-sm text-ink-soft transition-colors hover:bg-surface2/60"
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

      {/* Systems — two-column matrix with expandable topics + global topic search.
          Disabled until the user picks at least one subject. */}
      <SystemsSection
        disabled={subjectIds.length === 0}
        systemsQueryIsLoading={systemsQuery.isLoading}
        systemColumns={systemColumns}
        systems={systems}
        systemIds={systemIds}
        topicIds={topicIds}
        onToggleSystem={setSystemIds}
        onToggleTopic={setTopicIds}
        onClearSystems={() => setSystemIds([])}
        onDropSystemTopics={(topicIdSet) => setTopicIds((prev) => prev.filter((t) => !topicIdSet.has(t)))}
      />
        </>
      )}

      {/* Test mode + count + create */}
      <section className="mt-5 flex flex-col gap-5 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full flex-wrap items-center gap-2 sm:gap-3 md:w-auto md:gap-4">
          <span className="mr-1 text-sm font-bold text-ink">Test Mode</span>
          <ModeToggle active={!timed} label="Tutor" onClick={() => setTimed(false)} />
          <ModeToggle active={timed} label="Timed" onClick={() => setTimed(true)} />
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto">
          {questionTab === 'standard' && (
            <label className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
              <span className="font-bold text-ink">Questions</span>
              <input
                type="number"
                min={1}
                max={MAX_TEST_QUESTIONS}
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                aria-invalid={standardCountInvalid}
                className={`w-24 rounded-lg border px-3 py-2 text-sm focus:outline-none ${
                  standardCountInvalid ? 'border-bad/60 focus:border-bad' : 'border-line focus:border-mp'
                }`}
              />
              <span className="whitespace-nowrap text-xs font-semibold text-ink-muted">
                Available: <span className="font-bold text-link">{available ?? '…'}</span>
              </span>
            </label>
          )}
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={
              creating ||
              (questionTab === 'standard'
                ? available == null || available === 0 || standardCountInvalid
                : !customCanCreate)
            }
            className="min-h-11 w-full rounded-xl bg-mp px-6 py-3 text-sm font-bold text-white shadow-card transition-colors hover:bg-mp-hover disabled:opacity-50 sm:w-auto"
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
  disabled,
  systemsQueryIsLoading,
  systemColumns,
  systems,
  systemIds,
  topicIds,
  onToggleSystem,
  onToggleTopic,
  onClearSystems,
  onDropSystemTopics,
}: {
  disabled: boolean;
  systemsQueryIsLoading: boolean;
  systemColumns: SystemWithTopics[][];
  systems: SystemWithTopics[];
  systemIds: number[];
  topicIds: number[];
  onToggleSystem: (setter: (prev: number[]) => number[]) => void;
  onToggleTopic: (setter: (prev: number[]) => number[]) => void;
  onClearSystems: () => void;
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

  function toggleTopicRow(sys: SystemWithTopics, ids: number[]) {
    if (ids.every((id) => topicIds.includes(id))) {
      onToggleTopic((prev) => prev.filter((t) => !ids.includes(t)));
    } else {
      onToggleTopic((prev) => [...new Set([...prev, ...ids])]);
      if (!systemIds.includes(sys.id)) {
        onToggleSystem((prev) => [...prev, sys.id]);
      }
    }
  }

  const allSystemsSelected = systems.length > 0 && systemIds.length === systems.length;

  return (
    <section
      className={`relative mt-5 rounded-2xl border bg-surface px-4 py-5 shadow-card transition-opacity sm:px-6 ${
        disabled ? 'pointer-events-none border-dashed opacity-50' : 'border-line'
      }`}
    >
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <input
          type="checkbox"
          aria-label="Select all systems"
          disabled={disabled}
          checked={allSystemsSelected}
          ref={(el) => {
            if (el) el.indeterminate = systemIds.length > 0 && systemIds.length < systems.length;
          }}
          onChange={() => {
            if (allSystemsSelected) {
              onClearSystems();
              onDropSystemTopics(new Set(topicIds));
            } else {
              onToggleSystem(() => systems.map((s) => s.id));
            }
          }}
          className="h-4 w-4 accent-mp"
        />
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

      {disabled ? (
        <p className="mt-3 text-sm text-ink-muted">
          Select at least one subject to unlock systems and their topics.
        </p>
      ) : systemsQueryIsLoading ? (
        <div className="mt-4">
          <SectionLoader minHeight={130} label="Loading systems" />
        </div>
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
                    <div className="flex min-h-11 items-center gap-2.5 rounded-lg px-1 py-1.5 text-sm text-ink-soft transition-colors hover:bg-surface2/60">
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
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm font-bold transition-colors ${
                          isOpen
                            ? 'border-mp bg-mp text-white'
                            : 'border-line text-ink-muted hover:border-mp/50 hover:text-mp'
                        }`}
                      >
                        {isOpen ? '−' : '+'}
                      </button>
                    </div>

                    {isOpen && (
                      <div className="mb-2 ml-5 space-y-0.5 border-l-2 border-line pl-3 sm:ml-9">
                        {mergeTopicsByName(sys.topics ?? []).length === 0 ? (
                          <p className="py-1 text-xs text-ink-faint">No topics with questions.</p>
                        ) : (
                          mergeTopicsByName(sys.topics ?? []).map((t) => {
                            const allSelected = t.ids.every((id) => topicIds.includes(id));
                            const someSelected = t.ids.some((id) => topicIds.includes(id));
                            const zero = t.count === 0;
                            return (
                              <label
                                key={t.ids[0]}
                                className={`flex min-h-10 items-center gap-2.5 rounded-lg px-1 py-1 text-sm transition-colors ${
                                  zero
                                    ? 'cursor-not-allowed text-ink-faint'
                                    : 'cursor-pointer text-ink-soft hover:bg-surface2/60'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  ref={(el) => {
                                    if (el) el.indeterminate = someSelected && !allSelected;
                                  }}
                                  disabled={zero}
                                  onChange={() => toggleTopicRow(sys, t.ids)}
                                  className="h-3.5 w-3.5 shrink-0 accent-mp"
                                />
                                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                                <CountPill n={t.count} />
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

  // All topics flattened, then MERGED by name: topics that share a name across
  // different systems/subjects appear once, with counts summed and the parent
  // systems listed for context. Selecting a merged row selects every underlying
  // topic id, so the backend filter stays exact.
  const allTopics = useMemo(() => {
    const byName = new Map<
      string,
      { ids: number[]; name: string; count: number; systemNames: string[] }
    >();
    for (const sys of systems) {
      for (const t of sys.topics ?? []) {
        const key = t.name.trim().toLowerCase();
        const entry = byName.get(key);
        if (entry) {
          if (!entry.ids.includes(t.id)) entry.ids.push(t.id);
          entry.count += t.questionCount ?? 0;
          if (!entry.systemNames.includes(sys.name)) entry.systemNames.push(sys.name);
        } else {
          byName.set(key, {
            ids: [t.id],
            name: t.name,
            count: t.questionCount ?? 0,
            systemNames: [sys.name],
          });
        }
      }
    }
    return Array.from(byName.values());
  }, [systems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTopics;
    return allTopics.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.systemNames.some((s) => s.toLowerCase().includes(q)),
    );
  }, [allTopics, query]);

  function openPanel() {
    setPending(topicIds);
    setQuery('');
    onOpenChange(true);
  }

  return (
    <div className="relative ml-auto sm:ml-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => (open ? onOpenChange(false) : openPanel())}
        className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
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
          <div className="fixed inset-x-4 top-20 z-40 max-h-[calc(100vh-6rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:max-h-none">
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
                  className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
                />
              </div>
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2 sm:max-h-72">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-ink-muted">No topics match.</p>
              ) : (
                filtered.map((t) => {
                  const allSelected = t.ids.every((id) => pending.includes(id));
                  const someSelected = t.ids.some((id) => pending.includes(id));
                  const zero = t.count === 0;
                  return (
                    <label
                      key={t.ids[0]}
                      className={`flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                        zero ? 'cursor-not-allowed text-ink-faint' : 'cursor-pointer text-ink-soft hover:bg-surface2'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected && !allSelected;
                        }}
                        disabled={zero}
                        onChange={() =>
                          setPending((prev) =>
                            allSelected
                              ? prev.filter((x) => !t.ids.includes(x))
                              : [...new Set([...prev, ...t.ids])],
                          )
                        }
                        className="h-4 w-4 shrink-0 accent-mp"
                      />
                      <span className="min-w-0 flex-[1.2] truncate font-medium text-ink">{t.name}</span>
                      <span className="hidden min-w-0 flex-1 truncate text-xs text-ink-faint sm:block">
                        {t.systemNames.join(' · ')}
                      </span>
                      <span className="inline-flex min-w-9 shrink-0 justify-center rounded-full border border-line px-2 py-0.5 text-[11px] font-bold text-ink-soft">
                        {t.count}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2.5">
              <span className="text-xs font-semibold text-ink-muted">{pending.length} selected</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPending([])}
                  className="min-h-9 rounded-lg px-3 py-1.5 text-xs font-bold text-ink-muted transition-colors hover:bg-surface2 hover:text-ink"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onApply(pending);
                    onOpenChange(false);
                  }}
                  className="min-h-9 rounded-lg bg-link px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-link/90"
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
      className={`flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition-all sm:px-5 ${
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
