# EXAM_RUNNER.md — MedPark multi-theme exam runner

**Status:** IMPLEMENTED + VERIFIED — Issue #4 remains open for Results/Review and deferred shared features  
**Primary implementation issue:** #4  
**Approved first implementation theme:** AMBOSS  
**User approval recorded:** 2026-10-07

## 1. Architecture boundary

The Exam Runner is one shared execution core with isolated theme packages.

```text
src/features/exam/
  api/
  core/
  registry/
  types/
  shared/
  themes/
    amboss/
    uworld/
    nbme/
    mrcp/
    ...
```

Rules:
- Exam Core owns API/lifecycle/state orchestration.
- A theme owns presentation, layout, tool placement and theme-only local interactions.
- Themes do not call Axios directly.
- Theme-specific logic must not be scattered as `if (theme === ...)` across unrelated files.
- UWorld and AMBOSS must not import each other's UI.
- A theme can be deleted/rebuilt without rewriting the core.
- Server HTML always passes through the existing DOMPurify sanitization path.
- Backend remains authoritative for correctness, answer reveal, marks, notes, timing and completion semantics.

## 2. Theme selection

Initial AMBOSS routing rule:
- AMBOSS applies when question-bank metadata identifies AMBOSS.
- The current explicit product mapping treats AMBOSS main-bank/bank identity `1` as AMBOSS.
- Resolver must also recognize AMBOSS by stable bank metadata (name/code) so the theme is not coupled only to one numeric ID.
- Tests not resolved as AMBOSS use the standard/fallback runner until their dedicated theme is implemented.
- Do not duplicate this rule inside AMBOSS components; keep it in the central theme registry/resolver.

Long-term backend `viewerThemeProfileSnapshot` integration remains part of the registry boundary; current backend enum does not yet expose a dedicated AMBOSS profile.

## 3. AMBOSS desktop visual structure

Approved reference: the supplied AMBOSS screenshots and standalone prototype discussion.

### Top bar
- AMBOSS teal/green chrome.
- Remove the AMBOSS search field from MedPark.
- Approved utility composition is split into three calm zones rather than one crowded row:
  - **Left / utility:** Settings + a compact Tools popover.
  - **Center / exam lifecycle:** Suspend · primary countdown timer · End Block.
  - **Right / helper:** Calculator during the live block. AI Summary is hidden during Timed solving and appears only after End Block / review.
- Tools popover contains **Marker / Pencil / Laser**. These are AMBOSS presentation tools and must not duplicate core answer state.
- My Notebook is deliberately deferred; do not ship a theme-local Notebook placeholder because the eventual Notebook experience is shared across themes.
- Settings owns the approved AMBOSS appearance/text controls instead of adding another top-level appearance button.
- The primary timer lives in the top bar. The existing sidebar timer remains visible as a secondary display; both derive from the same timer source of truth.

### Left session sidebar
- Collapsible/expandable with a smooth animation.
- Shows session title/progress.
- Shows question number/state.
- Shows question difficulty as **1–5 hammer icons**, derived from canonical backend 5-tier difficulty.
- Shows marked/flagged state.
- Shows session/question timing where applicable.
- Exit session remains a dedicated bottom action.
- Mobile transforms this sidebar into an intentional drawer rather than a squeezed desktop rail.

### Question content
- Render canonical backend `textHtml` through the established sanitizer.
- Preserve supported rich markup/images.
- AMBOSS-specific semantic markup is interpreted only inside the AMBOSS theme.

## 4. AMBOSS-specific markup behavior

### KEY INFO = Clue toggle
- `KEY INFO` is the **clue/highlight toggle**.
- Existing `.Highlight` spans in the question stem are already present in backend HTML.
- Clues OFF: highlighted spans read as ordinary text.
- Clues ON: AMBOSS-style yellow/amber highlight treatment appears.
- This is frontend-only transient UI state; no DB write/API request.

### ATTENDING TIP = Hint / key teaching hint
- `ATTENDING TIP` is the actual hint/key teaching info.
- Source content can be present in imported AMBOSS markup such as `.amboss-hint`.
- Do not confuse ATTENDING TIP with KEY INFO/Clue.
- Hint presentation is AMBOSS-theme UI.

### Imported markup safety
- Keep useful safe metadata/data attributes.
- Never execute imported Angular handlers/directives such as `ng-click`.
- Imported content must not execute arbitrary JS.
- Existing sanitizer remains the security boundary.

## 5. AMBOSS tools

Approved first-pass toolbar:
- KEY INFO — clue toggle.
- ATTENDING TIP — hint.
- LABS — existing `GET /api/lab-values`.
- ADD NOTES — **Question Notes**, not Notebook; use existing Notes backend.
- MARK — existing dedicated mark endpoint/state.
- GET ANKI CARDS — maps to MedPark Flashcards capability; detailed flashcard UX is deliberately deferred.
- Marker / Pencil / Laser are implemented in the approved top-bar Tools popover; Marker/Pencil include palettes plus custom color.

## 6. Answer lifecycle — no visible Submit button

**AMBOSS must not show a button named Submit.**

Tutor/Mixed:
- selecting an option is local selection;
- `SHOW ANSWER` is the visible action;
- internally `SHOW ANSWER` uses the canonical backend submit endpoint to persist the selection (or omission) and receive correctness;
- after server acknowledgement, reveal correct/incorrect state, option percentages and explanations according to backend response/authorization;
- the frontend does not calculate correctness.

Timed:
- default one minute per requested question, configurable at Create Test with 1:00 / 1:30 / 2:00 / 3:00 / Custom presets;
- the top-bar timer is the primary countdown; the sidebar timer stays visible as a secondary synchronized display;
- selecting an option shows a **blue selected state only** and updates the local timed answer buffer;
- Next / Previous navigation keeps the buffered selection visible when returning to the question;
- no correct/incorrect styling, explanation, percentages or answer reveal during the live block;
- no hidden per-question `/submit` call for Timed;
- End Block submits the entire buffered answer set through the canonical timed batch endpoint;
- when the countdown reaches zero, the runner automatically executes the same End Block path once;
- Suspend persists server timing state and pauses the displayed countdown; Resume continues from the server-preserved remaining time;
- clue/hint tools remain available in the current approved design.

## 7. Explanation behavior

AMBOSS supports per-option explanations:
- correct option green treatment;
- selected incorrect option red treatment;
- percentages when the backend is allowed to reveal them;
- per-option explanation content from canonical backend;
- `SHOW ALL EXPLANATIONS` / hide-all interaction after reveal;
- rich images inside explanations must use sanitized HTML and current media contract.

## 8. Difficulty contract

Canonical DB already stores 5 tiers:
- `very_easy`
- `easy`
- `medium`
- `hard`
- `very_hard`

Runner needs this exact tier in `GET /api/tests/:id`; do not derive five hammers from the legacy 3-tier label in React.

Presentation mapping:
- very_easy → 1 hammer
- easy → 2
- medium → 3
- hard → 4
- very_hard → 5

## 9. Notes / Mark / Labs ownership

Notes:
- `GET /api/notes/question/:questionId`
- `POST /api/notes` create/update by question
- AMBOSS editor is presentation only; backend note remains source of truth.

Mark:
- `PATCH /api/tests/:id/mark`
- independent of answer submission.

Labs:
- `GET /api/lab-values`
- AMBOSS desktop uses a right-side lab panel.
- On narrow screens it must become viewport-safe rather than compressing the question to unusable width.

## 10. Appearance

AMBOSS Light and AMBOSS Dark are both approved directions.
The approved Settings control in the top bar is now the AMBOSS placement for appearance and readable text-size controls; this resolves the previously deferred placement without changing the shared theme registry boundary.
Dark-mode reference:
- charcoal/dark green-gray surfaces, not pure black;
- AMBOSS teal top chrome retained;
- off-white primary text;
- muted gray-blue secondary text/dividers;
- clue amber treatment;
- incorrect deep burgundy/red tint;
- correct deep teal/green tint;
- hint badge amber.

Settings is the approved AMBOSS appearance/text control placement. Cross-theme appearance URL strategy remains deferred.

## 11. Responsive requirements

Responsive behavior is part of Done.
- Desktop: full AMBOSS shell.
- Tablet/iPad: preserve readable question width; tools may compact intentionally.
- Mobile: dedicated composition, not scaled desktop.
- Sidebar becomes drawer.
- Labs/notes/popovers remain viewport-safe.
- Touch targets must be practical.
- No unintended horizontal overflow.
- Exact final mobile utility placement remains subject to user visual approval during verification.

## 11A. Approved Timed + utility-bar slice — 2026-10-07

User explicitly approved this implementation slice and asked for immediate implementation.

### Live Timed block
- Standard Create Test uses **60 seconds per question** for Timed.
- The primary countdown appears in the top bar; the existing sidebar time display remains visible and synchronized from the same core timer state.
- Timed answer selection is blue-only and local until End Block.
- Navigation does not reveal correctness or explanations.
- Timer expiry automatically triggers the same idempotent End Block action.

### Suspend / End Block
- Center controls are `Suspend · Timer · End Block`.
- Suspend uses the canonical backend suspend endpoint and preserves elapsed/remaining time. The later 11B refinement supersedes the original in-runner pause destination: successful Suspend now navigates to Previous Tests.
- Resume uses the canonical backend resume endpoint before continuing the running countdown.
- End Block opens a confirmation summary with Answered / Unanswered / Marked / Remaining Time and offers cancel/review-navigation versus final End Block.
- End Block must be single-flight/idempotent in the client so timeout + manual click cannot double-submit.

### Top utility layout
- Left: `Settings`, `Tools`.
- Tools popover: `Marker`, `Pencil`, `Laser`.
- Right during solving: `Calculator`.
- `My Notebook` remains deferred as a shared cross-theme product surface.
- `AI Summary` is not visible during Timed solving. It becomes available only once the test is completed/reviewable, using the existing authenticated per-question AI endpoint when invoked.

### Tool behavior
- Settings: AMBOSS light/dark appearance and readable text-size controls.
- Marker: question-text selection highlight using the existing dedicated highlight persistence endpoint; it must not create answer-submission rows.
- Pencil: transient drawing overlay for scratch annotation in the current question workspace; no fake persistence contract is invented.
- Laser: transient pointer mode for visual focus; no persistence.
- Calculator: local basic calculator panel with keyboard-safe arithmetic controls.
- Question Notes remain the existing per-question Notes capability in the question toolbar and are not renamed to Notebook.

### Review gate
- Completion unlocks review-only helper UI, including AI Summary.
- Final full Results/Review page design remains a separate later slice; this implementation only provides lifecycle-safe completed-state review behavior needed by End Block.

## 11B. Approved timer, lifecycle and color refinement — 2026-10-07

User approved this refinement after reviewing the merged Timed toolbar.

### Timer contract
- One shared one-second ticker drives the primary top timer and the sidebar timer.
- Tutor is an **ascending active-solving counter**: it advances only while the current Tutor question is still unanswered.
- Timed is a **descending** countdown from the configured block duration.
- Suspended tests do not advance the displayed timer.
- Resume continues from server-preserved elapsed/remaining time.
- Timed reaching `00:00` uses the same single-flight End Block path.
- Timer movement itself is a browser acceptance criterion; merely rendering a number is not sufficient.

### Create Test timed duration
- Choosing Timed reveals a per-question time control.
- Presets: `1:00`, `1:30`, `2:00`, `3:00`, plus Custom.
- Default remains `1:00` per question.
- The UI shows the derived total block duration before Create.
- The canonical request sends `timeLimitSeconds = questionCount × secondsPerQuestion`; backend remains authoritative for the resulting block limit.

### Tutor lifecycle
- Suspend remains available in Tutor.
- Successful Suspend navigates out of the runner to the current bank's Previous Tests page after persistence succeeds.
- End Block is visible in Tutor as well as Timed.
- Tutor End Block completes through the canonical backend complete endpoint with the displayed elapsed time.
- Final navigation into Test Analysis / Results is intentionally deferred until that separate page is designed; this slice must not invent the final analysis experience.

### Marker / Pencil colors
- Marker and Pencil expose a palette with multiple preset colors plus a custom color input.
- The currently selected color is visually reflected in the tool control.
- Marker descriptors persist the exact chosen color through the existing highlights API.
- Dark mode renders marker fills with reduced opacity / contrast-safe treatment so highlighted text remains clearly readable.
- Pencil uses the selected color for new strokes; Pencil remains transient in this slice.
- Laser behavior remains unchanged.

### Notebook placement decision
- My Notebook is still deferred as a shared cross-theme feature.
- Its approved future placement is the **right-side helper zone** of the top bar, beside Calculator.
- My Notebook is distinct from per-question Notes and from Flashcards/Anki.
- The eventual Notebook opens as a shared right-side drawer; do not build a theme-local placeholder now.

## 11C. Approved Tutor active-solving-time contract — 2026-10-08

User explicitly approved this timing rule as a shared Exam Core behavior for Tutor mode across every theme.

### Canonical Tutor clock semantics
- Tutor time means **net solving/thinking time before first submission**, not wall-clock session-open time.
- Enter an unanswered Tutor question → the shared timer runs.
- First option selection is the canonical Submit action → the timer pauses immediately at click time, before explanation/API latency.
- `SHOW ANSWER` on an unanswered Tutor question is also a submission/omission action → the timer pauses immediately.
- Explanation reading, inspecting other options, Labs, Notes, Library, AI/review tools, and other post-answer activity do **not** add Tutor solving time.
- Navigate to another unanswered Tutor question → the timer resumes from the accumulated total.
- Navigate to an already answered/omitted Tutor question → the timer stays paused.
- Revisiting an unanswered question accumulates additional solving time for that question until its first submit.
- Timed mode is unchanged: its block countdown remains continuous until Suspend / End Block / timeout.

### Persistence / authority
- Shared Exam Core owns active/inactive presentation state so every theme receives identical Tutor behavior.
- On Tutor first submit, frontend sends that question's active-solving delta as `timeSpentSeconds` to the canonical submit endpoint.
- Backend `tests.timeSpentSeconds` remains the persisted aggregate net solving time; `question_submissions.timeSpentSeconds` stores the per-question solving delta.
- Tutor retrieval must not add wall-clock `(now - startedAt)` to the timer snapshot; its server snapshot is the persisted active-time aggregate.
- Suspend and End Block persist the current net active-solving total so unsubmitted in-session thinking is not lost.
- A failed submit reactivates the clock for that still-unanswered question; a successful submit keeps it paused.

### Acceptance examples
- Solve Q1 for 80s → submit → read explanation for 4m → Tutor timer stays at ~80s.
- Open unanswered Q2 and think for 50s → submit → total becomes ~130s, not ~370s.
- Reopen answered Q1 → no timer movement.
- Open unanswered Q3 → timer resumes.

## 12. Current implementation slices

### Slice A — foundation
- [x] Typed test/runner API contracts
- [x] Theme registry/resolver
- [x] Full-screen exam route outside global AppLayout
- [x] Shared sanitized HTML renderer
- [x] Backend exposes 5-tier `difficultyTier` in test retrieval

### Slice B — AMBOSS shell
- [x] AMBOSS layout/tokens
- [x] collapsible session sidebar
- [x] 1–5 difficulty hammers
- [x] question navigator + mark states
- [x] Light/Dark Settings placement and token foundation

### Slice C — question interaction
- [x] sanitized question/options
- [x] KEY INFO clue toggle
- [x] ATTENDING TIP/hint
- [x] no visible Submit
- [x] Tutor/Mixed first-answer + SHOW ANSWER lifecycle wired to backend
- [x] Timed draft selection without immediate reveal
- [x] explanation reveal/show-all behavior
- [x] Tutor ascending active-solving timer + Timed descending timer tick every second
- [x] configurable Timed duration at Create Test
- [x] Tutor + Timed Suspend/End Block lifecycle

### Slice D — tools
- [x] Labs live endpoint/panel
- [x] Question Notes live read/save
- [x] Mark live persistence
- [x] Flashcard entry placeholder only
- [x] Marker palette + custom color + persisted descriptors
- [x] Pencil palette + custom color for new transient strokes
- [x] Laser
- [x] Calculator
- [x] review-only AI Summary entry

### Verification
- [x] frontend typecheck
- [x] frontend lint
- [x] frontend build
- [x] backend tests/build
- [x] GitHub Actions Verify green
- [x] authenticated AMBOSS Tutor smoke
- [x] authenticated AMBOSS Timed selection/End-Block smoke
- [x] production Tutor timer suspend/resume/complete smoke
- [x] mark persists after reload
- [x] notes persist after reload
- [x] labs load
- [x] clue toggle affects only AMBOSS `.Highlight`
- [x] desktop browser acceptance
- [x] tablet/iPad browser acceptance
- [x] mobile browser acceptance
- [x] browser proves Timed timer decrements and Tutor timer increments
- [x] browser proves marker dark-mode contrast and Marker/Pencil palettes

## 13. Explicitly deferred
- global cross-theme appearance URL strategy;
- My Notebook shared drawer implementation;
- detailed Flashcards/Anki creation UX;
- UWorld production implementation;
- NBME/MRCP themes;
- results/review final design beyond what is necessary to keep runner lifecycle safe.


## 14. Timer / lifecycle / annotation closeout — 2026-10-07

Merged implementation:
- frontend PR #24 → `14ecb212cfac91b5abbf514adc09c9219f30b6bc`;
- backend PR #22 → `1500e4aeb71a1b7cf563e0a196f0a05ffc6a9e17`;
- Railway production deployment `c98b91a9-44ea-4f8b-920a-8922433405df` → SUCCESS.

Verification:
- frontend Verify #108: typecheck ✅ lint ✅ build ✅;
- AMBOSS Browser Smoke #28 ✅ with `timed_create_duration=true timed_timer_ticks=true tutor_timer_ticks=true tutor_suspend_navigation=true tutor_end_block=true marker_palette=true marker_dark_contrast=true pencil_palette=true`;
- production Exam Runner API Smoke #10 ✅ with `TUTOR_TIMER_OK ... suspend_elapsed=37 resume_preserved=true complete_elapsed=42`;
- existing Tutor, Timed, Labs and AMBOSS Library production regressions stayed green.

Still deliberately deferred:
- My Notebook shared cross-theme right-side drawer (future top-bar right helper zone beside Calculator);
- detailed Flashcards/Anki UX;
- final Test Analysis / Results design and post-End-Block destination;
- UWorld/NBME/MRCP production themes;
- AMBOSS source media upload/path completion.
