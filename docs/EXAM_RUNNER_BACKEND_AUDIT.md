# Exam Runner Backend Audit

**Canonical backend:** `geminiamo0-ship-it/medhvgg` → `main`  
**Status:** DESIGN discovery evidence for Issue #4  
**Date:** 2026-10-06

This document records the current backend capabilities relevant to the future Exam Runner. It is not a UI spec and does not authorize implementation.

## 1. Core exam lifecycle already exists

Canonical controller: `src/tests/tests.controller.ts`.

Verified endpoints relevant to the runner:

- `GET /api/tests/:id` — fetch test + ordered questions + current state.
- `POST /api/tests/:id/submit` — Tutor/Mixed per-question answer submission.
- `POST /api/tests/:id/submit-batch` — Timed End-Block atomic batch submit.
- `PATCH /api/tests/:id/highlights` — persist question/explanation highlights independently of answer submission.
- `PATCH /api/tests/:id/mark` — persist mark-for-review independently of answer submission.
- `GET /api/tests/:id/questions/:questionId/explanation` — lazy explanation retrieval.
- `POST /api/tests/:id/questions/:questionId/ai-explain` — AI explanation generation.
- `GET /api/tests/:id/questions/:questionId/ai-explain/cache` — check cached AI explanation without generation/quota use.
- `PUT /api/tests/:id/complete` — complete test.
- `PUT /api/tests/:id/suspend` — suspend test.
- `PUT /api/tests/:id/resume` — resume suspended test.
- `POST /api/tests/feedback` — question feedback.
- `GET /api/tests/:id/results` — results + analytics.

`GET /api/tests/:id` already returns runner-critical state including ordered questions, answer state, `isMarked`, isolated highlight data, omitted state, resume question information, timing fields and block-results locking. Server-side answer reveal differs by test type/status; frontend must not recreate correctness rules.

Question/option/explanation HTML is protected by existing access/content-security guards and server-side watermarking.

## 2. Highlight / marker model

Current backend supports two separate concepts:

### Highlight / text marker
`PATCH /api/tests/:id/highlights`

Stored separately from submissions. Highlight descriptors contain:
- selected text;
- start/end indices;
- color;
- source: `question` or `explanation`.

Highlights can exist before answer submission and can remain editable during completed-test review.

### Mark for review
`PATCH /api/tests/:id/mark`

Stored independently from submissions, so marking an unanswered question does not create a fake answer/omitted row.

## 3. Question notes

Canonical area: `src/notes/`.

Verified endpoints:
- `GET /api/notes`
- `GET /api/notes/question/:questionId`
- `GET /api/notes/question/:questionId/preview`
- `POST /api/notes` — create/update note for a question
- `PUT /api/notes/:id`
- `DELETE /api/notes/:id`

Question notes are explicitly linked by `questionId` and are suitable for an optional Exam Runner question-note tool.

## 4. Notebook

Canonical area: `src/notebook/`.

Verified endpoints:
- `GET /api/notebook`
- `GET /api/notebook/:id`
- `POST /api/notebook`
- `PUT /api/notebook/:id`
- `DELETE /api/notebook/:id`

Important: the current Notebook DTO is a general personal notebook model (`title`, `content`, `category`). It is **not directly linked to `questionId`** in the current contract.

Therefore Notes and Notebook must stay separate in the frontend mental model unless a deliberate product/backend decision changes this later.

## 5. Flashcards

Canonical area: `src/flashcards/`.

Runner-relevant capabilities already exist:
- `GET /api/flashcards/question/:questionId` — cards linked to the current question.
- `POST /api/flashcards` — create card; DTO supports optional `questionId`, deck selection or inline deck creation, front/back content blocks, colors/marking/rating.
- `GET /api/flashcards/decks`
- deck CRUD
- flashcard CRUD/search
- append content to an existing card
- study state/session/rating
- bury / suspend / unsuspend / reschedule
- Anki `.apkg` export.

This is sufficient for a theme to expose “create/view flashcard from this question” without inventing new persistence.

## 6. Reference ranges / lab values

Canonical endpoint:
- `GET /api/lab-values`

Backend returns lab values grouped by category. A theme can expose or hide a Reference Range tool while reusing this common endpoint.

## 7. Frontend/local tools with no dedicated exam endpoint required

Current audit found no dedicated exam endpoint requirement for:
- fullscreen;
- calculator UI;
- responsive layout;
- theme component composition;
- next/previous keyboard navigation itself.

These are frontend concerns unless later product requirements introduce persisted state.

## 8. Existing backend theme infrastructure

The backend already has a viewer-theme concept:

`QuestionBank.viewerThemeProfile`

Current enum values:
- `standard_exam`
- `mrcp_passmedicine`
- `mrcp_pastest`

Every created Test also stores:

`viewerThemeProfileSnapshot`

This is valuable because a test can remain pinned to the intended viewer profile even if bank metadata changes later.

Current backend resolver also maps bank codes into the existing viewer profiles.

### New product requirement
The user wants a frontend architecture that can support independent themes such as:
- UWorld;
- NBME;
- Amboss;
- MRCP / Passmedicine-like;
- MRCP Mock Exam;
- future themes.

Do not implement these as scattered `if (theme === ...)` branches.

Design target:
- one Exam Core owns lifecycle/state/API integration;
- theme registry owns presentation and capability visibility;
- each theme has isolated files/components/tokens;
- backend-backed actions are exposed to themes through a small typed controller/capability interface;
- a theme can enable/disable tools such as flashcards, notebook, notes, calculator, lab values, AI explanation, etc.;
- hidden tools remain available in the shared core and do not require duplicated API code.

Whether the backend enum is expanded or a frontend presentation registry maps existing snapshots/bank codes to richer visual themes will be decided during design. No backend change is authorized by this audit alone.

## 9. Capability ownership rule

### Exam Core owns
- fetch/resume test;
- answer state;
- Tutor/Timed/Mixed lifecycle;
- timing state supplied by backend contract;
- submit / batch submit;
- mark persistence;
- highlight persistence;
- notes adapter;
- flashcard adapter;
- notebook adapter;
- lab-values adapter;
- explanation/AI adapter;
- suspend/resume/complete;
- results/review integration;
- network/error/retry/reload orchestration.

### Theme owns
- visual shell;
- toolbar/control placement;
- typography/spacing/colors;
- question/options presentation;
- responsive transformation;
- which optional core capabilities are visible;
- theme-specific visual states and interaction presentation.

Themes must not call Axios/API modules directly.

## 10. Verification checklist for design phase

- [x] Canonical tests controller re-inspected.
- [x] Test DTOs re-inspected.
- [x] Test retrieval/execution behavior re-inspected.
- [x] Question notes controller/DTO re-inspected.
- [x] Notebook controller/DTO re-inspected.
- [x] Flashcards controller/DTO re-inspected.
- [x] Lab-values endpoint re-inspected.
- [x] Existing `viewerThemeProfile` / `viewerThemeProfileSnapshot` infrastructure identified.
- [ ] Re-inspect current frontend `TestPage.tsx` before visual design decisions.
- [ ] Review old/reference runner behavior where useful.
- [ ] Discuss and approve theme contract/capability matrix with the user.
- [ ] Discuss UWorld theme in detail first.
- [ ] Write approved `docs/page-specs/EXAM_RUNNER.md` before implementation.
