# PROJECT_STATUS.md — MedPark frontend reconstruction

**Last updated:** 2026-10-05  
**Master epic:** #1  
**Active issue:** #3 — G1 Stabilize current frontend before new pages  
**Active phase:** G1 — Existing frontend stabilization  
**Current status:** VERIFYING — Create Test implementation complete; runtime/browser/API verification remains before Library

## 1. Repository ownership

| Role | Repository / branch | Authority |
|---|---|---|
| Canonical frontend | `geminiamo0-ship-it/medfront` → `main` | Current frontend implementation |
| Canonical backend/API | `geminiamo0-ship-it/medhvgg` → `main` | API, business rules, security, persistence, analytics |
| Backend reference snapshot | `medfront` → `backend` | Read-only historical/reference material; never deploy or develop from it |

Current frontend API base points at `https://medhvgg-production.up.railway.app/api`.

Current frontend runtime/deployment target is Cloudflare Workers:
`https://medfront.geminiamo0.workers.dev`

## 2. Current frontend state

| Area | State | Notes |
|---|---|---|
| Auth | Implemented | Login/register/verify email/forgot/reset/complete profile |
| Hub | Implemented | Protected entry experience |
| Dashboard | Implemented | Current dashboard slice |
| QBank listing | Implemented | Step/provider/bank discovery |
| Bank workspace | Implemented | Welcome/Create Test/Previous Tests |
| Create Test | **VERIFYING** | Approved G1 fixes implemented; Standard and Custom are frontend-capped at 50; live availability shown beside Standard requested count; browser/authenticated live API checks remain |
| Library | Advanced, needs fidelity verification | Blocked until Create Test checkpoint completes |
| Test runner | Placeholder | Design-first Issue #4; backend engine already exists |
| Results/review | Not implemented in current frontend | Part of #4 |
| Contests | Placeholder | Backend capability exists; future page issue |
| AI Analyst | Placeholder | Future design/spec |
| Settings | Placeholder | Backend user/privacy/subscription capabilities exist |
| Flashcards | Not exposed in current frontend | Mature backend capability exists |
| Revision | Not exposed in current frontend | Backend capability exists |
| Messages/tickets/support | Not exposed in current frontend | Backend capability exists |
| Admin/support workspaces | Not reconstructed | Large backend capability set; parked |

## 3. Engineering foundation

G0 governance is complete:
- [x] `AGENTS.md`
- [x] `PROJECT_STATUS.md`
- [x] `docs/ENGINEERING_GUARDRAILS.md`
- [x] `docs/MASTER_PLAN.md`
- [x] `docs/PAGE_DELIVERY_WORKFLOW.md`
- [x] `docs/page-specs/TEMPLATE.md`
- [x] `docs/BACKEND_CAPABILITY_MAP.md`
- [x] design-first GitHub issue template
- [x] canonical-backend/reference wording corrected
- [x] API-reference HTTP-method mismatches corrected
- [x] GitHub Actions `Verify` installed: `npm ci → typecheck → lint → build`
- [x] G0 Issue #2 closed after green CI

Code-health rules remain:
- Large recovered files such as `LibraryPage.tsx` and `CreateTestPage.tsx` are not rewritten wholesale.
- Refactor coherent responsibilities incrementally when touched.
- Backend business/domain rules remain backend-owned.
- Do not widen shared types/interfaces unless the active slice requires it and callers are verified.

## 4. G1 — Create Test checkpoint

### Approved design/spec
- [x] `docs/page-specs/CREATE_TEST.md` created and user-approved
- [x] 2+ selected status modes automatically mean Mixed
- [x] subtle `Mixed · N selected` indicator; no separate Mixed button
- [x] Standard Questions show live filtered `Available: N`
- [x] Standard **50-question limit is intentionally frontend-only**; backend keeps a higher ceiling for headroom
- [x] Standard invalid counts outside `1..50` block Create rather than silently being clamped
- [x] Custom IDs show `N / 50`, invalid tokens, and block Create when invalid/>50/empty
- [x] Custom raw input is never silently truncated or erased
- [x] Custom **50-ID limit is intentionally frontend-only**; canonical backend supports a higher ceiling, so a future increase remains a frontend product change unless the backend contract changes
- [x] Systems/topics selections affect the test but do not collapse the metadata matrix/search
- [x] current visual layout preserved

### Implemented
- [x] multi-mode create uses canonical `mixed_modes`
- [x] `filters.modes` carries actual selected modes
- [x] `MAX_TEST_QUESTIONS = 50` is the single Standard frontend product-limit constant
- [x] Standard Create is disabled for non-integer, <1, or >50 requested counts
- [x] Standard Create no longer silently clamps a larger entered value to another test size
- [x] Standard Questions row reuses existing live filtered availability state and adds no extra API request
- [x] Custom `.slice(0, 50)` removed
- [x] Custom parser validates positive whole-number IDs, deduplicates payload IDs, preserves raw text
- [x] `MAX_CUSTOM_IDS = 50` is retained as the single Custom frontend product-limit constant and explicitly documented as frontend-only
- [x] Create disabled for empty/invalid/>50 Custom state
- [x] systems/topics metadata query excludes selected `systemIds/topicIds`
- [x] final availability/create filters still include selected systems/topics
- [x] feature typing kept local after a broader shared-API typing attempt caused unnecessary TypeScript blast radius

### Canonical backend limit finding
- [x] `CreateTestDto.totalQuestions` allows up to 200
- [x] `customQuestionIds` has no 50-item DTO cap
- [x] the service's `previewCount = 50` only caps human-readable invalid-ID error previews; it is not an exam-size limit
- [x] service telemetry/abuse alerting above 100 requested questions does not itself reject creation
- [x] user manually observed Standard creation working at 100 questions before the frontend cap was introduced, consistent with the canonical DTO
- [x] user explicitly chose frontend product limits of 50 for both Standard and Custom while leaving backend capability unchanged

### Automated verification
- [x] Original Typecheck
- [x] Original Lint
- [x] Original Production build
- [x] GitHub Actions `Verify` run #14 succeeded on implementation commit `3c2d0ae92e03e7b91a327b1d7136b61c067430ab`
- [x] Documentation/status handoff commit `631b3628095e84429160454d79225fe1d1309c94` passed `Verify` run #16
- [x] Availability-label/Custom-limit clarification state through commit `552bacb1b984fe51754690812711ed74888ac903` passed `Verify` run #25
- [ ] Latest Standard-50 code/docs state must pass final `Verify`

### Runtime verification still open
- [ ] Browser: Mixed badge for 2+ modes
- [ ] Browser: Standard Questions row shows the correct live `Available: N`
- [ ] Browser: Standard 50 allowed; Standard 51 remains visible/invalid and blocks Create
- [ ] Browser: valid/invalid/>50 Custom states; 51 IDs stay visible and block Create
- [ ] Browser: systems/topics matrix/search remains stable during selections
- [ ] Authenticated live API: single-mode creation with ≤50 questions
- [ ] Authenticated live API: mixed-mode creation with ≤50 questions
- [ ] Authenticated live API: valid Custom creation with ≤50 IDs

Runtime target exists at `https://medfront.geminiamo0.workers.dev` on Cloudflare Workers. In the current tool environment, direct DNS/fetch attempts to this Workers domain failed, and there is no authenticated MedPark browser session available. This is a tooling/runtime-access limitation only; the deployment itself is known and recorded. Runtime checks therefore remain explicitly open rather than being claimed as passed.

### Canonical-contract discrepancy recorded
The current Custom UI copy says `unused only`, but canonical `medhvgg/main` Custom creation currently does not apply the normal UNUSED predicate. This was discovered during implementation re-inspection and is documented in the page spec/Issue #3. It is not silently treated as verified behavior.

## 5. G1 remaining work after Create Test runtime verification

### Library fidelity — next discussion checkpoint, not yet active
- [ ] Discuss/record High-yield interactive-link behavior before visible changes
- [ ] Create/update Library page spec
- [ ] Preserve `.api` / `.dictionary` / `.linksuggest` interactive spans
- [ ] Browser-verify ordered/unordered/nested lists in light/dark + High-yield on/off
- [ ] Regression-check search/navigation/annotations/notebook/AI/popovers/images/split behavior
- [ ] Pass verification gates and update Issue #3/status/docs

### Existing-shell regression — after Library
- [ ] Auth
- [ ] Hub
- [ ] Dashboard
- [ ] QBank listing
- [ ] Bank workspace
- [ ] Previous Tests
- [ ] Library
- [ ] final G1 `Verify`

## 6. Exact next step

**Finish Create Test runtime verification against the Cloudflare deployment. Do not start Library yet.**

The next legitimate transition is:

`VERIFYING → Create Test DONE` only after browser behavior, authenticated live creation paths, and the latest CI are evidenced.

Use this runtime target:
`https://medfront.geminiamo0.workers.dev`

Verify in this order:
1. open Create Test in an authenticated browser session;
2. confirm 2+ status selection renders `Mixed · N selected`;
3. confirm the Standard Questions row shows the filtered `Available: N` and that it changes with status/filter selections;
4. confirm Standard count 50 is accepted and 51 stays visible/invalid with Create disabled;
5. confirm valid, invalid, and >50 Custom states without input truncation; specifically, 51 valid unique IDs must remain visible and block Create;
6. confirm selecting systems/topics does not shrink the matrix/search;
7. create one safe single-mode block with ≤50 questions;
8. create one safe mixed-mode block with ≤50 questions;
9. create one safe valid-Custom block with ≤50 IDs;
10. record evidence in `docs/page-specs/CREATE_TEST.md` and Issue #3;
11. then report Create Test DONE and begin the Library **discussion/spec** checkpoint before coding it.

Do not start Exam Runner #4 until Issue #3/G1 is Done unless the user explicitly reprioritizes and this status file records it.

## 7. Phase order

1. **G0** Governance/source ownership/docs/CI baseline — DONE
2. **G1** Stabilize existing frontend — ACTIVE / VERIFYING Create Test (#3)
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
- [ ] acceptance criteria satisfied
- [ ] implementation respects architecture boundaries
- [ ] automated/targeted checks pass
- [ ] browser/E2E verification passes where applicable
- [ ] real API behavior is verified where applicable
- [ ] typecheck/lint/production build pass
- [ ] GitHub Actions `Verify` passes
- [ ] active issue and relevant docs are updated
- [ ] `PROJECT_STATUS.md` records the exact continuation point

## 9. Proven vs not yet proven

### Proven/observed
- Current frontend source tree/routes inspected.
- Canonical `medhvgg/main` backend capability map and relevant Create Test DTO/entity/controller/service paths inspected.
- Backend canonical mixed enum is `mixed_modes`.
- Canonical backend DTO allows `totalQuestions` up to 200, but current frontend product limits Standard and Custom to 50.
- User manually observed Standard test creation working with 100 questions before the product cap, confirming the backend headroom.
- Create Test source implementation follows the approved mixed/custom/metadata behavior, shows filtered availability beside the Standard question-count input, and blocks Standard counts above 50.
- Original implementation commit `3c2d0ae92e03e7b91a327b1d7136b61c067430ab` passed GitHub Actions `Verify` run #14.
- Frontend runtime target is Cloudflare Workers at `https://medfront.geminiamo0.workers.dev`.

### Not yet proven
- Browser-level acceptance of the latest Standard-50 and availability behavior on the Cloudflare deployment.
- Authenticated end-to-end single/mixed/custom creation after the full G1 Create Test changes.
- Library G1 fidelity corrections.
- Full existing-shell regression.
- Current frontend Exam Runner/results, because they are not built.

## 10. Continuation command for a new AI/developer

> Open `geminiamo0-ship-it/medfront`. Read `PROJECT_STATUS.md`, `AGENTS.md`, `docs/ENGINEERING_GUARDRAILS.md`, `docs/MASTER_PLAN.md`, `docs/PAGE_DELIVERY_WORKFLOW.md`, master Issue #1 and active Issue #3. Treat `geminiamo0-ship-it/medhvgg/main` as canonical backend and `medfront/backend` as reference-only. Use `https://medfront.geminiamo0.workers.dev` as the current frontend runtime target. Both Standard and Custom Create Test flows are intentionally capped at 50 by the frontend even though the backend allows a higher ceiling. Continue from the exact next unchecked runtime-verification task. Do not start Library until Create Test is actually verified or the user explicitly reprioritizes. Do not mark anything Done without evidence and green `Verify`.