# Roadmap — known issues & priorities

## P0 — Create Test correctness

These break real test creation and should land together in one focused change.

### 1. Multi-mode tests are rejected by the API
- `src/pages/qbank/CreateTestPage.tsx:193` sends `mode: "mixed"` when 2+ question modes are selected.
- Backend `TestMode.MIXED = "mixed_modes"` (`src/entities/test.entity.ts`) and `CreateTestDto.mode` is validated with `@IsEnum(TestMode)` → **400**.
- Fix: send `"mixed_modes"` whenever more than one mode is selected; single mode → that mode; custom → `"all"`. `filters.modes` is already sent and is required for mixed tests.

### 2. Custom UW-ID validation silently truncates
- `CreateTestPage.tsx:105` uses `.slice(0, 50)`, so IDs beyond 50 are dropped without warning and the red ">50" counter state is unreachable.
- Fix: keep all parsed IDs, surface non-numeric entries, disable Create when over 50, and show the server's rules (unused only, selected bank only, max 50).

### 3. Systems matrix / topic search shrink on selection
- `CreateTestPage.tsx:158` queries `getSystemsWithTopics` with the same `filters` object used for creation, which includes selected `systemIds` and `topicIds`.
- Effect: picking a system refetches only that system (and topics narrow further), so the matrix and the global topic search collapse.
- Fix: introduce a separate `metadataFilters` (bank + `subjectIds` + `difficulty`) for metadata queries; keep `filters` (with systems/topics) for counts and creation only.

## P1 — Library fidelity

### 4. API links disappear in High-yield mode
The High-yield rule hides every `span.condensed-hidden*`, which also hides `.api` Medical Interactive Links (e.g. `immune system`) that the reference implementation keeps visible.
- Fix: exclude `.api`, `.dictionary`, `.linksuggest` from those selectors (`:not(...)`), keeping `display: none` on inline spans only.

### 5. Ordered-list numbering unverified
`library.css` re-declares `list-style` for `#acon` and `.amboss-card-body` (`disc`, `decimal`, nested `circle`/`square`) because Tailwind Preflight strips markers, but this has not been visually confirmed.
- Verify on an Amboss article containing `<ol>` in High-yield on/off and light/dark.

## P2 — Test runner (largest remaining gap)

`/test/:testId` is a placeholder. Backend support already exists (`GET /tests/:id`, `POST /tests/:id/submit`, `/submit-batch`, `PUT /complete|suspend|resume`, `GET /results`, explanation + AI-explain endpoints, `TestAccessGuard`, watermarking). Needed on the frontend:

1. Typed API helpers for the test lifecycle endpoints
2. Runner shell: question card (sanitized watermarked HTML), option selection, prev/next, mark-for-review, timer (`timeLimitSeconds` countdown; block mode shows elapsed), End-Block
3. Tutor mode: submit per answer; timed mode: buffer answers and `submit-batch`
4. States: `blockResultsLocked`, completed vs in-progress, server-side auto-complete on expiry, `TestAccessGuard` denials, empty-question fallback
5. Results view: score, per-question review (correct / chosen / omitted), explanations with AI fallback
6. Keyboard navigation and progress persistence across reloads

## P3 — Placeholder routes and polish

- `/contests`, `/ai-analyst`, `/settings` still render `ComingSoon`.
- Bank cards respond to `Enter` but not `Space`.
- Availability query uses a `null as unknown as number` cast.
- Duplicate `Link` imports in `WelcomePage`.

## Suggested order

1. P0 Create Test correctness (mixed mode + custom IDs + metadata filters) → verify by creating one single-mode, one mixed-mode, and one custom test against the live API.
2. P1 Library fidelity (API-link exception + list-marker verification).
3. P2 Test runner.
4. P3 Placeholders and polish.

## Verification log

- `npm run lint` and `npm run build` clean after each feature commit.
- Live API checks against `https://medhvgg-production.up.railway.app/api` confirmed: main-bank lists per step, UWorld Step 1 (id 19, 3654 questions), self-assessment block banks, NBME forms, counts/subjects/difficulty endpoints.
- Browser checks confirmed: systems unlock after subject selection, subject/system select-all works, global topic search returns 149 merged rows with 0 duplicate names, expanded system topic lists return 176 merged rows with 0 duplicate names, Custom mode shows `2 / 50 selected` with Create enabled, and the heartbeat loader CSS is served.
- Not yet verified end-to-end: actual test creation via the UI (blocked by issue #1 for multi-mode), and test taking/results (runner not built).