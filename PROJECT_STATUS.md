# PROJECT_STATUS.md — MedPark frontend reconstruction

**Last updated:** 2026-10-06  
**Master epic:** #1  
**G1 parent:** #3 — Stabilize current frontend before new pages  
**Active issue:** #11 — QBank workspace shell + responsive Create Test  
**Active phase:** G1 — Existing frontend stabilization  
**Current status:** VERIFYING — QBank/Create Test source work is implemented; latest code Verify is green; runtime/browser acceptance remains

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
| Create Test | **VERIFYING** | Mixed fix, stable metadata, Standard/Custom max 50, live availability, responsive pass; Step-safe navigation fixed |
| Previous Tests | Implemented | Uses QBank workspace shell; empty-state Create Test link preserves Step |
| Library | Advanced; follow-up parked | Library mobile/tablet explicitly deferred until separate user discussion; Library work is not the immediate next priority |
| Test runner | Placeholder | **Next design discussion after #11 runtime checkpoint** — Issue #4 |
| Results/review | Not implemented | Part of #4 |
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

The previous roadmap expected Library work before Exam Runner. On 2026-10-06 the user explicitly reprioritized:

1. Finish the current QBank / Create Test checkpoint (#11).
2. Then move directly to **Exam Page / Exam Runner detailed DESIGN discussion** (#4).
3. Do not implement Exam Runner until the user-approved `EXAM_RUNNER` / results-review specs exist.
4. Library responsive work remains deliberately deferred and will be discussed separately later.

This means G1 is **not falsely marked complete** just because design discussion for #4 starts. Remaining Library/regression work stays recorded as parked debt while the user-approved priority shifts to Exam Runner design.

Issue #4 has been updated to reflect that it is the **next design discussion** after #11 acceptance, not an implementation authorization.

## 7. Exact next step

First finish Issue #11 runtime acceptance on Cloudflare.

Quick navigation check:
1. Open `/qbank?step=1`.
2. Enter any provider under Step 1.
3. Click Step 2 — Step 2 must open at its top-level provider/bank selection.
4. Click Step 1 again — Step 1 must also open at its top-level provider/bank selection, not the provider previously opened.
5. Clicking the currently active Step while inside a provider should likewise return to that Step root.

Also verify the existing #11 checklist: selected-bank shell, responsive drawer, missing-Step recovery, Create Test responsive/correctness flows.

**Once the user confirms this checkpoint, switch active work to Issue #4 in DESIGN and begin the detailed Exam Page discussion. Do not write Exam Runner product code before that discussion/spec approval.**

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

> Open `geminiamo0-ship-it/medfront`. Read `PROJECT_STATUS.md`, `AGENTS.md`, `docs/ENGINEERING_GUARDRAILS.md`, `docs/MASTER_PLAN.md`, `docs/PAGE_DELIVERY_WORKFLOW.md`, master Issue #1, parent Issue #3, active Issue #11, `docs/page-specs/QBANK_WORKSPACE.md`, `docs/page-specs/CREATE_TEST.md`, and next-design Issue #4. Treat `geminiamo0-ship-it/medhvgg/main` as canonical backend and `medfront/backend` as reference-only. Use `https://medfront.geminiamo0.workers.dev` as runtime. Continue from the first unchecked Issue #11 runtime verification task. Step tabs are Step-root navigation and must clear provider drill-down state. Library mobile/tablet is deferred. After #11 acceptance, begin Issue #4 **DESIGN discussion only**; do not implement Exam Runner before approved specs and do not mark any checkpoint Done without evidence and green Verify.