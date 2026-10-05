# Backend — the `tests` module

Source: `backend` branch, `src/tests/`. This module drives the entire QBank frontend, so its contract is worth knowing precisely.

## Controller routes (`src/tests/tests.controller.ts`)

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/tests` | create a test |
| `GET` | `/tests` | list previous tests |
| `POST` | `/tests/counts` | per-mode counts |
| `POST` | `/tests/counts/mixed` | counts across multiple modes |
| `GET` | `/tests/metadata/main-banks` | providers for a step |
| `GET` | `/tests/metadata/question-banks` | question banks (+ progress) |
| `POST` | `/tests/metadata/difficulty-counts` | per-tier counts |
| `POST` | `/tests/metadata/subjects` | subjects with counts |
| `POST` | `/tests/metadata/systems-with-topics` | systems + topics + counts |
| `GET` | `/tests/metadata/systems` · `/tests/metadata/topics` | raw metadata |
| `GET` | `/tests/performance/overview` | dashboard performance |
| `GET` | `/tests/performance/statistics` | per-bank statistics (**423 when locked**) |
| `POST` | `/tests/retrieve-questions` | external/UW IDs of an existing test |
| `GET` | `/tests/:id` | full test with watermarked questions |
| `POST` | `/tests/:id/submit` | submit one answer |
| `POST` | `/tests/:id/submit-batch` | bulk submit (timed End-Block) |
| `PUT` | `/tests/:id/complete` · `/suspend` · `/resume` | lifecycle |
| `GET` | `/tests/:id/results` | results + analytics |
| `GET` | `/tests/:id/questions/:questionId/explanation` | explanation HTML |
| `POST` | `/tests/:id/questions/:questionId/ai-explain` (+ cache `GET`) | AI explanation |
| `PATCH` | `/tests/:id/highlights` · `/tests/:id/mark` | highlights, mark-for-review |
| `PATCH` | `/tests/:id/name` · `DELETE /tests/:id` | rename, delete |
| `GET` | `/tests/search/questions` | question search |
| `GET`/`POST` | `/tests/practice/:questionId` (+ `/submit`) | single-question practice |
| `POST` | `/tests/feedback` | question feedback |

`GET /tests/:id` is guarded by `TestAccessGuard` and **watermarks** all HTML (question text, options, explanations) with the caller's identity before returning it.

## `TestMode` (`src/entities/test.entity.ts`)

```
UNUSED           = 'unused'
INCORRECT        = 'incorrect'
CORRECT          = 'correct'
USED             = 'used'
MARKED           = 'marked'
MARKED_CORRECT   = 'marked_correct'
MARKED_INCORRECT = 'marked_incorrect'
OMITTED          = 'omitted'
SUSPENDED        = 'suspended'
ALL              = 'all'
MIXED            = 'mixed_modes'      // ← note the value
```

`CreateTestDto.mode` is validated with `@IsEnum(TestMode)`, so **only these strings are accepted**. Multi-mode tests must send `mode: "mixed_modes"` together with `filters.modes[]`; the creation service throws when `filters.modes` is missing/empty for a mixed test.

Test statuses include `in_progress`, `completed`, and `suspended`.

## `CreateTestDto` essentials

| Field | Notes |
|---|---|
| `qBankId` | question bank the test belongs to |
| `type` | `tutor` or `timed` |
| `mode` | a `TestMode` value (see above) |
| `totalQuestions` | requested size |
| `name`, `isBlock` | optional naming / block form |
| `timeLimitSeconds` | **required for timed** unless `isBlock` |
| `filters` | `modes`, `difficulty`, `subjectIds`, `systemIds`, `topicIds`, `questionBankIds` |
| `customQuestionIds` | explicit question IDs for custom tests |

Creation-service rules worth remembering:

- Custom IDs require `filters.questionBankIds` → otherwise `Custom tests require selecting a question bank.`
- Custom IDs are matched against the selected bank, restricted to **unused** questions, capped at **50**.
- Timed tests get a per-question time budget (`blockSecondsPerQuestion` for blocks).
- Selection history, answer sequence, highlights and notes can be attached to a submission.

## Services (`src/tests/services/`)

| Service | Role |
|---|---|
| `test-creation.service.ts` | builds tests from filters or custom IDs, block generation, time limits |
| `test-metadata.service.ts` | subjects, systems/topics, counts (cached) |
| `test-execution.service.ts` | answering, grading, completion |
| `test-retrieval.service.ts` | `getTest()` payload: questions, `currentQuestionId`, progress, timer state |
| `test-ai.service.ts` | AI explanations |
| `question-search.service.ts` | question search / practice |
| `block-generation.service.ts` | block/form assembly |

Utils: `src/tests/utils/block-group-integrity.util.ts`, `src/utils/question-difficulty.util.ts`.

## Retrieval behaviour that shapes the runner UI

`test-retrieval.service.getTest()`:

- auto-completes an in-progress timed test when elapsed time reaches `timeLimitSeconds`, then returns it as `completed`
- returns `{ blockResultsLocked, omittedQuestionIds, questions: [] }` when a block's results are locked — the UI must show a locked state, not an empty test
- each question carries `textHtml`, `options[]` (with per-option `textHtml` / `explanationHtml`), and a `status`
- includes `totalQuestions`, `answeredQuestions`, `timeLimitSeconds`, `timeSpentSeconds`, and a suggested `currentQuestionId`

## Submission payloads

`SubmitAnswerDto`: `questionId`, `selectedOptionId?` (null/omitted = skipped), `timeSpentSeconds?`, `answerSequence?[]`, `selectionHistory?[]`, `highlights?[]`, `isMarked?`, `notes?`

`SubmitAnswersBatchDto`: `answers[]` (`TimedBatchItemDto`, max 200), `complete: boolean`, `totalTimeSpentSeconds?` — used for timed End-Block (`complete` must be true today).