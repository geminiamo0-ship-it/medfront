# PROJECT_STATUS.md — MedPark frontend reconstruction

**Last updated:** 2026-10-05  
**Master epic:** #1  
**Active issue:** #3 — G1 Stabilize current frontend before new pages  
**Active phase:** G1 — Existing frontend stabilization  
**Current status:** DESIGN — no product code until the visible Create Test decisions below are approved/spec'd

## 1. Repository ownership

| Role | Repository / branch | Authority |
|---|---|---|
| Canonical frontend | `geminiamo0-ship-it/medfront` → `main` | Current frontend implementation |
| Canonical backend/API | `geminiamo0-ship-it/medhvgg` → `main` | API, business rules, security, persistence, analytics |
| Backend reference snapshot | `medfront` → `backend` | Read-only historical/reference material; never deploy or develop from it |

Live frontend API base currently points at `https://medhvgg-production.up.railway.app/api`.

## 2. Current frontend state

| Area | State | Notes |
|---|---|---|
| Auth | Implemented | Login/register/verify email/forgot/reset/complete profile |
| Hub | Implemented | Protected entry experience |
| Dashboard | Implemented | Current dashboard slice |
| QBank listing | Implemented | Step/provider/bank discovery |
| Bank workspace | Implemented | Welcome/Create Test/Previous Tests |
| Create Test | Implemented but **not stabilized** | Three G1 correctness issues tracked in #3 |
| Library | Advanced, needs fidelity verification | Reader/search/highlights/annotations/notebook/AI/Amboss-like modes/dark/high-yield |
| Test runner | Placeholder | Design-first issue #4; backend engine already exists |
| Results/review | Not implemented in current frontend | Part of #4 |
| Contests | Placeholder | Backend capability exists; future page issue |
| AI Analyst | Placeholder | Future design/spec |
| Settings | Placeholder | Backend user/privacy/subscription capabilities exist |
| Flashcards | Not exposed in current frontend | Mature backend capability exists |
| Revision | Not exposed in current frontend | Backend capability exists |
| Messages / tickets / support | Not exposed in current frontend | Backend capability exists |
| Admin/support workspaces | Not reconstructed | Large backend capability set; parked |

## 3. Current code-health observations

- `LibraryPage.tsx` is large (~41 KB) and `CreateTestPage.tsx` is large (~36 KB). Do not rewrite them wholesale; decompose coherent responsibilities incrementally when touched.
- Current API helpers still use broad types on some paths; tighten contracts as each feature becomes active.
- GitHub Actions `Verify` now exists and runs `npm ci → typecheck → lint → build` on pushes/PRs to `main`.
- High-level docs now consistently identify `medhvgg/main` as canonical backend and `medfront/backend` as reference-only.
- Known API-reference HTTP-method mismatches for test count/metadata endpoints have been corrected.

## 4. G0 governance foundation — completed pending final handoff CI gate

- [x] Master tracking epic created (#1)
- [x] Governance issue created (#2)
- [x] Stabilization issue created (#3)
- [x] Exam Runner design issue created and blocked (#4)
- [x] Later product/hardening/admin parking issues created (#5–#8)
- [x] Page-spec META issue completed/closed (#9)
- [x] Backend-capability META issue completed/closed (#10)
- [x] Root `AGENTS.md` added
- [x] Root `PROJECT_STATUS.md` added
- [x] `docs/ENGINEERING_GUARDRAILS.md` added
- [x] `docs/MASTER_PLAN.md` added
- [x] `docs/PAGE_DELIVERY_WORKFLOW.md` added
- [x] `docs/page-specs/TEMPLATE.md` added
- [x] `docs/BACKEND_CAPABILITY_MAP.md` added
- [x] `.github/ISSUE_TEMPLATE/page-feature.md` added
- [x] Canonical-backend wording corrected in README/Overview/Backend Overview/Git History
- [x] Known API-reference HTTP-method mismatches corrected
- [x] `.github/workflows/verify.yml` added
- [x] Governance verification run #8 passed on commit `e93a5dd61edffaa837013b9153ff5e6de7ad2843`
- [ ] This final status-handoff commit must pass `Verify`; only then close #2

## 5. G1 active work — #3

### Create Test — DESIGN first

Contract findings are already known, but visible behavior must be agreed before implementation.

- [ ] Re-open/inspect current Create Test page + exact canonical backend DTO/service contract at implementation start
- [ ] Record `mixed` → `mixed_modes` as **NO VISUAL CHANGE** contract fix
- [ ] Discuss/approve custom UW-ID validation UX with user
- [ ] Discuss/approve whether system/topic metadata stabilization is behavior-only or includes any visual refinement
- [ ] Create `docs/page-specs/CREATE_TEST.md` from the template
- [ ] Record user approval in spec + Issue #3
- [ ] Move #3 from DESIGN → SPEC APPROVED → IMPLEMENTING
- [ ] Fix mixed-mode payload
- [ ] Fix custom UW-ID validation without silent truncation
- [ ] Separate metadata-query filters from final creation/count filters
- [ ] Tighten touched API/request types where practical
- [ ] Verify single-mode creation against canonical live API
- [ ] Verify mixed-mode creation against canonical live API
- [ ] Verify valid custom UW-ID creation against canonical live API
- [ ] Verify invalid/non-numeric/>50 custom states
- [ ] Verify systems/topics UI remains stable while selections change
- [ ] Typecheck/lint/build + browser checks + GitHub Actions `Verify`
- [ ] Update page spec, Issue #3 and this status document

### Library fidelity — after Create Test stabilization

- [ ] Discuss/record intended High-yield interactive-link behavior before visible selector changes
- [ ] Create/update appropriate Library page spec
- [ ] Preserve `.api` / `.dictionary` / `.linksuggest` interactive spans as approved
- [ ] Browser-verify ordered/unordered/nested lists in light/dark + High-yield on/off
- [ ] Regression-check search/navigation/annotations/notebook/AI/popovers/images/split behavior
- [ ] Pass verification gates and update #3/status/docs

## 6. Exact next step

**Do not implement code yet. Start Issue #3 in DESIGN mode.**

First Create Test design discussion:

1. `mixed` → `mixed_modes`: proposed as a pure contract correction with **no visual change**.
2. Custom UW-ID validation: agree how invalid IDs and the 50-ID limit should look/behave before coding.
3. Systems/topics metadata fix: proposed to preserve the current visual design and only stop the matrix/search from collapsing, unless the user wants a visible refinement.

After those decisions are approved, write `docs/page-specs/CREATE_TEST.md`; only then implementation begins.

Do **not** start Exam Runner #4 until #3 is Done unless the user explicitly reprioritizes and the status file is updated.

## 7. Phase order

1. **G0** Governance/source ownership/docs/CI baseline — handoff complete; #2 closes after this commit's Verify passes
2. **G1** Stabilize existing frontend — active DESIGN (#3)
3. **G2** Exam Runner + results/review — blocked/design first (#4)
4. **G3** Study tools — parked
5. **G4** Analytics/streaks/goals/badges/AI Analyst — parked
6. **G5** Account/settings/privacy/subscription/payments — parked
7. **G6** Contests/community/messages/support — parked
8. **G7** Public/ancillary surfaces — parked
9. **G8** Admin/support operations — parked (#7)
10. **G9** Hardening — parked (#6)
11. **G10** Release readiness — parked (#6)

## 8. Definition of Done

A page/feature is `DONE` only when all applicable gates pass:

- [ ] user-approved UX/style/page spec exists
- [ ] acceptance criteria are satisfied
- [ ] implementation is issue-scoped and respects architecture boundaries
- [ ] automated tests/targeted checks pass
- [ ] browser/E2E verification passes where applicable
- [ ] typecheck passes
- [ ] lint passes
- [ ] production build passes
- [ ] GitHub Actions `Verify` passes
- [ ] active issue checkboxes are updated
- [ ] relevant docs are updated
- [ ] `PROJECT_STATUS.md` is updated with the exact continuation point

## 9. Proven vs not yet proven

### Proven/observed
- Current frontend source tree and routes on `medfront/main` have been inspected.
- Canonical backend `medhvgg/main` has been inventoried across its modules and key user-facing controllers.
- Backend owns a mature test engine including creation, execution, batch timed submission, marks, highlights, explanations, AI explanations, lifecycle and results.
- Backend also exposes real APIs for Library, notes/notebook, flashcards, revision, subscriptions/access, contests, messages, tickets/support, admin/security/finance and other domains.
- GitHub Actions `Verify` is installed; governance run #8 completed successfully with install/typecheck/lint/build green.

### Not yet proven in this reconstruction
- End-to-end Create Test success for single/mixed/custom modes after the G1 fixes.
- Current frontend Exam Runner/results, because they are not built.
- Full frontend regression under automated browser tests.
- Full page-by-page coverage for later product domains; those will be activated/spec'd just-in-time.

## 10. Continuation command for a new AI/developer

> Open `geminiamo0-ship-it/medfront`. Read `PROJECT_STATUS.md`, `AGENTS.md`, `docs/ENGINEERING_GUARDRAILS.md`, `docs/MASTER_PLAN.md`, master Issue #1 and the active issue listed in PROJECT_STATUS. Treat `geminiamo0-ship-it/medhvgg/main` as the canonical backend and `medfront/backend` as reference-only. Continue from the first unchecked task in the active issue. For every page, discuss and approve its UX/style first, update its page-spec MD, then implement. Do not mark work Done until acceptance criteria, browser checks where applicable, and GitHub Actions `Verify` pass; then update the issue and PROJECT_STATUS.md.
