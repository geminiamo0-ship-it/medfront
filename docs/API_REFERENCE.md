# API reference (frontend helpers)

The frontend talks to the **canonical backend** in `geminiamo0-ship-it/medhvgg/main`; the deployed base URL currently comes from `VITE_API_URL` (for example `https://medhvgg-production.up.railway.app/api`).

All authenticated requests carry `Authorization: Bearer <token>`. Responses may be AES-256-GCM encrypted envelopes; `src/api/client.ts` handles transport decryption before data reaches callers.

> `medfront/backend` is a reference snapshot only. When a contract matters, verify it against current `medhvgg/main` controller/DTO/service code.

## QBank & tests — current `src/api/tests.ts`

| Helper | Endpoint | Parameters | Returns |
|---|---|---|---|
| `getMainBanks(step)` | `GET /tests/metadata/main-banks` | `step` | `MainBank[]` |
| `getQuestionBanks(step?, mainBankId?)` | `GET /tests/metadata/question-banks` | `step`, `mainBankId` | `QuestionBankWithProgress[]` |
| `getPerformanceOverview(step)` | `GET /tests/performance/overview` | `step` | `PerformanceOverview` + summary |
| `getQbankStatistics(qBankCode, step)` | `GET /tests/performance/statistics` | `qBankCode`, `step` | `QbankStatistics`; block data may return **423** when locked |
| `getQuestionCounts(step, filters)` | `POST /tests/counts` | body `{ step, filters }` | `QuestionCounts` per mode |
| `getMixedModeCount(step, filters)` | `POST /tests/counts/mixed` | body `{ step, filters }` incl. `modes` | `{ count }` |
| `getDifficultyCounts(step, questionBankIds)` | `POST /tests/metadata/difficulty-counts` | body | per-tier counts |
| `getSubjects(step, questionBankIds, mode='all')` | `POST /tests/metadata/subjects` | body | `SubjectCount[]` |
| `getSystemsWithTopics(step, filters)` | `POST /tests/metadata/systems-with-topics` | body | `SystemWithTopics[]` |
| `getPreviousTests(step?, qBankId?)` | `GET /tests` | query `step`, `qBankId` | `TestListItem[]` |
| `createTest(payload)` | `POST /tests` | `CreateTestDto`-shaped body | created test id/current server response |
| `createAmbossArticleTest({ articleId, bankId, title })` | `POST /tests` | `filters: { articleId: internal library_articles.id, questionBankIds: [AMBOSS bank] }`; Tutor + Unused, Step 1 | `{ id }`; backend validates source/entitlement/quota |
| `retrieveTestQuestions(testId)` | `POST /tests/retrieve-questions` | body `{ testId }` | imported/UW question IDs |

### Exported frontend types

Current module exports types including:

`MainBank` · `PerformanceSummary` · `PerformanceOverview` · `QuestionBankWithProgress` · `QuestionCounts` · `SubjectCount` · `SystemWithTopics` · `QbankStatistics` · `TestListItem` · `DifficultyTier`

`DifficultyTier = 'very_hard' | 'hard' | 'medium' | 'easy' | 'very_easy'`

Some current helpers still use broad request/response types. Tighten them when the related feature is active rather than propagating unsafe casts into new code.

### Filters used by count/metadata endpoints

Conceptually:

```ts
{
  questionBankIds: number[],
  subjectIds?: number[],
  systemIds?: number[],
  topicIds?: number[],
  difficulty?: DifficultyTier[],
  modes?: string[],
}
```

The exact DTO validation is backend-authoritative. In particular, multi-mode test creation uses the backend enum value `mixed_modes`, not `mixed`.

## Test lifecycle endpoints for the Exam Runner

These are available in the canonical backend but are not all wrapped by the current frontend helper module yet. Re-verify DTOs immediately before implementing the runner.

| Endpoint | Purpose |
|---|---|
| `GET /tests/:id` | Full owned test + watermarked question/option/explanation content and test state |
| `POST /tests/:id/submit` | Submit/update one answer (`SubmitAnswerDto`) |
| `POST /tests/:id/submit-batch` | Atomic timed-mode End-Block batch submit (`SubmitAnswersBatchDto`) |
| `PATCH /tests/:id/mark` | Persist mark-for-review independently of answer submission |
| `PATCH /tests/:id/highlights` | Persist question highlights |
| `GET /tests/:id/questions/:questionId/explanation` | Lazy explanation payload |
| `POST /tests/:id/questions/:questionId/ai-explain` | Generate/request AI explanation within backend quota/access rules |
| `GET /tests/:id/questions/:questionId/ai-explain/cache` | Check cached AI explanation without generation |
| `PUT /tests/:id/complete` | Complete test |
| `PUT /tests/:id/suspend` | Suspend supported test state |
| `PUT /tests/:id/resume` | Resume suspended test |
| `GET /tests/:id/results` | Results + server analytics |
| `PATCH /tests/:id/name` | Rename test |
| `DELETE /tests/:id` | Delete test through server semantics |
| `GET /tests/practice/:questionId` | Watermarked single-question practice fetch |
| `POST /tests/practice/:questionId/submit` | Practice answer/check |
| `GET /tests/search/questions` | Search by supported ID mode |
| `POST /tests/feedback` | Submit question feedback |

### Runner authority rules

- Backend owns access, correctness, scoring, completion, result locking and persistence.
- Timed flows must not expose correct answers/explanations before backend semantics allow them.
- Preserve server watermarking and sanitize HTML before rendering.
- Treat retry/idempotency/reload behavior as an end-to-end contract, not a purely visual concern.

## Library — `src/api/library.ts`

Current frontend wraps structure/articles/search/read/bookmark/highlight/AI-summary-related behavior. Canonical backend additionally owns content quota/access/watermarking and AI quota decisions.

## Auth — `src/api/auth.ts`

Login, register, verify-email/OTP, forgot/reset password, complete-profile/current-session flows as currently wrapped.

## Users — `src/api/users.ts`

Current frontend profile/preferences helpers. Canonical backend has additional user/privacy/home-stat capabilities to audit when Settings becomes active.

## Notebook — `src/api/notebook.ts`

Notebook entry operations used by the Library drawer. The backend also has a separate question-notes domain; define their UX relationship before exposing both broadly.

## Status codes worth modeling intentionally

| Code | Meaning | Frontend expectation |
|---|---|---|
| 400 | Validation/domain failure | Show specific actionable validation/domain state |
| 401 | Authentication/session failure | Re-auth/session-expired behavior |
| 403 | Authorized identity lacks permission/access | Access-denied/entitlement behavior |
| 423 | Locked/incomplete domain data | Friendly locked state, not generic failure |
| 429 | Rate limit/quota exhausted | Specific retry/quota UI using server information when available |
| 5xx | Backend/service failure | Recoverable server-error state; do not mislabel as validation |

For any newly implemented endpoint, update this document or the relevant page spec with the exact current contract verified from `medhvgg/main`.

## Results V1

`GET /tests/:id/results` uses the canonical backend owner/entitlement checks and returns `{ test, analytics: { overall, sessionBreakdown? }, advancedAnalytics }`. `sessionBreakdown` has total/answered/correct/incorrect/omitted, persisted five-tier `byDifficultyTier` (including unclassified when missing) and `studyRecommendations` containing only primary topic names with session correct/total. Frontend client is `src/features/results/api.ts`. Existing snapshot remains managed by backend; no ranking/AI/estimated Step scores in V1.
