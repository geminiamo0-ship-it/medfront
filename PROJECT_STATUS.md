# PROJECT_STATUS.md — MedPark frontend reconstruction

**Last updated:** 2026-10-09  
**Master epic:** #1  
**G1 parent:** #3 — Stabilize current frontend before new pages  
**Active issue:** #53 — MedPark Results V1 compact visual polish (user approved 2026-10-09 from screenshot comparison), parent #51 remains OPEN / VERIFYING for actual deployed Cloudflare + signed-in acceptance. Earlier #47/#45 and external runtime gates remain open.
**Current bugfix (2026-10-09):** User reported Create Test redirect to Hub; root cause was invalid `/dashboard/test/:id` falling through to `/hub`. **Fix PR #50 merged** (`01a50cd2bc762b9004c53025c921b24bdb038c59`): both Library sources now use registered `/test/:testId` via SPA navigation. Chromium AMBOSS Browser Smoke [#37846546510](https://github.com/geminiamo0-ship-it/medfront/actions/runs/37846546510) PASS proving a loaded AMBOSS stem, not just navigation; Verify [#37846546499](https://github.com/geminiamo0-ship-it/medfront/actions/runs/37846546499) PASS. Backend/DB unchanged by fix; Cloudflare live acceptance unverified.  
**Active phase:** G2.7 — Shared Results & Analytics V1, without redesigning the Exam Engine, Previous Tests page or MedPark Shell.
**Visual polish #53 (2026-10-09):** CODE MERGED / CI VERIFIED; live Cloudflare gate OPEN. Frontend PR [#54](https://github.com/geminiamo0-ship-it/medfront/pull/54) merged to `main` as `a9843930c4dff172c524b40f41a7d36bc9b7f1a6`. Four KPI summary, consistent 2.5% donut, compact correct/incorrect/omitted legend, topic-only recommendations and five-tier difficulty. GitHub Actions Verify [#37856084614](https://github.com/geminiamo0-ship-it/medfront/actions/runs/37856084614) PASS and Chromium [#37856084612](https://github.com/geminiamo0-ship-it/medfront/actions/runs/37856084612) PASS on final PR head; reviewed desktop 1280/tablet 834/mobile 390 screenshots on previous passing run #37855787234. 1/40→2.5% in both labels, 39 omitted, empty Recommendations compact, five tiers, no overflow. Backend, Shell and exam lifecycle unchanged. Cloudflare deployed-commit and signed-in live verification remain UNVERIFIED; issue #53 OPEN / VERIFYING.
**Results V1 checkpoint (2026-10-09):** Backend PR #35 merged to `medhvgg/main` (`4d3cec5b`), Backend Verify #37852759365 PASS and Railway Production deployment SUCCESS (`596f5eeb`). Frontend PR #52 merged to `medfront/main` (`1400ade9`); Verify #37853794595 PASS, AMBOSS Browser Smoke #37853794549 PASS including Tutor and Timed End Block → Results, Review Questions and mobile report. Results is shared across banks, with real correct/incorrect/omitted, saved timing, stored five-tier difficulty and primary topic names only. **Cloudflare deployed version and real authenticated results still UNVERIFIED.** Issue #51 remains OPEN / VERIFYING.  
**Current status:** AMBOSS Article Create Test code merged to main (backend PRs #31, #32, #33; frontend PRs #48, #49). Backend source-aware indexed article filter and existing Library button are implemented. Railway production guarded backfill COMMITTED/VERIFIED on 2026-10-08: 2,783/2,785 AMBOSS questions linked, 2 intentionally unmatched; final backend deployment SUCCESS, and temporary pre-deploy reset to empty. Frontend PR #49 Chromium browser smoke PASS (mocked API): button click submits internal article ID and navigates correctly. Frontend main push Verify PASS on `bfa2aecd3ac8e2671735b515cbf1bc7ec547253c` ([run #37845043182](https://github.com/geminiamo0-ship-it/medfront/actions/runs/37845043182)). **Cloudflare deployed commit and live authenticated production test creation remain UNVERIFIED**; #47 stays OPEN / VERIFYING. Existing Issue #45: User-supplied Inspect showed a valid prenatal serum-marker `<table>` but old AMBOSS CSS forced `display:block`, collapsing the visible column layout. Focused Issue #45 and approved EXAM_RUNNER §21 resolved with a theme-only sanitized `AmbossRichHtml` table scroll adapter and native grid styles. [PR #46](https://github.com/geminiamo0-ship-it/medfront/pull/46) merged to main at `ec5bf7715ba02029bd97203a852680d90a5d02c7`, Verify #178 ✅, Chromium Browser Smoke #64 ✅: exact 5-column AFP/Estriol/HCG/Inhibin A table with rows A–E, numeric hemoglobin/platelet tables, header scope/grid, explanation reveal, desktop/iPad/mobile local overflow, dark mode and prior Tutor/Timed/Library/Image regressions. **Issue #45 remains OPEN / VERIFYING for Cloudflare deployed-version and live real table inspection**; GitHub Actions success is not production proof. No backend/DB changes or other-page work.

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
| Test runner | **AMBOSS MERGED + VERIFIED** | PR #34 screenshot-approved sidebar: real sanitized question previews, selected/omitted/correct/incorrect indicator, progress bar, hammers/marks, SESSION + QUESTION clocks, working Exit; Browser Smoke #40 green. Previous Omitted-review and Tutor active-solving contracts preserved. |
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

**Active priority #53 (visual polish):** PR #54 MERGED to `main` (`a9843930`). Final PR Verify #37856084614 PASS and AMBOSS Browser Smoke #37856084612 PASS. **Next:** recheck `main` Verify and verify Cloudflare deployed frontend includes `a9843930` or newer; perform signed-in genuine Results test + authorization/locked states. Keep #53 and parent #51 OPEN/VERIFYING until real runtime proof. No new page/style work before explicit user discussion.

**Current priority #51 (RESULTS V1 CI-verified, live gate remaining):** Backend and frontend merged; Verify #37852759365, #37853794595 and Browser Smoke #37853794549 PASS. Railway Production backend `4d3cec5b` SUCCESS. Next: confirm Cloudflare serves frontend commit `1400ade9` or newer and complete one real signed-in Tutor and Timed session; verify `/test/:id/results` fields and Previous Tests, topic/difficulty totals, locked results and cross-bank behavior. Existing snapshots freeze overall score/time; per-topic and difficulty categories reflect current metadata until immutable category snapshots are separately designed. No ranking, percentile, scores, memes, AI or branding redesign. Do not close #51 or other runtime gates until verified.

**Current priority #47 (route fix merged; Cloudflare runtime gate):** PR #50 `01a50cd` fixed the redirect-to-Hub issue and is merged to `main`. Chromium Browser Smoke #37846546510 PASS: article → Create Test → `/test/9004` → rendered AMBOSS question stem. Frontend Verify #37846546499 PASS. **Next:** confirm Cloudflare has deployed PR #50 or later; perform real signed-in article #967 Create Test and verify the exam contains only `questions.articleId=967`, plus failure/entitlement and Passmedicine/Pastest regression paths. Remain `VERIFYING` until deployed live test; #45 independently awaits Cloudflare table acceptance.

**Issue #45 — VERIFYING Cloudflare live tables:** user-approved AMBOSS semantic medical tables slice merged via PR #46 (`ec5bf7715ba02029bd97203a852680d90a5d02c7`), [PR Verify #178](https://github.com/geminiamo0-ship-it/medfront/actions/runs/37834715597) PASS, [Chromium Browser Smoke #64](https://github.com/geminiamo0-ship-it/medfront/actions/runs/37834715568) PASS on desktop/iPad/mobile including literal user-supplied prenatal AFP/Estriol/β-HCG/Inhibin A table and numerical lab tables. §21 spec committed before code. Main/docs Verify must be completed before signoff.

**First unchecked runtime gate:** independently confirm Cloudflare production deploy includes PR #46 or later and inspect a real AMBOSS question with imported five-column/numeric table: visible grid and headers, correct arrows/values, responsive horizontal panning on a narrow phone, light/dark contrast. If runtime version or actual article content is inaccessible, keep #45 OPEN / VERIFYING rather than calling production Done.

**Independent open gates:** #43 exact Library-anchor/spotlight production acceptance; #41 linked source section production acceptance; #38 Image Viewer deployed version; #32 actual R2 objects HTTP 200 image MIME. GitHub Chrome fixtures are mocked; don't claim real bucket or Cloudflare live state.

**Out of scope:** G2 Results/Review, Notebook, Flashcards, additional theme designs and unrelated QBank #11 remain parked until new user-approved spec. Backend schema/import follow-up beyond the guarded AMBOSS article mapping remains deferred.

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

> Open `geminiamo0-ship-it/medfront`. Read `PROJECT_STATUS.md`, `AGENTS.md`, `docs/ENGINEERING_GUARDRAILS.md`, `docs/MASTER_PLAN.md`, `docs/PAGE_DELIVERY_WORKFLOW.md`, `docs/BACKEND_CAPABILITY_MAP.md`, master Issue #1, active Issue #4, and `docs/page-specs/EXAM_RUNNER.md`. Treat `geminiamo0-ship-it/medhvgg/main` as canonical backend and `medfront/backend` as reference-only. Tutor active-solving-time through frontend `f8b754257...` and backend `f027476d...` is complete and must not be reverted to wall-clock/session-open time. Future themes must consume this shared Exam Core rule. Next Issue #4 work requires design approval for Test Analysis/Results, My Notebook, or detailed Flashcards. Library mobile/tablet and AMBOSS source media remain deferred.

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


## AMBOSS live timer production bugfix — 2026-10-07

Observed production symptom:
- visible Tutor/Timed timer could appear frozen while server timing continued.

Root fix:
- backend `GET /tests/:id` now returns server-authoritative `timerElapsedSeconds`;
- frontend uses that snapshot as the display baseline and advances it locally every second;
- `startedAt` parsing is fallback only;
- returning to a visible browser tab forces an immediate timer resync.

Evidence:
- backend PR #24 → `e8f2743d053bfb1701b4feea4e9b51194b8b6102`;
- Railway deployment `05fb3803-5c5a-4b1e-9048-5c89a9608fb0` → SUCCESS;
- production Exam Runner Smoke #11: Tutor `0→1`, Timed `0→1` for `timerElapsedSeconds`;
- frontend PR #26 → `9b5d3114e4031494e34351828a01bb22485c5643`;
- frontend main Verify → SUCCESS;
- AMBOSS Browser Smoke #29 → SUCCESS with `startedAt` intentionally unavailable in Tutor/Timed mocks;
- Cloudflare Workers production Version `c30cb541-8344-4ebb-841d-b6384f5126ba` → SUCCESS.

The frozen visible-timer bug is closed.


## Tutor active-solving-time checkpoint — 2026-10-08

Product rule:
- Tutor time is **net solving/thinking time before first submission**, not wall-clock session time.
- Unanswered question → timer runs.
- First option click or SHOW ANSWER → timer pauses immediately.
- Explanation/review/Labs/Notes/Library/post-answer time → excluded.
- Navigate to an unanswered question → timer resumes from accumulated total.
- Navigate to answered/omitted question → timer stays paused.
- Timed mode remains a continuous countdown.

Implementation:
- shared Exam Core owns the running/paused state so later UWorld/NBME/MRCP themes inherit it automatically;
- frontend sends each Tutor question's solving delta as `timeSpentSeconds`;
- backend persists per-question delta in `question_submissions.timeSpentSeconds`;
- backend aggregates net solving time in `tests.timeSpentSeconds`;
- Tutor retrieval returns persisted active time only; it never adds `now - startedAt`;
- Suspend/Resume/End Block preserve the same net total.

Merged/deployed:
- backend PR #26 → `f027476dc08b2639376e7c4016baa4ef36a9edc1`;
- Railway deployment `5743176d-e76f-45af-879e-299978403937` → SUCCESS;
- frontend PR #28 → `f8b754257c2eafd067cdb0aadb1328f1e747c739`;
- Cloudflare Workers production Version `dfaacb5e-3f18-493a-a0c3-f93a746c5d27` → SUCCESS.

Evidence:
- backend Verify #29 ✅;
- production Exam Runner API Smoke #12 ✅:
  `TUTOR_ACTIVE_TIME_OK ... pre_submit_static=0 submitted_delta=3 persisted=3 review_static=3`;
- frontend Verify #117 ✅;
- AMBOSS Browser Smoke #31 ✅:
  `tutor_pause_on_submit=true tutor_resume_unanswered=true tutor_submit_time_delta=true`;
- main frontend Verify after merge ✅.

Do not reintroduce Tutor wall-clock counting in a theme. This is now a shared engine contract.


## Completed-Omitted review checkpoint — 2026-10-08

Canonical rule:
- `Omitted` records that no answer was submitted before End Block; it is not a post-completion visibility lock.
- completed Omitted questions expose the server-authoritative correct answer;
- explanations stay collapsed by default and open per option on click, with `SHOW ALL EXPLANATIONS` available;
- review is presentation-only and must not create/update a submission, draft, score, answered count, or QBank result state;
- block-result locking remains authoritative.

Implementation/deployment:
- frontend PR #30 → `662a7715a487d8357c450193ebb241d63c7f088e`;
- Cloudflare Workers production Build `fdb02340-106c-42f4-8624-0aa50c175f41`;
- Cloudflare production Version `15880f3a-b667-4d28-ba19-dc0c4ae173b4` → SUCCESS;
- no backend code change required.

Evidence:
- frontend Verify #123 ✅;
- AMBOSS Browser Smoke #34 ✅:
  `omitted_review_correct=true omitted_review_explanation_fetch=true omitted_review_no_mutation=true`;
- production Railway Exam Runner API Smoke #13 ✅:
  `OMITTED_REVIEW_OK test=223237 question=823 omitted=true userAnswer=null correctness=true explanation=true no_mutation=true`;
- backend diagnostic PR #28 was closed unmerged after Verify #31 + production smoke passed;
- frontend main Verify after merge ✅.

Do not treat Omitted as a reason to hide answers after completion in future themes.

## Global R2 media origin migration — 2026-10-08

**Priority override / issue:** #32. User explicitly requested replacement for every media URL in the entire website, not just AMBOSS. The sidebar screenshot design is approved under Issue #4 but is a separate forthcoming visual slice.

**New canonical public media origin:** `https://pub-2a81f2cb19cc4473a3d076e657af6121.r2.dev/`.

**Implementation branch:** `feat/global-r2-public-media-origin` in both `medfront` and canonical backend `medhvgg`.
- frontend `MEDIA_CDN` points to the new R2;
- legacy absolute storage URLs in nested JSON are remapped centrally after API response decryption;
- `safeRichHtml` remaps legacy origins before sanitizer without weakening sanitization;
- library/offline-media/amboss illustration paths preserve original object keys;
- backend `/media/proxy` now pins upstream to the new R2 while preserving legacy proxy URL compatibility and disallowing arbitrary hosts/HTTP/custom ports;
- frontend Chromium regression covers question/option legacy links and unrelated host isolation;
- backend Jest regression covers fixed origin, path/query preservation, allowed old hosts and malicious scheme-relative paths.

**Verified release:**
- Backend PR #29 → `e3c8724b9710f452c29f6a2fad8c53b9bd00eb7d`, backend Verify #33 ✅, Railway deployment `b2ba2947-bcd3-479b-a7c4-f8686b9856f5` SUCCESS.
- Frontend PR #33 → `73f698399b268d09ad7bdacfe5b4911f93446210`, main Verify run `37697789982` ✅, AMBOSS Browser Smoke #36 ✅ (`global_r2_media_origin=true`), Cloudflare production Version `e502ebae-4b16-4aea-bba8-1bc80b80a777` SUCCESS.
- All source HTML and DB records remain unchanged; the remapping happens at the API/HTML rendering boundary.
- Actual media-file availability remains **NOT VERIFIED** until fetching real objects from the newly supplied public R2 yields HTTP 200 and an image MIME type.

**Next step:** get a representative known-live image filename, verify the new public R2 endpoint response and embedded library/exam render. Keep external media availability separate from successful URL migration.


## Screenshot-approved AMBOSS sidebar checkpoint — 2026-10-08

**User reference:** left question navigator screenshot with session name, progress bar, first stem words, row status, difficulty hammers, per-session/per-question timing, EXIT SESSION.

Frontend PR #34 → `9c5acc78483b6f7a12463a62d05480d54755d458` merged.
- All rows display the actual sanitized beginning of `textHtml`; hints and markup are excluded. No new API reads.
- Session title, answered/selected fraction and visual progress bar.
- Explicit `unanswered / selected / correct / incorrect / omitted` styles, with Timed correctness hidden pre-completion.
- 1–5 hammers and marked state preserved.
- Dual footer clocks: session/remaining time from canonical controller, question-local display time derived without mutating persisted exam totals.
- Exit Session uses existing Suspend→Previous Tests flow and navigation on completed tests.
- Responsive mobile/iPad drawer, dark styling and keyboard/focus affordances.

**Automated evidence:** frontend Verify #133 ✅; AMBOSS Browser Smoke #40 ✅ including `sidebar_stem_previews=true sidebar_progress=true sidebar_question_timer=true sidebar_exit_navigation=true`, plus all prior AMBOSS/regression flags (Tutor timing/Timed correctness, notes, marks, Omitted review).

**Final production deployment checkpoint:** Code-merge Cloudflare first build failed, but subsequent identical product-code main docs merge `e86ce00e04c2b41a85aecd9a8a406f7b12be3f95` triggered production Build `fc96eee6-1aa7-4483-a565-2649b0d8bce5` → SUCCESS, Version `57145276-f70a-4515-88a1-ef4c782d7593`; main Verify SUCCESS. Sidebar now production-deployed.


## Global relative-media rendering regression — 2026-10-08 (in progress)

- Existing site-wide R2 origin migration frontend #33 / backend #29 is merged and deployed; it remains the canonical URL.
- Screenshot evidence: AMBOSS option explanation uses a bare `offline_media/...` img source and displays broken media.
- Root cause in current `main`: `rewriteLegacyMediaUrls` only handles legacy **absolute** hosts; sanitizer leaves bare `offline_media/` attributes relative to the app route.
- Reopened Issue #32 for focused contract-only correction, not a new page design.
- Working branch: `fix/global-relative-r2-media`, shared media URL helper/sanitizer attribute hook plus mocked Chromium stem/option image regression and media documentation.
- **Verified:** fix PR #37 merged `daeb1b1d0`; Verify #140 ✅; AMBOSS Browser Smoke #42 ✅; main merge Verify run `37700603674` ✅.
- **Live R2 failure:** public object probe [run #1](https://github.com/geminiamo0-ship-it/medfront/actions/runs/37700441479) → sample screenshot key `offline_media/ihg_681237c83e6287_31701899.jpg` responds HTTP 404 / text/html. No real image availability claim.
- **Still pending:** Cloudflare deployment confirmation for fix merge, correct object upload/key matching, GET HTTP 200 image MIME + real browser render. Issue #32 stays OPEN / VERIFYING.


## AMBOSS shared image viewer implementation checkpoint — 2026-10-08

- User-approved decisions: reuse AMBOSS Library Image Viewer; side-by-side stem thumbnails, compact option explanation thumbnails, explicit SHOW/HIDE OVERLAY as optional hint; Description hidden in UI before Tutor answer or Timed End Block, shown afterward; alt/metadata remain in DOM/API, no anti-cheat backend changes.
- Focused Issue #38, PR #39 (`feat/amboss-image-viewer-reuse`). Approved page spec §18 committed prior to product code.
- Shared Viewer: `src/components/media/AmbossImageViewer.tsx` + CSS; Library re-export maintains same import path. Theme-local interaction bridge/parser + CSS for thumb rail and reveal state; no duplicated API or scoring logic.
- PR Verify #151 PASS; AMBOSS Browser Smoke #50 PASS incl. actual image attribute clicks, overlay toggling and synchronized zoom, Tutor/Timed reveal checks, DOM thumbnail rail/size, mocked image-404 placeholder, Library Viewer regression, desktop/iPad/mobile.
- Merged: PR #39 → `dedcfad064b95660236fb9e4250eeeabef2b50f3`; PR Verify #153 ✅, Browser Smoke #52 ✅, main Verify #154 ✅.
- Still pending: independently confirm Cloudflare production build/version and real-image rendering. #38 stays OPEN / VERIFYING. #32 independently tracks R2 object response checks. No Done claim yet.

## Live AMBOSS image-heading follow-up — 2026-10-08

- User-provided screenshot showed diagnosis `Osgood-Schlatter disease` in the Viewer heading before any answer, while Description was correctly visually hidden. Root cause: `#aiv-title` rendered imported `data.title` unconditionally.
- Fixed in frontend PR #40, squash merge `1104b88527f5fac57ea3d4682b85ae9ebfb97883`: generic `Medical Illustration` until `showDescription` becomes true. Post-reveal diagnosis/description and Library behavior preserved. No backend/DB mutation, imported alt/title metadata stays.
- Verify #157 ✅; AMBOSS Browser Smoke #53 ✅ on branch: `diagnostic_title_hidden_before_answer=true overlay_bitmap_decodes=true`, Tutor/Timed/Library regressions desktop/iPad/mobile ✅.
- Still needs independent Cloudflare production deploy/version and real object check if SHOW OVERLAY yields no actual layer for the user's screenshot. The screenshot button reads SHOW OVERLAY, meaning layer is intentionally off until clicked; don't imply a broken overlay solely from that screenshot. Issue #38 VERIFYING; Issue #32 separately handles R2 availability.

## AMBOSS Library-reference navigation checkpoint — 2026-10-08

- Approved user screenshot: correct answer has subtle independent Main Article button; genuine linked terms get dotted underline; click goes to exact section, not beginning.
- Focused Issue #41, approved spec `docs/page-specs/EXAM_RUNNER.md` §19 created before code; PR #42 `feat/amboss-library-deep-links-source` squash merged to main as `e7c5043762e6e5e9d9ae762756135f2c39f353c5`.
- Frontend changes: AMBOSS article H2 anchor preservation, expand/highlight exact section; same-article changed query anchor and wrong-article guard; metadata-only correct-answer Main Article button; AMBOSS-linked term underline and sanitized source preview + existing Split/New Tab menu.
- No guessed source, no backend changes, no new external requests per answer merely to fetch a Main Article title; label 'Main article' when metadata lacks the name.
- PR Verify #162 success; AMBOSS Browser Smoke #54 success including `precise_library_anchor=true same_article_anchor_no_refetch=true main_article_relation=true dotted_related_terms=true` and prior Tutor/Timed/Library/image/mobile regressions; main Verify #163 success.
- **Production not independently confirmed.** Remain VERIFYING in #41 until deployed-version and live acceptance. R2 #32 and Image Viewer #38 remain separately VERIFYING.

## AMBOSS exact anchor centering / spotlight checkpoint — 2026-10-08

- User explicitly authorized subtle Smart Scroll + two-pulse Spotlight. Focused Issue #43; approved page spec §20 saved before code; PR #44 merged to main as `c6ed90699467de7baea1b6abafee1dcd8bb0a912`.
- One shared scrollToAnchor() utility handles exact heading/inline term IDs, collapsed cards, real nested article scrollport, bounded centering correction, cancellation when newer link/user interaction occurs; original data content unchanged.
- CSS two soft turquoise pulses ~1.75s without layout or typography shift; prefers-reduced-motion static outline.
- Final PR Verify #172 PASS, Browser Smoke #61 PASS (desktop/iPad/mobile exact center, inline word, reduced motion, existing Tutor/Timed/Library/image regression). Earlier mobile test caught real ~45px center drift; corrected and retested, not waived.
- Main documentation/CI and independent Cloudflare deployed version/runtime remain the last gates; Issue #43 OPEN / VERIFYING. Existing #41/#38/#32 external acceptance gates remain separate.

## AMBOSS native medical table checkpoint — 2026-10-08

- Evidence: exact prenatal table from user HTML had valid THEAD/TBODY scoped TH/TD but AMBOSS question CSS set table display:block; source data did not need repair.
- Approved focused Issue #45, page spec EXAM_RUNNER §21 committed before code. PR #46 merge `ec5bf7715ba02029bd97203a852680d90a5d02c7`.
- Theme-only `AmbossRichHtml.tsx` uses SafeHtml sanitizer, reuses existing modal-overflow-scroll frames or wraps bare imported tables once. Shared for question, option, explanation and hint; CSS native table, borders/zebra/row headers, aligned numeric data, light/dark, local horizontal overflow.
- PR Verify #178 success, Browser Smoke #64 success with literal AFP/Estriol/HCG/Inhibin A table and hemoglobin/platelets; desktop/iPad/mobile, header scope, no overlapping cells, mobile scroll and no outer overflow, dark contrast and previous AMBOSS regressions.
- Main/docs Verify and Cloudflare live deployed version are separate gates. Issue #45 remains OPEN / VERIFYING until real runtime acceptance. Issues #43/#41/#38/#32 remain independent external checks.
