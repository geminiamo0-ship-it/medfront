# EXAM_RUNNER.md — MedPark multi-theme exam runner

**Status:** TIMED/UTILITY SLICE DONE → RESULTS/REVIEW DEFERRED  
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
- Global AMBOSS utilities are now approved and implemented in the top bar: Settings, Marker, Pencil, Laser and Calculator. My Notebook remains deferred as a shared cross-theme surface.

## 6. Answer lifecycle — no visible Submit button

**AMBOSS must not show a button named Submit.**

Tutor/Mixed:
- selecting an option is local selection;
- `SHOW ANSWER` is the visible action;
- internally `SHOW ANSWER` uses the canonical backend submit endpoint to persist the selection (or omission) and receive correctness;
- after server acknowledgement, reveal correct/incorrect state, option percentages and explanations according to backend response/authorization;
- the frontend does not calculate correctness.

Timed:
- one minute per requested question for Standard Create Test (for example 40 questions → 40:00);
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

Final AMBOSS appearance placement is now approved and implemented inside the top-bar Settings control.

## 11. Responsive requirements

Responsive behavior is part of Done.
- Desktop: full AMBOSS shell.
- Tablet/iPad: preserve readable question width; tools may compact intentionally.
- Mobile: dedicated composition, not scaled desktop.
- Sidebar becomes drawer.
- Labs/notes/popovers remain viewport-safe.
- Touch targets must be practical.
- No unintended horizontal overflow.
- Mobile utility placement is the approved compact icon composition; Settings and Tools remain available rather than being hidden.

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
- Suspend uses the canonical backend suspend endpoint, preserves elapsed/remaining time, then leaves the runner in a resumable suspended state.
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
- [x] Light/Dark token foundation + approved Settings placement

### Slice C — question interaction
- [x] sanitized question/options
- [x] KEY INFO clue toggle
- [x] ATTENDING TIP/hint
- [x] no visible Submit
- [x] Tutor/Mixed SHOW ANSWER wired to backend
- [x] Timed blue draft selection + backend draft persistence without immediate reveal
- [x] explanation reveal/show-all behavior

### Slice D — tools
- [x] Labs live endpoint/panel
- [x] Question Notes live read/save
- [x] Mark live persistence
- [x] Flashcard entry placeholder only

### Verification
- [x] frontend typecheck
- [x] frontend lint
- [x] frontend build
- [x] backend tests/build for difficulty + Timed draft contracts
- [x] GitHub Actions Verify green
- [x] authenticated AMBOSS Tutor smoke
- [x] authenticated AMBOSS Timed draft/Suspend/Resume/End-Block production smoke
- [x] mark persists after reload
- [x] notes persist after reload
- [x] labs load
- [x] clue toggle affects only AMBOSS `.Highlight`
- [x] desktop browser acceptance
- [x] tablet/iPad browser acceptance
- [x] mobile browser acceptance

## 13. Explicitly deferred
- My Notebook shared cross-theme UX/customization;
- detailed Flashcards/Anki creation UX;
- UWorld production implementation;
- NBME/MRCP themes;
- full results/review final design beyond the completed-state review helper behavior shipped for this slice.
