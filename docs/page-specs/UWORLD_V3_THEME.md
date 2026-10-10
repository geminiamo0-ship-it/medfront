# UWorld V3 Theme — faithful modular React implementation
**Approved 2026-10-10**, GitHub issue #64. User provided `uworld-theme-appearance-v3 (3).html` and approved screenshot-faithful `medpark_uworld_v3_blue_default.html` (Blue default, Sepia not Red, Dark). Original bars, icons, question/explanation placement are visual contract. The abandoned redesigned V4 is explicitly not the reference.

## Routes/theme resolution
Exam page `/test/:testId` reuses `useExamRunner`; return `UWorldTheme` only for UWorld bank code/name or explicitly requested backend `viewerThemeProfileSnapshot`. AMBOSS source always stays AmbossTheme. No global bankId guess; uncertain sources use current standard placeholder. No extra API endpoints unless verified necessary.

## Folder and file responsibility contract
```
src/features/exam/
  core/useExamRunner.ts        # EXISTING canonical exam domain controller, NO new UI JSX
  shared/ExamIcon.tsx          # EXISTING shared icons, extend only missing SVGs
  themes/amboss/              # EXISTING untouched theme
  themes/uworld/
    UWorldTheme.tsx            # SMALL layout assembly, navigation + lifecycle orchestration
    UWorldTopbar.tsx           # item info, tools, next/prev
    UWorldSidebar.tsx          # 40-question status nav
    UWorldQuestionPane.tsx     # safe stem, options, submit, results
    UWorldOptions.tsx          # choices, correctness decorations
    UWorldResultSummary.tsx    # score/correct/time (only revealed)
    UWorldExplanationPane.tsx  # safe clinical explanation
    UWorldSplitter.tsx         # width control, keyboard resize
    UWorldBottomBar.tsx        # timers and life-cycle actions
    UWorldSettings.tsx         # 3 palette + split switch
    UWorldTools.tsx            # tabs for calculator/labs/notes + access to existing API state
    useUWorldPreferences.ts    # BLUE default, explicit persisted preference
    uworld.css                 # index/imports only
    uworld-shell.css           # layout + bars
    uworld-content.css         # question/explanation/results
    uworld-responsive.css      # viewport behavior
```
Prefer ~80–200 lines/component (no giant page or copied monolith) and purpose-based CSS files; one orchestration component can be ~200–250 justified. No business rules in presentational components, and do not copy the existing 868-line core controller. Use shared ExamIcon, consistently sized 20–24px SVGs, labelled 44px touch actions.

## Fidelity
- Fixed left question-number strip with compact striped rows/status symbols, collapsible.
- Top colored bar: menu/item info/Mark; centered Previous/Next; right Shortcuts, Full Screen, Marker, Lab Values, Notes, Calculator, Settings.
- Bottom colored bar: session elapsed/remaining, TUTOR/TIMED and Medical Library, Notebook, Flashcards, Feedback, Suspend, End Block.
- Actual question stem + choice container (radio answers); after Tutor answer, correct/incorrect selected cues, compact result summary and explanation. Split panel with draggable resizer; continuous layout from Settings; explanation tab at top; preserve text/media HTML structure; avoid fabricated illustration.
- Blue `#435eb5` **default**, Sepia warm brown `#5d4537`/cream `#fbf0da`, Dark charcoal. Correct green and incorrect red unchanged across palettes. One preference key scoped UWorld only, persisted between sessions; never rewrite AMBOSS preferences.
- Responsive: 1280 desktop, 834 tablet, 390 and 320 mobile; compact overflow controls (not hidden indispensable lifecycle actions), question/explanation stack on small screens, sidebar drawer.
- Settings modal/drawer keyboard accessible (Escape/close/focus); tabs are semantic and accessible.

## Core contract/safety
Controller owns answer saving, state, timing, omitted, marking, highlight, Notes/Labs backend, suspend/resume/end. For Tutor, selecting an option already submits using the shared controller; do **not** accidentally double-submit with a visual Submit button. For Timed, choices saved as draft and correctness MUST remain hidden until finalization. Never invent stats or explanations (correct answer from `currentReveal` and/or authorized options only); no local fake progress. Completed tests are read-only; first-answer review stays read-only.
Use existing `ExamRichHtml` / `sanitize` path for backend HTML and respect media URLs, watermark and click semantics. Never `dangerouslySetInnerHTML` raw.
No frontend-only entitlement or ID trust.

## Validation
- TS + lint + production build; tests for theme resolver and palette mode.
- Browser smoke authentic UWorld test fixture: Blue default, switch Sepia/Dark, split/continuous after Tutor answer, divider, pause/resume, completion; timed no correct leak; AMBOSS unchanged.
- GitHub Actions Verify + Chromium pass before merge. Authenticated Cloudflare/Railway smoke and deployed SHA required to close issue (mocked browser does NOT establish live readiness).
