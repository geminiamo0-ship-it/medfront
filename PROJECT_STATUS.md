# PROJECT_STATUS.md — MedPark frontend reconstruction

**Last updated:** 2026-10-05  
**Master epic:** #1  
**Active issue:** #2 — G0 Governance + source-of-truth + Verify CI baseline  
**Active phase:** G0 — Governance / verification foundation

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
| Create Test | Implemented but **not stabilized** | Three P0 correctness issues tracked in #3 |
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
- The frontend currently has typecheck/lint/build scripts but G0 still needs a repository-level GitHub Actions `Verify` workflow.
- Some documentation added in commit `9c5d566` incorrectly treats `medfront/backend` as canonical and contains known API-method mismatches. G0 corrects this.

## 4. Active work — #2 G0

- [x] Master tracking epic created (#1)
- [x] Governance issue created (#2)
- [x] Stabilization issue created and blocked (#3)
- [x] Exam Runner design issue created and blocked (#4)
- [x] Later product/hardening/admin parking issues created (#5–#8)
- [x] Page-spec and backend-capability META issues created (#9–#10)
- [x] Root `AGENTS.md` added
- [x] Root `PROJECT_STATUS.md` added
- [ ] Add `docs/ENGINEERING_GUARDRAILS.md`
- [ ] Add `docs/MASTER_PLAN.md`
- [ ] Add `docs/PAGE_DELIVERY_WORKFLOW.md`
- [ ] Add `docs/page-specs/TEMPLATE.md`
- [ ] Add `docs/BACKEND_CAPABILITY_MAP.md`
- [ ] Correct canonical-backend wording in existing docs
- [ ] Correct known API-reference HTTP methods
- [ ] Add `.github/workflows/verify.yml`
- [ ] Run/observe `Verify` on the final G0 commit
- [ ] Update #2 checkboxes and verification record
- [ ] Mark G0 done only when CI is green

## 5. Exact next step

Continue **#2 only**: finish governance/reference docs, correct documentation mismatches, add `Verify`, then validate CI.

Do **not** start #3 or #4 yet.

After #2 is Done, activate #3 and first discuss any visible Create Test/Library UX changes before implementation.

## 6. Phase order

1. **G0** Governance, source ownership, docs, CI baseline — active
2. **G1** Stabilize existing frontend — blocked (#3)
3. **G2** Exam Runner + results/review — blocked/design first (#4)
4. **G3** Study tools — parked
5. **G4** Analytics/streaks/goals/badges/AI Analyst — parked
6. **G5** Account/settings/privacy/subscription/payments — parked
7. **G6** Contests/community/messages/support — parked
8. **G7** Public/ancillary surfaces — parked
9. **G8** Admin/support operations — parked (#7)
10. **G9** Hardening — parked (#6)
11. **G10** Release readiness — parked (#6)

## 7. Definition of Done

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

## 8. Proven vs not yet proven

### Proven/observed
- Current frontend source tree and routes on `medfront/main` have been inspected.
- Canonical backend `medhvgg/main` has been inventoried across its modules and key user-facing controllers.
- Backend owns a mature test engine including creation, execution, batch timed submission, marks, highlights, explanations, AI explanations, lifecycle and results.
- Backend also exposes real APIs for Library, notes/notebook, flashcards, revision, subscriptions/access, contests, messages, tickets/support, admin/security/finance and other domains.

### Not yet proven in this reconstruction
- End-to-end Create Test success for single/mixed/custom modes after the documented P0 fixes.
- Current frontend Exam Runner/results, because they are not built.
- Full frontend regression under automated browser tests.
- G0 GitHub Actions `Verify`, until the workflow is added and passes.

## 9. Continuation command for a new AI/developer

> Open `geminiamo0-ship-it/medfront`. Read `PROJECT_STATUS.md`, `AGENTS.md`, `docs/ENGINEERING_GUARDRAILS.md`, `docs/MASTER_PLAN.md`, master Issue #1 and the active issue listed in PROJECT_STATUS. Treat `geminiamo0-ship-it/medhvgg/main` as the canonical backend and `medfront/backend` as reference-only. Continue from the first unchecked task in the active issue. For every page, discuss and approve its UX/style first, update its page-spec MD, then implement. Do not mark work Done until acceptance criteria, browser checks where applicable, and GitHub Actions `Verify` pass; then update the issue and PROJECT_STATUS.md.
