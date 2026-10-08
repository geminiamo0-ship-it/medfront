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

### Sidebar screenshot refinement — approved, implemented and browser-verified 2026-10-08
- Reference: user-supplied AMBOSS sidebar screenshot (custom session title, progress indicator, stem snippets, status dots, difficulty hammers, session/question clocks and Exit Session).
- The sidebar shows **number + sanitized first text of the question stem**, for every question including inactive ones, with a single-line ellipsis. Hint/style/HTML noise is removed before extracting the plain-text preview.
- Existing marks and 1–5 canonical backend difficulty hammers remain visible and functionally separate from answer status.
- Answer status is represented distinctly for unanswered, draft-selected, correct, incorrect and omitted. Timed must not reveal correctness before End Block.
- The active question row has a quiet highlighted background, clear number and readable text; row click preserves navigation.
- Header contains title, answered-or-selected / total count, progress bar and sidebar collapse control.
- Footer contains **SESSION** timer and **QUESTION** timer with an EXIT SESSION action; Timer Mode semantics remain authoritative in Exam Core: Tutor counts net pre-submit solving time, Timed counts down continuously. Question-local display is a view metric; it must not mutate or substitute the canonical persisted test solving duration.
- Exit Session delegates to the existing Suspend→Previous Tests flow when in progress; completed tests navigate back to Previous Tests.
- Desktop, tablet/iPad and mobile drawer all retain readable text, visible statuses and no horizontal overflow; dark mode uses the same semantic contrast.
- Do not call additional API endpoints for stem previews; reuse the already loaded, sanitized question HTML.
- Acceptance: screenshot-style hierarchy; each row has a real preview; status never leaks Timed correctness; two clocks move appropriately; Exit Session isn't an inert button; no answer/timing persistence regression.

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

## 11C. Tutor active-solving-time contract — APPROVED + IMPLEMENTED + VERIFIED — 2026-10-08

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

## 11D. Completed-Omitted review contract — APPROVED + IMPLEMENTED + VERIFIED — 2026-10-08

User explicitly approved/fixed this as a review rule shared by every exam theme.

### Canonical semantics
- `Omitted` means the learner did not submit an answer before End Block; it remains an Omitted result/filter state permanently unless a later independent attempt answers the question.
- Omitted is **not** an answer-visibility restriction after the test is completed.
- After End Block, opening an Omitted question reveals the canonical correct answer exactly like other completed-review questions.
- Clicking any answer option in completed review may reveal/fetch that option's explanation.
- `SHOW ALL EXPLANATIONS` remains available in completed review.
- Reviewing an Omitted question must never create a submission, mutate selectedOptionId, change scoring, or change Omitted/Correct/Incorrect QBank states.
- Block-results locking remains authoritative: if backend withholds correctness because a block-bank review is still locked, the frontend must not manufacture it.

### Presentation
- A completed untouched Omitted question should not auto-expand every explanation merely because it is Omitted.
- The correct answer is visually identifiable immediately in completed review.
- Option explanations expand on click; all may be expanded explicitly with `SHOW ALL EXPLANATIONS`.
- Explicit Tutor `SHOW ANSWER` omission during an active Tutor session keeps its existing immediate reveal behavior.

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
- [x] browser proves Tutor timer pauses on first submit/SHOW ANSWER
- [x] browser proves Tutor timer stays frozen during explanation/review
- [x] browser proves Tutor timer resumes on unanswered navigation
- [x] browser proves Tutor submit sends per-question `timeSpentSeconds`
- [x] production API proves Tutor server snapshot does not wall-clock creep before submit or during review
- [x] completed Omitted review exposes the canonical correct answer
- [x] completed Omitted option click lazy-fetches/shows explanation
- [x] completed Omitted review does not auto-expand every explanation
- [x] completed Omitted review does not mutate submission/draft/result state
- [x] production API proves untouched completed Omitted can have `userAnswer=null` while correctness/explanation remain reviewable

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


## 15. Tutor active-solving-time closeout — 2026-10-08

Merged implementation:
- backend PR #26 → `f027476dc08b2639376e7c4016baa4ef36a9edc1`;
- frontend PR #28 → `f8b754257c2eafd067cdb0aadb1328f1e747c739`;
- Railway production deployment `5743176d-e76f-45af-879e-299978403937` → SUCCESS;
- Cloudflare Workers production Version `dfaacb5e-3f18-493a-a0c3-f93a746c5d27` → SUCCESS.

Verified behavior:
- Tutor unanswered question increments the shared timer;
- first option selection pauses before API/explanation latency;
- SHOW ANSWER/omission pauses the same way;
- waiting in explanation/review does not change the timer;
- moving to a fresh unanswered question resumes from the accumulated total;
- answered/omitted questions remain paused;
- Tutor submit carries the current question's active-solving delta;
- backend stores per-question and aggregate active-solving time;
- Tutor GET snapshots are persisted active time only, never wall-clock `now-startedAt`;
- Timed continuous countdown behavior is unchanged.

Evidence:
- backend Verify #29 ✅;
- production Exam Runner API Smoke #12 ✅: `pre_submit_static=0 submitted_delta=3 persisted=3 review_static=3`;
- frontend Verify #117 ✅;
- AMBOSS Browser Smoke #31 ✅ with `tutor_pause_on_submit=true tutor_resume_unanswered=true tutor_submit_time_delta=true`;
- frontend main Verify after merge ✅.

Architecture rule:
**Do not implement Tutor timing separately inside future themes.** UWorld, NBME, MRCP, and later themes consume this shared Exam Core contract.


## 16. Completed-Omitted review closeout — 2026-10-08

Root cause:
- canonical backend already exposed correctness/explanations after completion;
- shared frontend reveal logic incorrectly required `userAnswer`, so untouched completed Omitted questions with `userAnswer=null` stayed visually locked.

Implemented:
- shared Exam Core accepts completed server-provided correctness as review reveal state even without a submission;
- AMBOSS completed review shows the correct option immediately;
- completed Omitted explanations are collapsed by default;
- clicking an option lazy-fetches its explanation without submitting;
- `SHOW ALL EXPLANATIONS` expands all review explanations;
- active Tutor `SHOW ANSWER` omission keeps its existing immediate reveal behavior;
- block-results lock stays authoritative because the frontend never invents correctness.

Merged/deployed:
- frontend PR #30 → `662a7715a487d8357c450193ebb241d63c7f088e`;
- Cloudflare production Build `fdb02340-106c-42f4-8624-0aa50c175f41`;
- Cloudflare Version `15880f3a-b667-4d28-ba19-dc0c4ae173b4` → SUCCESS.

Verification:
- frontend Verify #123 ✅;
- AMBOSS Browser Smoke #34 ✅ with
  `omitted_review_correct=true omitted_review_explanation_fetch=true omitted_review_no_mutation=true`;
- production Exam Runner API Smoke #13 ✅:
  `OMITTED_REVIEW_OK ... omitted=true userAnswer=null correctness=true explanation=true no_mutation=true`;
- backend Verify #31 ✅ on the diagnostic branch; no backend code was merged because the API contract was already correct;
- main frontend Verify after merge ✅.

Architecture rule:
**Omitted is an outcome, not a completed-review visibility restriction.** Future UWorld/NBME/MRCP themes must consume this shared review contract.


## 17. Screenshot sidebar refinement implementation — 2026-10-08

- Frontend PR #34 → `9c5acc78483b6f7a12463a62d05480d54755d458`.
- Real question stem text in all nav rows (not active-only `Question N` placeholders); HTML and hints omitted from previews, with truncation and full-title hover.
- Session title, selected/answered progress bar, distinct status glyphs, 1–5 difficulty hammers and mark state.
- Session/remaining countdown and question-local display timer are derived from shared Exam Core (no backend timing redefinition).
- Real EXIT SESSION action delegates to existing Suspend/Previous Tests navigation.
- Dark theme and responsive desktop/iPad/mobile treatment retained.
- Verify #133 success.
- Browser Smoke #40 success: `sidebar_stem_previews=true sidebar_progress=true sidebar_question_timer=true sidebar_exit_navigation=true`. All Tutor/Timed and Omitted-review regressions also green.
- **Production verification:** Initial Cloudflare build failed; subsequent identical code on main (docs-only merge) triggered Cloudflare Build `fc96eee6-1aa7-4483-a565-2649b0d8bce5` SUCCESS; Version `57145276-f70a-4515-88a1-ef4c782d7593`. Main Verify SUCCESS.

## 18. AMBOSS exam inline images / Library Viewer reuse — USER APPROVED 2026-10-08

**Scope:** AMBOSS Exam Runner only; existing Library Image Viewer experience is the authoritative visual/interaction reference. Explicit user approval was given in chat: reuse the existing AMBOSS Library Image Viewer, image previews beside the stem, optional overlay via button, description shown in review, and proceed with implementation. This is a focused user-priority override while Issue #32 separately verifies public R2 uploads. No Results/Review page redesign or new theme.

### Example media contract (existing imported HTML)
- `<img src="https://pub-2a81f2cb19cc4473a3d076e657af6121.r2.dev/offline_media/big_5b2d50b498902.jpg" alt="Subarachnoid hemorrhage in the basal cisterns" data-overlay-src="offline_media/5b2d50b498902.jpg" data-description="&lt;p&gt;CT head ...&lt;/p&gt;">`
- Use existing `src`, `alt`, `data-overlay-src`/ `data-overlay`, `data-description`, `title`; preserve imported safe markup and library deep links.
- Resolve relative `offline_media/...` overlay keys against the global R2 origin; do not assume a different extension/key or reupload.
- Normalize/sanitize description HTML before rendering, without executing untrusted content.

### Layout and interactions
- Desktop: small contained question-image thumbnails floated beside the question stem (image visual at right); image text continues with natural wrapping. Several images remain readable; the main text does not jump or expand into giant images.
- iPad/mobile: thumbnails scale/stack gracefully, don't cause horizontal scroll or overlap with answers/other tools; viewer occupies viewport safely.
- Option explanation images are contained thumbnails, never huge inline pictures.
- Click/tap/keyboard activation opens the **same shared AMBOSS Library Image Viewer component**, not a separate exam-only modal. Preserve viewer zoom in/out, reset, matched image/overlay sizing and accessibility; ESC/Close exits.
- Viewer opens with original image and overlay **off** by default. If overlay exists show `SHOW OVERLAY`; pressing toggles to `HIDE OVERLAY`, synchronized with zoom. If absent, omit button.
- Before Tutor first answer/SHOW ANSWER: original and optional overlay as an intentional Hint; viewer Description panel is **not shown in UI**. After Tutor canonical reveal, it becomes available. In Timed solving, Description stays hidden through selections until End Block; completed review unlocks it.
- Image `alt` and `data-description` may remain in the original API/DOM. User explicitly decided against backend filtering/anti-cheat measures; **do not change medhvgg** just to hide these attributes from DevTools.
- Explanation images are only clickable after their explanation is actually revealed (existing backend-authoritative per-option conditions), and their Description then appears.
- Interactive images inside answer options must not trigger an answer selection or a second submit, including keyboard.
- A missing/broken media object shows a small fallback without breaking question text; do not claim R2 object upload success from mocks.
- Links within visible descriptions use safe browser navigation/MedPark Library existing deep links where the source provides them.

### Engineering ownership
- Extract current `src/pages/library/AmbossImageViewer.tsx` to a shared presentation component so Library and AMBOSS Runner use the same viewer; preserve Library public import compatibility.
- Share only the media viewer. Imported AMBOSS stem/option layout, controller reveal gating and metadata activation remain theme-local. Do not add exam lifecycle/API requests to the Viewer.
- Keep `safeRichHtml` sanitization and existing global R2 media URL normalization. Backend is unchanged.

### Verification and acceptance
- [x] stem thumbnail layout desktop/iPad/mobile; multiple images; no unintended horizontal overflow
- [x] Tutor before-answer open/close/zoom/overlay toggling; Description visually hidden
- [x] Tutor after-answer shows sanitized rich Description
- [x] Timed selection does not reveal description; post End Block does
- [x] explanation thumbnail opens shared Viewer after reveal and is not huge inline
- [x] no-overlay images show zoom only; overlay alignment remains correct on zoom
- [x] clicking image in answer content doesn't submit another answer
- [x] Library original image viewer still works without regressions
- [x] real unknown/missing image has graceful fallback
- [ ] typecheck, lint, build, Chromium browser smoke, GitHub Actions Verify; then merge, deploy confirmation and handoff — CI complete; merge, production confirmation, docs closeout still pending.

**Approval record:** user: "ق الـImage Viewer الموجود في AMBOSS Library اتفق", "أنا أميل للزر طبعا", anti-cheat filtering explicitly rejected, then "نفذ" on 2026-10-08. Workflow moves SPEC APPROVED → IMPLEMENTING; no additional UX discussion required for this approved slice.


### Implementation verification checkpoint — 2026-10-08

- Branch: `feat/amboss-image-viewer-reuse`, PR #39, focused Issue #38. User UX approval recorded in §18 **before** implementation.
- Shared viewer: `src/components/media/AmbossImageViewer.tsx`, `amboss-image-viewer.css`. Existing Library file re-exports same implementation and retains the same viewer identity/interactions.
- AMBOSS-only bridge: `src/features/exam/themes/amboss/AmbossExamImages.tsx`, `ambossMarkup.ts`, `AmbossQuestionWorkspace.tsx`, `AmbossOption.tsx`, `styles/amboss.images.css`. No backend/API contract change.
- A trailing standalone source image is moved into a right-aligned image rail beside first stem text; images inside tables/figures/links remain in place. Explanation images are reduced to thumbnails.
- Case coverage: true `<img>` stem/option/answer description; before/after Tutor submit, Timed until/end block; optional overlay and aligned zoom; no-overlay; keyboard/ESC; Library reuse; mock missing-image fallback; desktop/iPad/mobile and no overflow.
- **PR Verify #151:** typecheck ✅ lint ✅ build ✅. **AMBOSS Browser Smoke #50:** ✅ `shared_image_viewer=true stem_image_rail=true missing_image_fallback=true library_image_regression=true tutor_image_reveal=true timed_image_reveal=true image_overlay_zoom=true image_option_no_submit=true` plus existing Tutor/Timed/sidebar regressions.
- Browser checks use mocked R2 responses, not proof of public object upload/permissions. Live assets remain independently tracked by #32. No new Result/Review page or theme started.


### Main merge / external gate — 2026-10-08

- **PR #39 merged** to frontend `main` as `dedcfad064b95660236fb9e4250eeeabef2b50f3`; final PR Verify #153 ✅, Browser Smoke #52 ✅.
- **Main Verify #154**, run `37823707167`: typecheck ✅, lint ✅, production build ✅.
- **Production deployment not yet independently confirmed:** Cloudflare Workers live version/screenshot/real-media availability still need external runtime evidence. GitHub CI isn't a Cloudflare deployment check.
- Issue #38 remains **OPEN / VERIFYING** for production confirmation rather than falsely marked Done. Separate public R2 asset availability remains open in Issue #32.
- Other planned G2 surfaces (Test Analysis/Results, My Notebook, Flashcards, additional themes) are not part of this slice and remain unchanged.

### Screenshot-verified diagnosis/title visibility correction — 2026-10-08

**Live user screenshot:** During an unanswered AMBOSS exam question, Image Viewer shows the diagnostic heading `Osgood-Schlatter disease` next to the hidden-Description notice. The viewer takes `data.title` from source `title` or `alt` and currently renders it unconditionally in `#aiv-title`; this is a pre-answer UX regression, not an anti-cheat request.

**Expected contract (existing user approval, no new design):**
- Before Tutor answer/SHOW ANSWER and before Timed End Block: show a **neutral heading, `Medical Illustration`**, and no diagnostic Description text in the Viewer.
- After Tutor reveal or completed Timed review: show the **real source title/diagnosis** and sanitized Description.
- AMBOSS Library continues to show the real title/Description from the start (`showDescription` defaults true).
- Existing imported `alt`, `title`, `data-description` stay unchanged in the HTML/API, per user's explicit no-anti-cheat-filtering decision.
- Optional `SHOW OVERLAY` button starts off by design, only draws when clicked; an actual image response must decode, not merely add an IMG element. Missing assets are independently checked under Issue #32.

**Acceptance:** browser checks assert generic pre-answer Viewer accessible name/title, absence of visible diagnostic heading, restored Tutor and completed Timed title/Description, unchanged Library title, and post-click overlay bitmap decoding/zoom. Require GitHub Actions Verify and AMBOSS Browser Smoke.

### Live-screenshot diagnostic-heading regression closeout — 2026-10-08

- Confirmed root cause: the shared Viewer showed `data.title`, derived from source `title` or `alt`, above its hidden pre-answer Description notice. Example: `Osgood-Schlatter disease` appeared before solving.
- **Frontend PR #40 merged into `main` as `1104b88527f5fac57ea3d4682b85ae9ebfb97883`**. Visible `#aiv-title` uses `Medical Illustration` when `showDescription=false` and restores the source title when true. Existing Library defaults true and preserves behavior.
- No API/DB/source `alt` or `title` mutation, no anti-cheat backend filtering; this is purely the approved Viewer presentation behavior.
- **Verify #157: PASS** typecheck/lint/build. **AMBOSS Browser Smoke #53: PASS**, explicit `diagnostic_title_hidden_before_answer=true` and `overlay_bitmap_decodes=true` plus Tutor/Timed/Library/iPad/mobile regression checks.
- `SHOW OVERLAY` intentionally starts off; user activates the optional hint by clicking it. Test checks the overlay actually decodes from mocked R2 bytes. **Real Osgood image overlay availability is not independently established** without exact object key/public response; #32 remains R2 asset verification.
- Follow-up gates: main Verify for merge, Cloudflare deployed version/runtime, real R2 object if overlay absent after toggle. These are verification tasks, not claimed Done.

## 19. AMBOSS Library deep links, related terms and Main Article — USER APPROVED 2026-10-08

**Focused Issue #41 / G2 parent #4. Status: SPEC APPROVED → IMPLEMENTING.** User annotated the Main Article button beneath correct explanation and explicitly approved dotted related terms and exact destination section.

### Confirmed contract
- Canonical backend medhvgg/main exposes optional question.articleId (LibraryArticle PK) and question.libraryName. Frontend must type these as optional. Never create a relation from arbitrary medical prose or first encountered hyperlink.
- Imported AMBOSS HTML supplies article external ID and optional data-anker/hash anchor; reuse existing MedPark Library link path and current Split/New Tab actions.
- Existing Library card transform can detach H2 section IDs; Library URL effect skips changed anchors on already open article; collapsed targets need expansion.

### User-approved UX
- Only after a correct explanation is actually expanded (Tutor reveal or completed Timed review), show a compact outlined book button under its explanation when question has explicit AMBOSS articleId and libraryName. Label with authoritative supplied title if available; otherwise neutral 'Main article'.
- True AMBOSS-linked terms use thin dotted underline and keyboard-operable activation; show sanitized imported preview when present; offer existing Split / New Tab choices. No links invented from text.
- Exact anchor navigation in Library full/new tab/split: preserve IDs, expand collapsed sections, scroll to the requested location with brief visible indication; do not misnavigate to another article.
- Respect screenshot styling and responsive desktop, iPad, mobile. Do not redesign Library responsive layout or other themes. No scoring, DB or backend changes.

### Regression and acceptance gates
- [x] Heading IDs (including wrapped/adjacent anchor IDs) survive transform; collapsed target expands and scrolls.
- [x] Same article different-anchor URL transitions work, without unnecessary refetch; wrong-article IDs cannot scroll local content.
- [x] Main Article button only with explicit AMBOSS question relation, correct displayed explanation, Tutor or completed Timed.
- [x] Related terms preserve existing learning-card IDs and anchors; safe preview/actions; no inadvertent answer submit.
- [x] Missing reference fails safely; not invented.
- [x] Desktop/iPad/mobile Chromium and existing exam/library regressions.
- [ ] Typecheck/lint/build + GitHub Actions Verify and AMBOSS Browser Smoke; merge/main Verify; record production runtime status separately.

### Implementation closeout for §19 — 2026-10-08

- Approved Issue #41, frontend PR #42 merged into `main` as `e7c5043762e6e5e9d9ae762756135f2c39f353c5`.
- Source contract verified on canonical medhvgg/main: Question retrieval includes optional `articleId` and `libraryName`. These fields are now typed in frontend. The backend does not provide a canonical article title in the exam question payload, so the Main Article button honestly uses the neutral label 'Main article' rather than inventing 'Chemotherapeutic agents'.
- AMBOSS Library Cards preserve real heading IDs moved from section wrappers/adjacent markers; explicit missing anchors do not silently jump to an unrelated heading; scroll expands collapsed cards, targets header and briefly outlines it.
- Library page processes changed `article`+`anchor` URLs without duplicate refetches; its local jump checks the current article identity before scrolling. Existing Split/New Tab paths preserved.
- Main Article only shows after the correct explanation is visible and only if the question's canonical library relation is valid. Dotted term decoration is restricted to explicit AMBOSS learning-card references; optional imported previews are decoded/sanitized. No relation is guessed from text.
- PR Verify #162 PASS (Typecheck, lint, build); AMBOSS Browser Smoke #54 PASS including `precise_library_anchor=true same_article_anchor_no_refetch=true main_article_relation=true dotted_related_terms=true` and prior image, Tutor, Timed, responsive regressions.
- Main merge Verify #163 PASS (`37829277158`).
- Actual Cloudflare Workers deployed version and real production Library records were **not independently verified**; Issue #41 remains VERIFYING for runtime acceptance, not DONE. Related #32/#38 external checks still open.
