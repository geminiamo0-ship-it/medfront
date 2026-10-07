# EXAM_RUNNER.md — MedPark multi-theme exam runner

**Status:** SPEC APPROVED → IMPLEMENTING  
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
- Reserve the top utility area for later-approved global exam utilities/theme appearance controls.
- Do not invent additional top controls before they are approved.

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
- Additional marker/pencil/global utilities are a later approved visual pass.

## 6. Answer lifecycle — no visible Submit button

**AMBOSS must not show a button named Submit.**

Tutor/Mixed:
- selecting an option is local selection;
- `SHOW ANSWER` is the visible action;
- internally `SHOW ANSWER` uses the canonical backend submit endpoint to persist the selection (or omission) and receive correctness;
- after server acknowledgement, reveal correct/incorrect state, option percentages and explanations according to backend response/authorization;
- the frontend does not calculate correctness.

Timed:
- no immediate answer reveal during the block;
- selections remain buffered for the canonical timed End-Block batch path;
- no hidden per-question `/submit` call for Timed;
- clue/hint tools remain available in the current first-pass design unless later changed explicitly.

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
Dark-mode reference:
- charcoal/dark green-gray surfaces, not pure black;
- AMBOSS teal top chrome retained;
- off-white primary text;
- muted gray-blue secondary text/dividers;
- clue amber treatment;
- incorrect deep burgundy/red tint;
- correct deep teal/green tint;
- hint badge amber.

The final theme/appearance switch UI is not yet locked; do not invent its final control placement.

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

## 12. Current implementation slices

### Slice A — foundation
- [ ] Typed test/runner API contracts
- [ ] Theme registry/resolver
- [ ] Full-screen exam route outside global AppLayout
- [ ] Shared sanitized HTML renderer
- [ ] Backend exposes 5-tier `difficultyTier` in test retrieval

### Slice B — AMBOSS shell
- [ ] AMBOSS layout/tokens
- [ ] collapsible session sidebar
- [ ] 1–5 difficulty hammers
- [ ] question navigator + mark states
- [ ] Light/Dark token foundation (final switch placement deferred)

### Slice C — question interaction
- [ ] sanitized question/options
- [ ] KEY INFO clue toggle
- [ ] ATTENDING TIP/hint
- [ ] no visible Submit
- [ ] Tutor/Mixed SHOW ANSWER wired to backend
- [ ] Timed local selection buffer without immediate reveal
- [ ] explanation reveal/show-all behavior

### Slice D — tools
- [ ] Labs live endpoint/panel
- [ ] Question Notes live read/save
- [ ] Mark live persistence
- [ ] Flashcard entry placeholder only

### Verification
- [ ] frontend typecheck
- [ ] frontend lint
- [ ] frontend build
- [ ] backend tests/build for difficulty contract
- [ ] GitHub Actions Verify green
- [ ] authenticated AMBOSS Tutor smoke
- [ ] authenticated AMBOSS Timed selection/End-Block smoke
- [ ] mark persists after reload
- [ ] notes persist after reload
- [ ] labs load
- [ ] clue toggle affects only AMBOSS `.Highlight`
- [ ] desktop browser acceptance
- [ ] tablet/iPad browser acceptance
- [ ] mobile browser acceptance

## 13. Explicitly deferred
- final global theme/appearance switch control and URL strategy;
- final marker/pencil placement;
- detailed Flashcards/Anki creation UX;
- UWorld production implementation;
- NBME/MRCP themes;
- results/review final design beyond what is necessary to keep runner lifecycle safe.
