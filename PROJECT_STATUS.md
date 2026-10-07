# PROJECT_STATUS.md — MedPark frontend reconstruction

**Last updated:** 2026-10-07  
**Master epic:** #1  
**G1 parent:** #3 — Stabilize current frontend before new pages  
**Active issue:** #4 — Exam runner + results/review  
**Active phase:** G2 — Exam Runner  
**Current status:** MERGED + VERIFIED — AMBOSS Exam Runner now includes first-answer flow, explanation blobs, internal Library split links, Timed draft persistence, real Tutor/Timed clocks, configurable Timed duration, Tutor/Timed Suspend + End Block lifecycle, Marker/Pencil color palettes with dark-mode contrast, Calculator, and review-only AI Summary. Frontend latest feature merge is PR #24 (`14ecb212...`); backend timer persistence is PR #22 (`1500e4ae...`) and is live on Railway. Issue #4 remains open for Test Analysis/Results, My Notebook, detailed Flashcards UX, and later themes.

## 1. Repository ownership

| Role | Repository / branch | Authority |
|---|---|---|
| Canonical frontend | `geminiamo0-ship-it/medfront` → `main` | Current frontend implementation |
| Canonical backend/API | `geminiamo0-ship-it/medhvgg` → `main` | API, business rules, security, persistence, analytics |
| Backend reference snapshot | `medfront` → `backend` | Read-only historical/reference material; never deploy or develop from it |

Frontend API base: `https://medhvgg-production.up.railway.app/api`  
Cloudflare frontend runtime: `https://medfront.geminiamo0.workers.dev`

## 2. Current frontend state

| Area | State | Notes |
|---|---|---|
| Auth | Implemented | Login/register/verify/forgot/reset/complete profile |
| Hub | Implemented | Own entry experience |
| Dashboard | Implemented | Existing dashboard slice |
| QBank listing `/qbank` | **VERIFYING navigation polish** | Step tabs now act as Step roots and clear provider drill-down state |
| Selected QBank `/qbank/:bankId/*` | **VERIFYING responsive shell** | Dedicated workspace outside global AppLayout; desktop sidebar + responsive drawer; missing-Step recovery added |
| Create Test | **VERIFYING** | Mixed/filter correctness retained; Timed now supports 1:00 / 1:30 / 2:00 / 3:00 / Custom per-question duration with derived block-time preview |
| Previous Tests | Implemented | Uses QBank workspace shell; empty-state Create Test link preserves Step |
| Library | Advanced; follow-up parked | Library mobile/tablet explicitly deferred until separate user discussion; Library work is not the immediate next priority |
| Test runner | **AMBOSS MERGED + VERIFIED** | PR #24 adds live Tutor/Timed clocks, configurable timing, Suspend→Previous Tests, Tutor End Block, Marker/Pencil palettes + dark contrast; production Tutor timer smoke green |
| Results/review | Not implemented | Part of #4; final review design still deferred |
| Other parked surfaces | Not active | Follow master plan/issues |

## 3. Global delivery rule — responsive is part of Done

From 2026-10-05 onward, user-facing page work normally includes:
- desktop/laptop;
- tablet/iPad;
- mobile phone;
- no unintended horizontal overflow;
- intentional responsive navigation behavior;
- practical touch targets;
- viewport-safe dialogs/dropdowns/popovers;
- responsive keyboard/focus/accessibility checks.

This is recorded in `docs/PAGE_DELIVERY_WORKFLOW.md`.

### Explicit current exception

**Do not redesign or polish Library mobile/tablet yet.** The user wants to discuss Library responsive UX separately and in detail later.

## 4. Create Test correctness/product checkpoint

Approved and implemented:
- [x] canonical multi-mode request uses `mixed_modes`
- [x] `filters.modes` contains actual selected modes
- [x] subtle `Mixed · N selected`, no separate Mixed button
- [x] `MAX_TEST_QUESTIONS = 50` frontend-only Standard product limit
- [x] Standard invalid counts outside `1..50` block Create without silent clamping
- [x] live filtered `Available: N` beside Standard Questions
- [x] `MAX_CUSTOM_IDS = 50` frontend-only Custom product limit
- [x] Custom raw input is not silently truncated/erased
- [x] invalid Custom tokens are surfaced and block Create
- [x] systems/topics metadata source excludes selected `systemIds/topicIds`
- [x] final availability/create requests still include selected systems/topics
- [x] backend headroom remains higher (`totalQuestions` DTO max 200)
- [x] Custom UI `unused only` vs canonical backend behavior discrepancy is documented, not falsely marked verified
- [x] canonical status-filter contract is aligned across counts, selection, metadata and frontend refresh:
  - `All` = every accessible active question matching taxonomy/difficulty filters
  - `Used` = assigned to any user test; `Unused` = never assigned to any user test
  - `Correct` / `Incorrect` = latest answered attempt, mutually exclusive
  - `Marked` = current mark; `Marked Correct` / `Marked Incorrect` = mark ∩ latest result
  - `Omitted` = explicit blank or completed-unanswered question until later answered
  - `Suspended` = untouched question in a suspended test, cleared on resume/later attempt
  - mixed modes = DISTINCT union; `All` dominates narrower selections
- [x] backend count epoch invalidates on create, answer/omission, mark, suspend/resume, complete/end-block and delete
- [x] mixed-count cache uses the same per-user epoch; inaccessible-bank mixed counts fail closed to zero
- [x] frontend marks QBank count/progress/metadata queries stale after create, answer/omission, mark and timed End Block
- [x] Subjects/Systems/Topics count metadata accepts the selected single/mixed status modes
- [x] backend PR #18 merged; frontend PR #20 merged; frontend Verify #94 + AMBOSS Browser Smoke #19 green
- [x] Railway production smoke #8 passed controlled Used/Unused, Incorrect→Correct, Marked Incorrect→Marked Correct, Omitted→Answered, Suspended→Resume, mixed-set identities, cleanup, Tutor and Timed regressions

Page spec: `docs/page-specs/CREATE_TEST.md`.

## 5. Issue #11 — QBank workspace shell + responsive Create Test

### Shell/responsive work implemented
- [x] selected-bank route moved outside `AppLayout`
- [x] global header no longer belongs to selected-bank route source tree
- [x] `/qbank` list remains in `AppLayout`
- [x] desktop fixed QBank sidebar retained
- [x] tablet/iPad/mobile off-canvas drawer implemented
- [x] overlay / explicit Close / Escape / navigation close implemented
- [x] body scroll lock while drawer open
- [x] responsive QBank header/content padding
- [x] Create Test Standard/Custom responsive pass
- [x] status + difficulty controls use responsive touch-friendly grids
- [x] Subjects/Systems/Topics adapt to narrow screens
- [x] Custom Retrieve controls stack on mobile
- [x] Test Mode / Questions / Available / Create stack on narrow screens
- [x] Topic Search uses viewport-safe mobile panel

### Step integrity / navigation fixes implemented
- [x] Welcome → Create Test uses an absolute Step-preserving URL
- [x] Previous Tests empty-state → Create Test uses an absolute Step-preserving sibling URL
- [x] QBank sidebar links preserve Step
- [x] selected-bank URLs missing a valid Step resolve the bank's canonical Step from active-bank metadata and repair the URL
- [x] normal valid-Step navigation remains step-scoped
- [x] false `Bank not found for Step 1` behavior/copy corrected
- [x] **Step tabs now represent Step roots:** clicking Step 1/2/3/etc. clears the `bank` provider drill-down query state
- [x] returning to a Step via its tab does not intentionally restore the provider previously opened under that Step

### CI checkpoint
- Commit `236e30cd97e2a7e194e91b39634e5a9f1f5cfed1` implemented Step-root navigation.
- Verify #45 found one lint issue in the responsive shell: `setSidebarOpen(false)` was called synchronously inside a pathname effect.
- Redundant effect removed; drawer already closes explicitly through `onNavigate`.
- Commit `c3f8ba32abb8998f524127b6e48d03bf05707200` passed **Verify #46**: typecheck ✅ lint ✅ build ✅.

### Verification still open
- [ ] latest documentation/handoff head passes `Verify`
- [ ] browser desktop acceptance
- [ ] browser tablet/iPad acceptance
- [ ] browser mobile acceptance
- [ ] deployed runtime confirms global MedPark header is absent inside selected QBank workspace
- [ ] bare legacy selected-bank URL without `?step=` self-recovers to the correct Step
- [ ] Welcome/Create Test/Previous Tests navigation keeps Step correctly
- [ ] Step 1 → provider → Step 2 → Step 1 returns to Step 1 root, not the prior provider
- [ ] drawer open/close/overlay/Escape/navigation behavior verified
- [ ] no unintended QBank/Create Test horizontal overflow
- [ ] existing Create Test runtime checks: Mixed, 50/51 Standard, Custom validation, stable systems/topics
- [ ] authenticated single/mixed/custom create smoke against live backend

Page spec: `docs/page-specs/QBANK_WORKSPACE.md`.

## 6. Priority override approved by the user

On 2026-10-07 the user explicitly authorized Exam Runner implementation after approving the AMBOSS design direction and modular architecture.

Current priority:
1. AMBOSS runner implementation is merged to `main` via PR #12.
2. Shared Exam Core + registry remain theme-agnostic; each theme is independently replaceable.
3. Issue #4 remains open for explicitly deferred Exam Runner follow-ups/results-review work.
4. QBank Issue #11 runtime/browser acceptance remains open verification debt and is not falsely marked Done.
5. Library responsive work remains deliberately deferred.

Approved runner spec: `docs/page-specs/EXAM_RUNNER.md`.

## 7. Exact next step

The approved AMBOSS timer/lifecycle/color refinement is merged and verified.

Completed in the latest slice:
1. Timed countdown and Tutor count-up move every second from one shared source;
2. Create Test Timed duration is configurable and sends the derived canonical `timeLimitSeconds`;
3. Tutor/Timed Suspend persists timing; successful in-runner Suspend navigates to Previous Tests;
4. End Block is available for Tutor and Timed;
5. Marker/Pencil palettes and custom colors are implemented; marker dark-mode contrast is fixed.

Next Issue #4 design work should be selected explicitly by the user:
1. **Test Analysis / Results** design and final post-End-Block destination;
2. **My Notebook** shared cross-theme drawer — approved future placement is the top-bar right helper zone beside Calculator;
3. detailed Flashcards/Anki UX;
4. next production theme (UWorld / NBME / MRCP) after its own design approval.

AMBOSS source media remains intentionally deferred until the media files are uploaded.

## AMBOSS implementation checkpoint — 2026-10-07

Implemented on `feat/amboss-exam-runner`:
- shared typed Exam Runner API/core/registry;
- full-screen `/test/:testId` outside global `AppLayout`;
- isolated `themes/amboss` package;
- collapsible desktop sidebar + mobile drawer foundation;
- canonical 1–5 difficulty hammer rendering;
- sanitized AMBOSS rich HTML;
- `KEY INFO` clue toggle for imported `.Highlight`;
- `ATTENDING TIP` extraction from `.amboss-hint`;
- no visible Submit button;
- Tutor/Mixed first option click submits immediately and becomes the only persisted answer; later option clicks are explanation-only; `SHOW ANSWER` with no choice records omission and reveals all;
- Timed local selection/batch controller path without per-question reveal;
- Lab Values panel, Question Notes read/save, Mark persistence;
- Flashcards entry placeholder only;
- adopted SVG icon pack now used through shared `ExamIcon`;
- AMBOSS options isolated into their own component so rich HTML is not nested inside native buttons.

Verification evidence:
- latest implementation refactor head `03a55a58c9d863723f207f26e94fb2e0f52c4b00`;
- initial AMBOSS PR #12 merged to `main`; first-answer refinement PR #14 also merged;
- frontend GitHub Actions `Verify #60`: typecheck ✅ lint ✅ build ✅;
- AMBOSS styling is now split by responsibility under `themes/amboss/styles/` (tokens / shell / question / panels / responsive / appearance); `amboss.css` is import-only;
- backend difficulty contract merged to `medhvgg/main` via PR #1 (`fbba279f6ee8d615644497dd63f4ee6ede8d4410`);
- reusable authenticated production Exam Runner smoke merged via backend PR #2 (`876151a6120aa0da168708eac3be399d069b20fa`);
- production Exam Runner API Smoke #1 ✅: AMBOSS bank id=1/mainBankId=1, 2785 questions; Labs 5 categories/169 rows; Tutor mark+note+answer reload passed; canonical difficultyTier present; Timed no-pre-reveal + End-Block batch + answer reload passed;
- reusable AMBOSS media diagnostic merged via backend PR #3 (`1be935e3de8ce1ac135651ac959ae0ebec47c170`).

Automated browser verification:
- `AMBOSS Browser Smoke #1` passed in real Chromium on Desktop 1440×1000, iPad 834×1194, and Mobile 390×844.
- Verified sidebar/drawer behavior, 1–5 hammers, clue toggle, attending hint, Labs, Notes, Mark, SHOW ANSWER, and no page-level horizontal overflow.
- Screenshot artifact: `amboss-browser-smoke-37634636170` (artifact id `11488260316`).
- Final human visual approval remains open.

Still open before Done:
- Media deferral: AMBOSS `offline_media/...` files are not uploaded yet; user explicitly asked to skip this for the current runner pass.
- Backend media blocker: `geminiamo0-ship-it/medhvgg#4` — production AMBOSS HTML contains relative `offline_media/...` sources but current import pipeline never uploads media; do not guess a frontend prefix;
- post-merge visual refinements only when explicitly requested by the user;
- My Notebook shared drawer, detailed Flashcards/Anki UX, and final Test Analysis/Results design remain deferred; End Block, Settings placement, and Marker/Pencil placement are no longer deferred.

## 8. Definition of Done

A page/feature is not Done because code exists. Applicable gates include:
- [ ] user-approved UX/style/spec
- [ ] architecture boundaries respected
- [ ] acceptance criteria met
- [ ] typecheck/lint/build pass
- [ ] GitHub Actions `Verify` green
- [ ] desktop browser acceptance
- [ ] tablet/iPad browser acceptance
- [ ] mobile browser acceptance
- [ ] real API/E2E evidence for critical paths
- [ ] active issue/docs/`PROJECT_STATUS.md` reconciled
- [ ] exact next continuation point recorded

Explicit documented deferrals are allowed only when the user deliberately chooses them.

## 9. Continuation command for a new AI/developer

> Open `geminiamo0-ship-it/medfront`. Read `PROJECT_STATUS.md`, `AGENTS.md`, `docs/ENGINEERING_GUARDRAILS.md`, `docs/MASTER_PLAN.md`, `docs/PAGE_DELIVERY_WORKFLOW.md`, `docs/BACKEND_CAPABILITY_MAP.md`, master Issue #1, active Issue #4, `docs/page-specs/EXAM_RUNNER.md`, plus Issue #11/QBank specs for remaining verification debt. Treat `geminiamo0-ship-it/medhvgg/main` as canonical backend and `medfront/backend` as reference-only. AMBOSS timer/lifecycle/color work through frontend `14ecb212...` and backend `1500e4ae...` is complete and must not be repeated. The next Issue #4 work requires design approval for Test Analysis/Results or My Notebook/detailed Flashcards; My Notebook's future placement is the top-bar right helper zone beside Calculator. Library mobile/tablet and AMBOSS source media remain deferred.

## AMBOSS final technical checkpoint — 2026-10-07

Current frontend head: `c085f215410a79db303b81d52d1a49d432646444`

Latest verification:
- frontend GitHub Actions `Verify #68`: typecheck ✅ lint ✅ build ✅;
- `AMBOSS Browser Smoke #5`: ✅ in real Chromium;
- desktop 1440×1000 ✅;
- iPad 834×1194 ✅;
- mobile 390×844 ✅;
- mobile/iPad Labs settled-position assertion ✅ (panel reaches viewport edge after animation);
- clue, hint, Labs, Notes, Mark, SHOW ANSWER, sidebar/drawer and no-horizontal-overflow checks ✅;
- final screenshot artifact: `amboss-browser-smoke-37636551709` (artifact id `11489692315`).

Architecture sanity:
- `src/features/exam`: 23 files, ~55KB total;
- largest files are ~7–8KB;
- AMBOSS styles split into tokens/shell/question/panels/responsive/appearance;
- no giant theme file and no cross-theme UI coupling.

Backend cleanup:
- temporary deferred media diagnostic removed from backend `main` via PR #5;
- backend media issue #4 is explicitly DEFERRED until source media files are uploaded;
- media is not a blocker for the current runner pass.

Merge decision:
- user explicitly authorized merging without a separate Cloudflare preview;
- PR #12 merged to `main` as `d70d122631e52ec57989ac572186c4fc6a2c8565`;
- main GitHub Actions `Verify #70`: typecheck ✅ lint ✅ build ✅;
- intentionally deferred UI decisions remain deferred: final theme/appearance switch placement, marker/pencil placement, detailed Flashcards UX, final End Block UI.



## AMBOSS merged checkpoint — 2026-10-07

- PR #12 merged to `main`.
- Merge commit: `d70d122631e52ec57989ac572186c4fc6a2c8565`.
- Main GitHub Actions `Verify #70`: typecheck ✅ lint ✅ build ✅.
- User explicitly chose to merge without a separate Cloudflare preview, noting that later refinements remain easy because the theme is isolated and structured.
- AMBOSS media remains deferred until source media files are uploaded.
- Issue #4 stays open only for deferred runner follow-ups and results/review scope; AMBOSS runner implementation itself is merged.


## AMBOSS first-answer interaction checkpoint — 2026-10-07

Approved interaction is now merged to `main`.

Behavior:
- first Tutor/Mixed option click is the only persisted answer submit;
- that first answer remains the canonical correct/incorrect result;
- the first clicked option opens its inline explanation after server acknowledgement;
- later option clicks are presentation-only and open their own explanation/correctness state without another submit;
- `SHOW ALL EXPLANATIONS` opens every option without changing the recorded answer;
- `SHOW ANSWER` before any option sends `selectedOptionId=null`, records an explicit omission, and reveals all explanations;
- omission is returned as omitted immediately on Tutor/Mixed reload;
- Timed behavior is unchanged and continues to use End Block batch semantics;
- current question is pinned across post-submit refetches so a backend `resumeQuestionId` advance cannot jump the UI away before explanation reveal.

Merge evidence:
- backend PR #6 merged: `d399eadc6c258b47bbfa3ec2d252d6ac92a435d4`;
- frontend PR #14 merged: `50fd0552a55856c67f3ad7eb6820d07e399ae3a7`;
- frontend `Verify #77` on PR head: typecheck ✅ lint ✅ build ✅;
- `AMBOSS Browser Smoke #12`: ✅;
- browser smoke assertions: `first_answer_submit=true post_submit_inline=true show_all=true omitted=true`;
- frontend `main` `Verify #78`: ✅;
- backend PR #6 `Verify #7`: ✅.

No further first-answer-flow work is pending unless runtime feedback exposes a real issue.


## AMBOSS imported explanation blob checkpoint — 2026-10-07

Root cause verified from current AMBOSS data shape:
- `questions.explanationHtml` contains one combined HTML blob with sections such as `a (Incorrect)`, `b (Incorrect)`, ... `e (Correct)`;
- `question_options.explanationHtml` is nullable and may be empty for these imports;
- the previous runner only rendered per-option explanation fields, so valid explanations in the question-level blob were invisible.

Implemented:
- theme-local `parseAmbossExplanationHtml()` in the AMBOSS markup adapter;
- sanitized blob is split by option letter markers A/B/C/D/E;
- structured option-level explanation remains preferred when present;
- parsed blob explanation is the fallback only when the option-level field is empty;
- `.amboss-learning-obj` is extracted separately so it is not appended to option E;
- no shared Exam Core or backend contract change.

Evidence:
- frontend PR #15 merged to `main`;
- merge commit: `55f61d1a607e4ab6203dbb18837da5ed31f2d780`;
- `Verify #80` on PR head ✅;
- `AMBOSS Browser Smoke #13` ✅ with `blob_explanations=true`;
- smoke mocks the real import shape: all option `explanationHtml=null`, all A/B/C/D/E explanations in the question-level blob;
- frontend `main` `Verify #81` ✅.


## AMBOSS option-order + internal-library checkpoint — 2026-10-07

### Canonical option ordering
Source SQLite `options.option_order` is now treated as authoritative.

Backend PR #7:
- preserves letter-valued `option_order` such as A/B/C/.../H during both SQLite import paths;
- continues to support 0-based and 1-based numeric order sources;
- explicitly sorts runtime question options by canonical `displayOrder` before API output;
- caches static question content with canonical option ordering;
- explanation endpoint now selects `opt.displayOrder` and sorts options consistently;
- shared order utility has targeted Jest coverage.

Evidence:
- backend option-order unit tests: 3/3 ✅;
- backend Verify #9 ✅;
- production Exam Runner API Smoke #3 ✅;
- backend PR #7 merged to `main` as `78ed4bc6e94f0827cdbfc0ab4307ff5942351510`.

### Final-option explanation
Frontend PR #16 added an 8-option A–H regression with H as the final/correct option:
- H explanation parsed from the combined question-level AMBOSS blob ✅;
- H correct styling ✅;
- SHOW ALL reveals all 8 explanations ✅;
- omission reveal exposes all 8 explanations ✅.

Evidence:
- frontend Verify #83 ✅;
- AMBOSS Browser Smoke #14 ✅;
- PR #16 merged as `dd5e44a34bf2d32f64021086ee57b63b8532ac60`.

### AMBOSS explanation links → MedPark Library
Production backend verification proved real AMBOSS external article IDs resolve locally:
- `SM0yLg` → internal article `2583`;
- `Of0Im2` → internal article `2494`;
- `ek0x5T` → internal article `2875`.

Frontend PR #17:
- rewrites AMBOSS explanation links carrying `data-learningcard-id` / `xid` to `/library?source=amboss&article=<externalId>&anchor=<anker>`;
- keeps the stable AMBOSS external ID in the URL instead of coupling Exam Runner to internal article PKs;
- LibraryPage resolves the deep-linked external ID through the existing backend resolver;
- preserves section anchor;
- deduplicates in-flight deep-link article loads.

Evidence:
- frontend Verify #85 ✅;
- AMBOSS Browser Smoke #15 ✅ with `internal_library_link=true`;
- smoke clicks a rewritten AMBOSS link and successfully loads the internal MedPark Library article;
- PR #17 merged as `daf470d64eda4560c02c15d9ef9c80a97db578a7`;
- frontend main Verify #86 ✅.


## AMBOSS timer / lifecycle / annotation refinement checkpoint — 2026-10-07

Merged:
- frontend PR #24 → `14ecb212cfac91b5abbf514adc09c9219f30b6bc`;
- backend PR #22 → `1500e4aeb71a1b7cf563e0a196f0a05ffc6a9e17`;
- Railway deployment `c98b91a9-44ea-4f8b-920a-8922433405df` → SUCCESS.

Delivered:
- real one-second Timed countdown and Tutor count-up, shared by topbar/sidebar;
- Timed Create Test presets 1:00 / 1:30 / 2:00 / 3:00 / Custom plus derived block time;
- Tutor elapsed-time persistence across Suspend/Resume;
- successful Suspend navigation to Previous Tests;
- End Block available for Tutor and Timed;
- Marker/Pencil six-color palettes + Custom color;
- exact Marker color persistence and dark-mode contrast-safe rendering;
- Pencil uses selected color for new strokes; Laser unchanged.

Evidence:
- frontend Verify #108 ✅;
- AMBOSS Browser Smoke #28 ✅: `timed_create_duration=true timed_timer_ticks=true tutor_timer_ticks=true tutor_suspend_navigation=true tutor_end_block=true marker_palette=true marker_dark_contrast=true pencil_palette=true`;
- backend Verify #25 ✅;
- production Exam Runner API Smoke #10 ✅: `TUTOR_TIMER_OK test=223221 suspend_elapsed=37 resume_preserved=true complete_elapsed=42`;
- Tutor/Timed/Labs/AMBOSS Library production regressions remained green.

Deferred by product decision:
- final Test Analysis / Results page and post-End-Block navigation;
- My Notebook shared cross-theme drawer (future top-bar right helper zone beside Calculator);
- detailed Flashcards/Anki UX;
- AMBOSS media upload/path completion;
- other production themes.
