# MedPark Analytics — Data Sources Reference

This document is the single source of truth for where every analytics number
in the MedPark backend comes from. Update it whenever a table, write path, or
read endpoint that feeds analytics changes.

If you ever ask "why does this number look weird?", start here.

---

## 1. Data flow at a glance

```
USER TAKES A TEST
  │
  ├─→ POST /api/tests/:id/submit-answer
  │     TestExecutionService.submitAnswer()
  │       ↳ INSERT/UPDATE question_submissions   ← event log (source of truth)
  │       ↳ UPDATE tests (running counters)
  │       ↳ UPSERT user_daily_stats              ← fire-and-forget
  │
  └─→ POST /api/tests/:id/complete
        TestExecutionService.completeTest()
          ↳ UPDATE tests (status=COMPLETED, percentageScore, completedAt)
          ↳ UPDATE users (questionStreak, longestQuestionStreak)
          ↳ AnalyticsAggregationService.processTestIfNeeded()
              ↳ INSERT test_analytics_snapshots  (per-test breakdown)
              ↳ UPSERT user_analytics_stats      (per-user-per-step rollup)
              ↳ UPSERT user_dimension_stats      (per-dimension rollup)
              ↳ INCREMENT questions.timesAnswered / timesCorrect

READ PATHS
  GET /api/tests/performance/overview  → reads all five tables above
  GET /api/tests/:id/results           → reads tests + snapshot
  GET /api/tests/performance/statistics → reads questions/banks + submissions + tests
  GET /api/users/home-stats            → reads users + user_daily_stats
```

---

## 2. Tables that feed analytics

For each table: schema, write paths, read paths, lifecycle, and the gotchas
you need to know.

### 2.1 `question_submissions` — the source of truth

**Entity:** [`src/entities/question-submission.entity.ts`](../src/entities/question-submission.entity.ts)
**Semantic:** Immutable event log. Every analytics number can be reconstructed
from this table plus the `questions` table.

#### Key columns

| Column | Type | Meaning |
|---|---|---|
| `userId`, `questionId`, `testId`, `contestId` | int | Who answered what, in what context |
| `selectedOptionId` | int? | Final answer. `NULL` = omitted/skipped |
| `firstSelectedOptionId` | int? | What they picked first, before any flips |
| `isCorrect` | bool | Derived: matches the correct option |
| `timeSpentSeconds` | int | Cumulative seconds on this question |
| `answerChanges` | int | Length of `answerSequence` − 1 |
| `rightToWrongChanges` | int | Count of correct→incorrect transitions |
| `answerSequence` | json | `[opt1, opt2, opt3, …]` in order chosen |
| `answerTransitionPattern` | enum | `C_TO_C` / `C_TO_I` / `I_TO_C` / `I_TO_I` / `UNKNOWN` |
| `wasGuessed` | bool | TRUE if very quick (< ~10 s, client-decided) |
| `submittedAt` | timestamp | When the answer was finalized |

#### Write paths

1. **`TestExecutionService.submitAnswer()`** → INSERT-or-UPDATE on every click.
2. **`TestExecutionService.completeTest()` → `evaluateTestState()`** → recomputes
   `isCorrect`, `rightToWrongChanges`, `answerTransitionPattern`,
   `firstSelectedOptionId` for every submission in the test.
3. **`AnalyticsAggregationService.processTestIfNeeded()`** → backfills any
   submission fields still missing.

#### Read paths

- `getUserPerformance` — all submissions for a user
- `getTestResults` — submissions for one `testId`
- `getQBankStatistics` — submissions filtered by `questionBankId`
- `rebuildUserAggregates` — full rebuild from scratch reads everything

#### Lifecycle

Inserted on first answer, updated until test completion, then immutable. Never
deleted *unless* the parent test is deleted (CASCADE behavior depends on
schema — see `removeTest` for the explicit DELETE).

#### Gotchas

- **`isCorrect` is denormalized.** It's recomputed at completion in
  `evaluateTestState`. Until then it reflects what was true when the answer
  was originally saved.
- **`wasGuessed` is set client-side**, then frozen. Changing the threshold
  later doesn't relabel old rows.
- **Submissions reference the question's CURRENT subject/system/topic at read
  time** — not the dimensions at the moment the user answered. This is the
  source of the phantom-dimension bug.

---

### 2.2 `test_analytics_snapshots` — per-test pre-computed analytics

**Entity:** [`src/entities/test-analytics-snapshot.entity.ts`](../src/entities/test-analytics-snapshot.entity.ts)
**Semantic:** A single, immutable, JSONB-heavy snapshot computed once per test
when it completes. Holds the detailed breakdown the test results page needs.

#### Key columns

| Column | Type | Meaning |
|---|---|---|
| `testId` | int UNIQUE | One snapshot per test |
| `userId`, `step` | int | For per-user/per-step reads |
| `totalQuestions`, `attemptedQuestions`, `correctQuestions` | int | Counts |
| `scorePercentage` | decimal | `correct / attempted × 100` |
| `avgTimeSeconds`, `medianTimeSeconds` | decimal | Per-question timing |
| `confidenceScore` | decimal | `clamp(50 + 0.4·pctC→C + 0.2·pctI→C − 0.6·pctC→I − 0.3·highFlipRate, 0, 100)` |
| `overthinkingIndex` | decimal | `avgIncorrectTime − avgCorrectTime` |
| `cohortType`, `cohortSize`, `percentileRank`, `lowConfidence` | mixed | Peer comparison |
| `transitionCounts` | jsonb | `{cToC, cToI, iToC, iToI, unknown}` |
| `timeAccuracyQuadrants` | jsonb | `{fastCorrect, slowCorrect, slowIncorrect, fastIncorrect}` |
| `difficultyAnalytics` | jsonb | per-difficulty breakdown |
| `fatigueSegments` | jsonb | 4-quartile breakdown by question display order |
| `peerComparison` | jsonb | Missed-high-consensus / solved-low-consensus counts |
| `weaknessMap` | jsonb | Per-dimension flags |
| `insights` | json | Array of human-readable hints (max 6) |

#### Write paths

Only `AnalyticsAggregationService.processTestIfNeeded()`. The row is created
once per test; `forceRecompute=true` removes the old row first, never updates
in place.

#### Read paths

- `getTestResults` — primary consumer
- `getUserPerformance.buildAdvancedOverview` — aggregates the last 20 snapshots

#### Lifecycle

Immutable once written. Never auto-rebuilt — admin action or test deletion is
required to trigger a regeneration.

#### Gotchas

- **`confidenceScore` weights are magic numbers** (0.4 / 0.2 / 0.6 / 0.3).
  Document them or surface in admin settings if you change them.
- **`fatigueSegments` is always 4 buckets**, regardless of test length.
- **Percentile cohort logic** — if `blueprintSignature` matches < 20 other
  tests, the cohort falls back to step-wide and sets `lowConfidence = true`.
- **The user's own test is added to the cohort** if it wasn't already in the
  initial cohort — biases the percentile slightly toward the middle.

---

### 2.3 `user_analytics_stats` — per-user-per-step rollup

**Entity:** [`src/entities/user-analytics-stats.entity.ts`](../src/entities/user-analytics-stats.entity.ts)
**Semantic:** One row per `(userId, step)`. Cumulative counters across all
their tests at that step.

#### Key columns

| Column | Type | Meaning |
|---|---|---|
| `userId`, `step` | int UNIQUE | Composite key |
| `testsCompleted`, `questionsAttempted`, `correctAnswers` | int | Lifetime counters |
| `totalTimeSeconds` | int | Cumulative time |
| `cToCCount`, `cToICount`, `iToCCount`, `iToICount` | int | Lifetime transitions |
| `fastCorrectCount`, `slowCorrectCount`, `slowIncorrectCount`, `fastIncorrectCount` | int | Time-accuracy quadrants |
| `totalConfidenceScore`, `confidenceSamples` | decimal/int | Average computed at read time |
| `totalOverthinkingIndex`, `overthinkingSamples` | decimal/int | Same |

#### Write paths

- `AnalyticsAggregationService.updateUserAggregateStats()` — UPSERT increment
  after every test completion
- `AnalyticsAggregationService.rebuildUserAggregates()` — full rebuild reads
  every snapshot and recomputes from scratch

#### Read paths

- `getUserPerformance.buildAdvancedOverview` — derives accuracy, avg
  confidence, avg overthinking by dividing totals by sample counts

#### Lifecycle

Always behind reality until the post-test aggregation completes (~1s after
test completion). Rebuilt from snapshots on demand.

#### Gotchas

- **Averages are not stored directly.** Code always reads
  `totalConfidenceScore / confidenceSamples`. If you ever pre-compute an
  average and stash it, the rollup will drift.
- **Step isolation.** A user has separate rows for Step 1 vs Step 2. Anything
  that mixes "all steps" needs to sum at the read path.

---

### 2.4 `user_dimension_stats` — per-dimension rollup

**Entity:** [`src/entities/user-dimension-stats.entity.ts`](../src/entities/user-dimension-stats.entity.ts)
**Semantic:** One row per `(userId, step, dimensionType, dimensionKey)`.
Stores accuracy and time aggregates per subject/system/topic/difficulty/bank.

#### Key columns

| Column | Type | Meaning |
|---|---|---|
| `userId`, `step` | int | Owner + exam step |
| `dimensionType` | enum | `subject` / `system` / `topic` / `difficulty` / `question_bank` |
| `dimensionKey` | varchar(120) | Stringified ID (e.g. `"42"`) or enum (`"easy"` / `"hard"`) |
| `dimensionName` | varchar(200) | Cached human-readable label |
| `attempted`, `correct` | int | Lifetime counts in this dimension |
| `totalTimeSeconds`, `correctTimeSeconds`, `incorrectTimeSeconds` | int | Time breakdown |
| `cToICount`, `iToCCount` | int | Per-dimension transition counts |

#### Write paths

- `AnalyticsAggregationService.updateUserDimensionStats()` — UPSERT
  per-dimension after every test completion
- `AnalyticsAggregationService.rebuildUserAggregates()` — DELETE-all then
  INSERT-from-scratch reading all of the user's submissions

#### Read paths

- `getUserPerformance.buildAdvancedOverview` — groups by `dimensionType`,
  ranks weakest first

#### Gotchas

- **`dimensionKey` is `varchar` even when the value is an integer ID.**
  Don't compare it without explicit cast.
- **`dimensionName` is cached at write time.** If an admin renames a subject,
  this stays stale until `backfillDimensionNames` runs.
- **Phantom dimensions:** the table is keyed by the question's CURRENT
  dimensions at the time of aggregation. If a question's `subjectId` changes
  later (admin edit or import-script bulk UPDATE), old rows under the old
  subject ID stay around. See
  [`docs/ANALYTICS-DATA-SOURCES.md` §pitfalls](#5-known-pitfalls).

---

### 2.5 `user_daily_stats` — daily activity rollup

**Entity:** [`src/entities/user-daily-stats.entity.ts`](../src/entities/user-daily-stats.entity.ts)
**Semantic:** One row per `(userId, date)`. Feeds the activity heatmap and
the question streak.

#### Key columns

| Column | Type | Meaning |
|---|---|---|
| `userId`, `date` | int, date UNIQUE | UTC day bucket |
| `questionsAttempted`, `correctCount` | int | That day's totals |

#### Write paths

`TestExecutionService.updateDailyStatsAndStreak()` — UPSERT via
`INSERT … ON CONFLICT DO UPDATE`. Fired from `saveSubmissionInBackground`
with no `await`, so a failure here is invisible to the request handler.

#### Read paths

- Home stats activity heatmap (`/api/users/home-stats`)
- Performance overview's 7-day timeline

#### Gotchas

- **UTC date boundary.** A user in UTC−8 solving at 11pm local sees the
  question logged under the next day's row.
- **Fire-and-forget failures are silent.** A transient DB error here will lose
  one increment but the submission itself succeeds. No alerting.

---

### 2.6 `tests` (analytics-relevant fields)

**Entity:** [`src/entities/test.entity.ts`](../src/entities/test.entity.ts)
**Semantic:** Test session row with both denormalized counters and the
authoritative timing fields.

#### Analytics-relevant columns

| Column | Type | Meaning |
|---|---|---|
| `status` | enum | `IN_PROGRESS` / `SUSPENDED` / `COMPLETED` / `ABANDONED` / `NOT_STARTED` |
| `totalQuestions`, `answeredQuestions`, `correctAnswers`, `omittedQuestions` | int | Running and final counts |
| `rightToWrongChanges` | int | Per-test C→I transition tally |
| `percentageScore` | decimal | Final score, set at completion |
| `timeSpentSeconds` | int | Wall-clock for timed, accumulated for tutor |
| `blueprintSignature` | varchar | Hash used to find peers for percentile |
| `completedAt`, `analyticsProcessedAt` | timestamp | Used to detect snapshot freshness |
| `filters` | json | The test's selection criteria (subject/system/topic/bank/difficulty) |

#### Gotchas

- **`omittedQuestions` semantics differ between SUSPENDED and COMPLETED.** See
  inline comments in `evaluateTestState`.
- **Running counters can drift from snapshot** if the user re-answers after
  a `COMPLETED` state. (Doesn't normally happen but worth knowing.)

---

### 2.7 `questions` (analytics-relevant fields)

**Entity:** [`src/entities/question.entity.ts`](../src/entities/question.entity.ts)
**Semantic:** Question metadata + denormalized lifetime answer counters.

| Column | Type | Meaning |
|---|---|---|
| `subjectId`, `systemId`, `topicId`, `questionBankId`, `step` | int | Dimensional attribution |
| `timesAnswered`, `timesCorrect` | int | Lifetime counters used for "global accuracy" |
| `isActive` | bool | Soft-delete |
| `difficulty` (getter) | enum | Computed from the correct option's `uworld_chosen_by` |

#### Gotchas

- **`timesAnswered`/`timesCorrect` are incremented only by
  `processTestIfNeeded`**, not by every submit. They can theoretically drift
  if test deletions occur (no reconciliation job).
- **`difficulty` is a getter, not a column.** Changes whenever the correct
  option's `uworld_chosen_by` changes. Old analytics rows in
  `user_dimension_stats` keyed by `difficulty = 'hard'` won't update.
- **Import scripts overwrite `subjectId`/`systemId`/`topicId`** by bulk
  UPDATE — silent dimension drift. See [§5 pitfalls](#5-known-pitfalls).

---

### 2.8 `users` (analytics-relevant fields)

**Entity:** [`src/entities/user.entity.ts`](../src/entities/user.entity.ts)

| Column | Meaning |
|---|---|
| `rating`, `maxRating`, `ratingTier` | Contest-driven, used in leaderboard |
| `contestsParticipated` | Lifetime contest count |
| `questionStreak`, `longestQuestionStreak`, `lastQuestionDate` | Daily activity streak |

Streak updates are fire-and-forget from `updateDailyStatsAndStreak`.

---

### 2.9 `contest_participants` (analytics-relevant fields)

**Entity:** [`src/entities/contest-participant.entity.ts`](../src/entities/contest-participant.entity.ts)

| Column | Meaning |
|---|---|
| `totalScore`, `correctAnswers`, `wrongAnswers`, `unansweredQuestions` | Contest result counters |
| `timeSpentSeconds`, `accuracyPercentage`, `rank`, `percentile` | Final standings |
| `oldRating`, `ratingChange` | Rating delta from this contest |
| `performanceBySubject`, `behaviorSummary` | JSONB breakdowns |

Contest analytics are stored separately from the test pipeline — they do NOT
contribute to `user_analytics_stats` or `user_dimension_stats`.

---

## 3. Read endpoints map

| Endpoint | Service method | Primary tables read | Purpose |
|---|---|---|---|
| `GET /api/tests/performance/overview?step=X&qBankId=Y` | `TestAnalyticsService.getUserPerformance` | All five aggregation tables + `question_submissions` | High-level performance |
| `GET /api/tests/:id/results` | `TestAnalyticsService.getTestResults` | `tests`, `question_submissions`, `test_analytics_snapshots` | Per-test breakdown |
| `GET /api/tests/performance/statistics?qBankCode=X&step=Y` | `TestAnalyticsService.getQBankStatistics` | `question_banks`, `question_submissions`, `tests` | Bank usage + peer percentile |
| `GET /api/users/home-stats` | `UsersService.getHomeStats` | `users`, `user_daily_stats`, `user_special_badges`, `tests` | Home dashboard |
| `GET /api/users/:userId/stats` | `UsersService.getUserStats` | `users`, `question_submissions`, `contest_participants` | Public profile |
| `GET /api/users/leaderboard` | `UsersService.getLeaderboard` | `users` (sorted by rating) | Global ranking |
| `GET /api/contests/:id/standings` | `ContestsService.getStandings` | `contest_participants` | Contest table |

---

## 4. Glossary

- **Step** — USMLE / MRCP exam stage (1, 2, 3, MR1, MR2). Everything scoped per step.
- **Dimension** — A categorical axis used to group analytics: `subject`, `system`, `topic`, `difficulty`, or `question_bank`.
- **Snapshot** — A frozen, JSONB-heavy analytics row for one test, computed at completion.
- **Cohort** — Peer set used for percentile. Either *blueprint-matched* tests (preferred) or *step-wide* (fallback, `lowConfidence = true`).
- **Blueprint signature** — Hash of `filters` (subjects/systems/topics/banks/difficulty/modes). Two tests with identical blueprints are peers.
- **Transition pattern** — How the user's answer evolved:
  - `C_TO_C` — confident, right throughout
  - `C_TO_I` — second-guessed into wrong (overthinking)
  - `I_TO_C` — corrected to right
  - `I_TO_I` — persistent misconception
  - `UNKNOWN` — insufficient sequence data
- **Confidence score** — `clamp(50 + 0.4·pctC→C + 0.2·pctI→C − 0.6·pctC→I − 0.3·highFlipRate, 0, 100)`. Magic numbers; don't take them as ground truth.
- **Overthinking index** — `avgIncorrectTime − avgCorrectTime`. Positive = wasting time on wrongs.
- **Accuracy** — `correct / attempted × 100`. Omitted questions are NOT counted in the denominator.
- **Weakness map** — Dimensions where `accuracy < 60%` OR `(accuracy < 70% AND avgTime > 1.2 × medianTime)`.
- **Percentile rank** — `round((cohortSize − rank) / cohortSize × 100)`. **Ranges from 0 (bottom of cohort) to ~100 (top).** Bottom-ranked user gets exactly 0; top-ranked typically sees 99 due to rounding when cohort size is small.
- **Low confidence (percentile)** — Cohort under 20 → unreliable.
- **Accuracy** — `correct / attempted × 100`. **Omitted questions are NOT in the denominator.** Note that test-results dimension breakdowns (by subject/system/topic) use *all questions in the test for that dimension* as denominator, including omitted ones — so the same test can show different accuracy on the overview page vs. the per-dimension breakdown.

---

## 5. Known pitfalls

### 5.1 Phantom dimensions after re-categorization

The single biggest gotcha. Two ways this happens:

| Trigger | What changes |
|---|---|
| Admin edits a question's `subjectId`/`systemId`/`topicId` in the admin UI | Single-question UPDATE on `questions` |
| Anyone runs `npm run import:step*` or any of the `src/database/*` scripts | Bulk UPDATE on `questions` for hundreds or thousands of rows at once |

In both cases the user's existing `user_dimension_stats` rows still reference
the *previous* dimensions. The next time aggregation runs for that user, new
rows are created under the new dimensions but the old rows aren't removed.

**Fix for one user:** delete their `user_dimension_stats` then call
`AnalyticsAggregationService.rebuildUserAggregates(userId, step)`.

**Fix going forward (recommended):** snapshot
`subjectId`/`systemId`/`topicId` on `question_submissions` at INSERT time
(new columns) and read from the snapshot at aggregation. The user's history
becomes immune to question re-categorization.

### 5.2 Stale `dimensionName`

`dimensionName` is cached at INSERT into `user_dimension_stats`. Renaming a
subject doesn't refresh it. Run `backfillDimensionNames` to fix.

### 5.3 `wasGuessed` threshold drift

Set client-side at submission time. Changing the threshold later doesn't
re-label old rows.

### 5.4 Difficulty getter is dynamic

`Question.difficulty` is computed from the correct option's
`uworld_chosen_by` rate. Admin edits to the option silently change the
question's bucket. Old `user_dimension_stats` rows keyed by the old
difficulty stay until rebuild.

### 5.5 Cohort always includes the user's own test

In `calculatePercentile`, if the user's test isn't already in the cohort,
it's pushed in. This inflates cohort size by one and slightly biases
percentile toward the median.

### 5.6 Streaks update UTC, not local

Activity recorded against the UTC calendar day. A user in UTC−8 solving at
11pm local logs the question against tomorrow.

### 5.7 Daily stats are fire-and-forget

`updateDailyStatsAndStreak` is called without `await`. A transient DB error
here loses that day's question-count increment silently — the answer itself
still saves, but the heatmap row and streak counter aren't updated. No
alerting; you discover it only via the gap in the heatmap.

### 5.8 Contest analytics don't feed the main pipeline

Contest submissions live in `contest_participants` only. `correctAnswers`,
`questionsAttempted`, etc. in `user_analytics_stats` come exclusively from
the test pipeline. The user's profile "total solved" counter (read directly
from `question_submissions` via `isCorrect = true`) does NOT distinguish
contest vs test answers — depends on the read query.

### 5.9 Race condition in `user_analytics_stats` rollup updates

`AnalyticsAggregationService.updateUserAggregateStats` does a classic
read-modify-write: load the row into memory, increment fields in JS, then
`.save()`. If two tests for the same `(userId, step)` complete at virtually
the same time, both processes load the same starting state, each adds its
own delta, and both call `.save()` — the second write overwrites the first,
losing the first test's counters silently.

In practice this is rare for a single user (you don't usually complete two
tests in the same millisecond), but it's worth knowing.

**Proper fix:** replace the read-modify-write with an atomic
`UPDATE user_analytics_stats SET testsCompleted = testsCompleted + 1, …`
query, or wrap the read+update in a row-level lock
(`SELECT … FOR UPDATE`).

### 5.10 `highFlipRate` only counts ≥2 changes

The `confidenceScore` formula uses `highFlipRate`, which counts questions
with `answerChanges >= 2` (i.e. the user picked at least three different
options across the test). A single change (one flip from A to B) does NOT
contribute to `highFlipRate`. If you're tuning the confidence formula, this
threshold matters more than the magic-number weight does.

---

## 6. Common questions

### "How do I see all of user X's stats?"

```sql
-- Overall rollup
SELECT step, "testsCompleted", "questionsAttempted", "correctAnswers",
       ("correctAnswers"::float / NULLIF("questionsAttempted", 0) * 100) AS accuracy
  FROM user_analytics_stats
 WHERE "userId" = $1;

-- Per-dimension breakdown
SELECT step, "dimensionType", "dimensionKey", "dimensionName",
       attempted, correct,
       (correct::float / NULLIF(attempted, 0) * 100) AS accuracy
  FROM user_dimension_stats
 WHERE "userId" = $1
 ORDER BY step, "dimensionType", "dimensionKey";
```

### "When does an aggregation rebuild happen automatically?"

1. After every test completion (`processTestIfNeeded`).
2. When a test is deleted (`removeTest` → `rebuildUserAggregates(step)`).
3. Manually, from a one-off admin handler.

There is **no scheduled rebuild** — re-imports leave phantoms until something
on the above list fires.

### "What gets touched when a question's subject/system/topic changes?"

- `questions` row UPDATE
- Question / explanation / bank-total caches invalidated
- **Nothing else.** `user_dimension_stats` rows are not migrated.

### "Where does the home page heatmap come from?"

`user_daily_stats`, joined with the user's `questionStreak` from `users`.

### "Where does the leaderboard rank come from?"

`SELECT COUNT(*) FROM users WHERE rating > $userRating AND "isActive" = true`.
Note: inactive users are excluded — admin actions can shift other users'
displayed rank.

---

## 7. Suggested follow-ups

1. **Immutable dimension snapshot on submissions.** Adds three columns to
   `question_submissions`; eliminates phantom dimensions.
2. **Post-import hook** in the import scripts to enqueue
   `rebuildUserAggregates` for every affected user.
3. **Periodic reconciliation cron** that checks for
   (`user_dimension_stats` rows with no matching current question) and
   reports counts.
4. **Document and surface the confidence-score weights** in admin settings
   so they can be retuned without a redeploy.
5. **Move from `Math.round` to a `Math.floor`/`Math.ceil` policy** for
   percentile display so the user-facing range is `[0, 100]` without losing
   "you are at the very bottom" / "very top" semantics.

---

**Last updated:** 2026-05-29 (initial draft)
