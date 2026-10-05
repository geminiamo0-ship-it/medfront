# PROJECT_STATUS.md — MedPark frontend reconstruction

**Last updated:** 2026-10-05  
**Master epic:** #1  
**G1 parent:** #3 — Stabilize current frontend before new pages  
**Active issue:** #11 — QBank workspace shell + responsive Create Test  
**Active phase:** G1 — Existing frontend stabilization  
**Current status:** VERIFYING — responsive QBank/Create Test source implemented; runtime Step-loss regression fixed in source; latest CI + runtime viewport verification remain

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
| QBank listing `/qbank` | Implemented | Remains inside global `AppLayout` |
| Selected QBank `/qbank/:bankId/*` | **VERIFYING responsive shell** | Dedicated workspace outside global AppLayout; desktop sidebar + responsive drawer implemented; missing-Step recovery added |
| Create Test | **VERIFYING** | Mixed fix, stable metadata, Standard/Custom max 50, live availability, responsive pass implemented; Step-safe navigation fixed |
| Previous Tests | Implemented | Uses QBank workspace shell; empty-state Create Test link now preserves Step |
| Library | Advanced; detailed follow-up required | **Library mobile/tablet explicitly deferred until separate user discussion** |
| Test runner | Placeholder | Design-first Issue #4; do not start before G1 is reconciled |
| Results/review | Not implemented | Part of #4 |
| Other parked surfaces | Not active | Follow master plan/issues |

## 3. Global delivery rule — responsive is now part of Done

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

**Do not redesign or polish Library mobile/tablet yet.** The user wants to discuss Library responsive UX separately and in detail first. This deferral is intentional and does not weaken the responsive rule for QBank/Create Test or future approved pages.

## 4. Create Test correctness/product checkpoint

Approved and implemented before the responsive slice:
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

Page spec: `docs/page-specs/CREATE_TEST.md`.

## 5. Issue #11 — QBank workspace shell + responsive Create Test

### User-approved problem/solution

A runtime screenshot showed the global MedPark header (`Home / Dashboard / Contests / Library`) above the bank-specific QBank shell (`Welcome / Create Test / Previous Tests`). Inspection confirmed `/qbank/:bankId` was nested inside `AppLayout`, while `QbankWorkspace` already owned another navigation shell.

Approved structural fix:
- `/qbank/:bankId/*` owns a dedicated protected workspace outside `AppLayout`;
- `/qbank` bank selection remains in global `AppLayout`;
- desktop keeps the fixed dark QBank sidebar;
- below `lg`, sidebar becomes an off-canvas drawer;
- drawer closes by close button, overlay, Escape and QBank navigation;
- body scroll locks while drawer is open;
- QBank header/content use responsive spacing with no intended horizontal overflow;
- Create Test receives a dedicated premium mobile/tablet/iPad pass.

Page spec: `docs/page-specs/QBANK_WORKSPACE.md`.

### Runtime Step-loss regression found and fixed in source

User supplied a Cloudflare runtime screenshot showing `/qbank/39/create-test` rendering `Bank not found` with the URL missing `?step=`. Source inspection found:
- `WelcomePage` locked-results CTA linked to `create-test` without Step context;
- `PreviousTestsPage` empty-state Create Test link also did not preserve Step/sibling routing safely;
- `QbankWorkspace` defaulted a missing Step to `1`, so valid banks from another Step could be misclassified as missing.

Implemented remediation:
- [x] Welcome → Create Test now uses an absolute Step-preserving URL
- [x] Previous Tests empty-state → Create Test now uses an absolute Step-preserving sibling URL
- [x] normal QBank sidebar links preserve Step
- [x] if selected-bank URL has no valid Step, `QbankWorkspace` uses existing unscoped active-bank metadata to resolve the bank's canonical `step`
- [x] resolved Step is persisted and URL is replaced with canonical `?step=N`
- [x] normal valid-Step navigation remains step-scoped; no extra unscoped request is added to the normal path
- [x] false `Bank not found for Step 1` copy was replaced with neutral missing/unavailable copy for true failure cases

### Source implementation completed
- [x] selected-bank route moved outside `AppLayout`
- [x] global header no longer belongs to selected-bank route source tree
- [x] `/qbank` list remains in `AppLayout`
- [x] desktop fixed QBank sidebar retained
- [x] tablet/iPad/mobile off-canvas drawer implemented
- [x] overlay / explicit Close / Escape / navigation close implemented
- [x] body scroll lock while drawer open
- [x] Step query context preserved through QBank sidebar navigation
- [x] responsive QBank header/content padding
- [x] Create Test Standard/Custom toggle responsive
- [x] status + difficulty controls use responsive touch-friendly grids
- [x] Subjects/Systems/Topics adapt to narrow screens
- [x] Custom Retrieve controls stack on mobile
- [x] Test Mode / Questions / Available / Create stack on narrow screens
- [x] Topic Search uses viewport-safe mobile panel
- [x] existing Create Test product semantics preserved in source

### Verification still open
- [ ] final latest-head GitHub Actions `Verify`
- [ ] browser desktop acceptance
- [ ] browser tablet/iPad acceptance
- [ ] browser mobile acceptance
- [ ] deployed runtime confirms global MedPark header is absent inside selected QBank workspace
- [ ] bare legacy URL `/qbank/<valid-id>/create-test` without `?step=` self-recovers to the correct Step instead of false `Bank not found`
- [ ] Welcome/Create Test/Previous Tests navigation keeps the correct Step in runtime
- [ ] drawer open/close/overlay/Escape/navigation behavior verified
- [ ] no unintended QBank/Create Test horizontal overflow
- [ ] existing Create Test runtime checks: Mixed, 50/51 Standard, Custom validation, stable systems/topics
- [ ] authenticated single/mixed/custom create smoke against live backend

## 6. G1 sequence from here

Current order is now:

1. **Finish Issue #11 verification** — shell + Step-safe navigation + Create Test desktop/tablet/mobile.
2. Reconcile remaining Create Test live/API evidence under parent #3.
3. Return to **Library discussion/spec**. Do not assume Library mobile design; discuss it separately as requested.
4. Complete approved Library fidelity slice.
5. Run existing-shell regression across Auth, Hub, Dashboard, QBank listing/workspace, Previous Tests, Create Test and Library as applicable.
6. Final G1 `Verify` and close #3 only when its acceptance gates are evidenced.
7. Then begin G2 / Issue #4 **Exam Runner + Results/Review design discussion before code**.

## 7. Exact next step

**Do not start Library and do not start Exam Runner yet.**

First verify the latest Issue #11 source/docs commit in GitHub Actions. Once green, use the deployed Cloudflare runtime to verify at roughly:
- desktop ≥1280px;
- iPad/tablet ~768–1024px;
- mobile ~360–430px.

Manual/runtime checklist:
1. reopen the bank that produced the screenshot and confirm Create Test opens;
2. manually remove `?step=` from a valid bank Create Test URL and reload — it should repair to the bank's real `?step=N` rather than show false `Bank not found`;
3. navigate Welcome → Create Test and Previous Tests → Create Test and confirm Step remains correct;
4. confirm the global MedPark header is gone inside selected-bank workspace;
5. desktop: fixed sidebar works;
6. tablet/mobile: menu opens drawer, overlay/Close/Escape dismiss it, selecting a QBank section closes it;
7. Create Test: Standard/Custom toggle fits;
8. mode/difficulty/subjects/systems/topics have no unintended horizontal overflow;
9. mobile Topic Search stays inside viewport;
10. bottom Tutor/Timed + Questions + Available + Create layout is usable;
11. Custom Retrieve + textarea are usable on phone;
12. repeat existing correctness checks and safe live create flows.

Only after that can Issue #11 move to DONE and parent #3 continue.

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

Explicit documented deferrals (currently Library mobile/tablet) are allowed only when the user deliberately chooses them.

## 9. Continuation command for a new AI/developer

> Open `geminiamo0-ship-it/medfront`. Read `PROJECT_STATUS.md`, `AGENTS.md`, `docs/ENGINEERING_GUARDRAILS.md`, `docs/MASTER_PLAN.md`, `docs/PAGE_DELIVERY_WORKFLOW.md`, master Issue #1, parent Issue #3, active Issue #11, `docs/page-specs/QBANK_WORKSPACE.md`, and `docs/page-specs/CREATE_TEST.md`. Treat `geminiamo0-ship-it/medhvgg/main` as canonical backend and `medfront/backend` as reference-only. Use `https://medfront.geminiamo0.workers.dev` as runtime. Continue from the first unchecked Issue #11 verification task. The runtime Step-loss regression has source fixes: internal Create Test links preserve `?step=`, and bare selected-bank URLs recover the canonical bank Step via active-bank metadata and repair the URL. Responsive acceptance covers desktop + tablet/iPad + mobile for active pages. Do NOT redesign Library mobile/tablet until a separate user UX discussion. Do not start Exam Runner #4 before G1 is reconciled. Do not mark Done without evidence and green Verify.