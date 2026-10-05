# API reference (frontend helpers)

Base URL comes from `VITE_API_URL` (e.g. `https://medhvgg-production.up.railway.app/api`). All requests carry `Authorization: Bearer <token>` where required, and responses may be AES-256-GCM encrypted envelopes — `src/api/client.ts` handles both.

## QBank & tests — `src/api/tests.ts`

| Helper | Endpoint | Parameters | Returns |
|---|---|---|---|
| `getMainBanks(step)` | `GET /tests/metadata/main-banks` | `step` | `MainBank[]` (id, name, code, step) |
| `getQuestionBanks(step?, mainBankId?)` | `GET /tests/metadata/question-banks` | `step`, `mainBankId` | `QuestionBankWithProgress[]` |
| `getPerformanceOverview(step)` | `GET /tests/performance/overview` | `step` | `PerformanceOverview` + `PerformanceSummary` |
| `getQbankStatistics(qBankCode, step)` | `GET /tests/performance/statistics` | `qBankCode`, `step` | `QbankStatistics` — **423 when the block is locked** |
| `getQuestionCounts(step, filters)` | `GET /tests/counts` | `step`, filters | `QuestionCounts` per mode |
| `getMixedModeCount(step, filters)` | `GET /tests/counts/mixed` | `step`, filters incl. `modes` | `{ count }` |
| `getDifficultyCounts(step, questionBankIds)` | `GET /tests/metadata/difficulty-counts` | `step`, bank ids | per-tier counts |
| `getSubjects(step, questionBankIds, mode='all')` | `GET /tests/metadata/subjects` | `step`, bank ids, `mode` | `SubjectCount[]` |
| `getSystemsWithTopics(step, filters)` | `GET /tests/metadata/systems-with-topics` | `step`, filters | `SystemWithTopics[]` (systems with topics + counts) |
| `getPreviousTests(step?, qBankId?)` | `GET /tests` | `step`, `qBankId` | `TestListItem[]` |
| `createTest(payload)` | `POST /tests` | see `CreateTestDto` | created test |
| `retrieveTestQuestions(testId)` | `POST /tests/retrieve-questions` | test id | external / UW question IDs |

### Exported types

`MainBank` · `PerformanceSummary` · `PerformanceOverview` · `QuestionBankWithProgress` · `QuestionCounts` · `SubjectCount` · `SystemWithTopics` · `QbankStatistics` · `TestListItem` · `DifficultyTier`

`DifficultyTier = 'very_hard' | 'hard' | 'medium' | 'easy' | 'very_easy'`

### Filters used by count/metadata endpoints

```ts
{
  questionBankIds: number[],
  subjectIds?: number[],
  systemIds?: number[],
  topicIds?: number[],
  difficulty?: DifficultyTier[],
  modes?: string[],          // mixed-mode counting only
}
```

## Test lifecycle endpoints (used by the upcoming runner)

Not yet wrapped by frontend helpers, but available and verified in the backend:

| Endpoint | Purpose |
|---|---|
| `GET /tests/:id` | Full test + watermarked questions/options/explanations; includes `currentQuestionId`, `totalQuestions`, `answeredQuestions`, `timeLimitSeconds`, `blockResultsLocked` |
| `POST /tests/:id/submit` | Submit one answer (`SubmitAnswerDto`) |
| `POST /tests/:id/submit-batch` | Bulk submit for timed End-Block (`SubmitAnswersBatchDto`) |
| `PUT /tests/:id/complete` · `/suspend` · `/resume` | Lifecycle |
| `GET /tests/:id/results` | Results + analytics |
| `GET /tests/:id/questions/:questionId/explanation` | Explanation HTML |
| `POST /tests/:id/questions/:questionId/ai-explain` (+ cache GET) | AI-generated explanation |
| `PATCH /tests/:id/mark` | Toggle "marked for review" (does not create a submission) |
| `PATCH /tests/:id/highlights` | Persist highlights |
| `PATCH /tests/:id/name` · `DELETE /tests/:id` | Rename / delete test |
| `GET /tests/practice/:questionId` · `POST /tests/practice/:questionId/submit` | Single-question practice mode |
| `GET /tests/search/questions` | Question search |
| `POST /tests/feedback` | Question feedback |

## Library — `src/api/library.ts`

Structure, articles, and annotation endpoints per source, with HTTP 423 handling for locked sources.

## Auth — `src/api/auth.ts`

Login, register, verify-email (OTP), forgot/reset password, complete-profile.

## Users — `src/api/users.ts`

Profile and preferences.

## Notebook — `src/api/notebook.ts`

Notebook entries used by the Library drawer.

## Status codes worth handling

| Code | Meaning | Frontend behaviour |
|---|---|---|
| 423 | Locked / incomplete block data | Friendly locked panel (Welcome statistics, Library structure) |
| 400 | Validation failure (e.g. invalid `mode`) | Surface the message |
| 401 / 403 | Missing/invalid token or `TestAccessGuard` denial | Re-auth / access denied state |