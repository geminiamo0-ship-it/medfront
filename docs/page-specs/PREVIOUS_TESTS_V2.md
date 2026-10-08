# Previous Tests V2 — Page Spec

**Issue:** #55 (Epic #1 / G2 parent #4; companion Create Test #11)
**Workflow state:** SPEC APPROVED / PARKED — implementation not started
**Route(s):** `/qbank/:bankId/previous-tests?step=N`; integrated changes to `/qbank/:bankId/create-test?step=N` and existing AMBOSS Exam Runner lifecycle
**Approved:** 2026-10-09 (explicit user acceptance of simple standalone HTML prototype and palette-readiness)
**Design reference:** User-supplied simple AMBOSS-style results table screenshot, followed by the standalone MedPark Previous Tests desktop/mobile HTML mock shown in conversation.

## 1. Purpose and priorities

Help learners identify older blocks, open accurate reports for completed exams, resume paused exams, copy the server's internal Test ID and—via an explicitly reviewed, authorized backend flow—repeat the *same set of questions* in a new attempt. Keep page deliberately minimal and readable.

This spec records **approved intended UX**, not claims that all backend operations exist.

## 2. Scope / non-goals

In scope:
- Existing Create Test optional name (already present): if blank, generate a **stable, human-readable** title from selected Systems and Topics (deduplicated) rather than only bank + Custom/status.
- Multiple selected Systems/Topics: show an abbreviated test title; reveal full names in an accessible popover/menu, without allowing title length to disrupt a table row. If none are selected, fall back to a sensible bank/mode label; blank or malformed names must not be produced.
- Previous Tests Desktop: compact table with Score/Accuracy, Name, Date, Tutor/Timed, question pool/status filter, Questions count, lifecycle state and context-specific actions.
- Phone: **stacked cards** containing the same substantive data and actions; no page-level horizontal scrolling. Tablet can reflow as needed.
- Copy internal Test ID action with success feedback, keyboard support; clarify that it is distinct from question/external UWorld IDs.
- Completed → Results; Suspended or In Progress → Resume, controlled by canonical backend. Always display a text state, not only colored badges.
- End Block completion success → Results; AMBOSS Exit Session from an active block must first persist/suspend answers, time and progress and then navigate to Previous Tests. Failure → do not leave, show Retry.
- Future Custom workflow: paste an internal Test ID to request a new authorized attempt with exactly the same question set. **Do not** inject Test ID into the existing input for comma-separated external question IDs without a server-supported translation contract.

Out of scope:
- Redesigning the global Shell, adopting a future color palette now, ranking/percentiles/three-digit scores, all-banks new exam engines, destructive bulk actions, giant Create Test refactor.
- New data/business logic in the frontend. No backend changes before inspecting `medhvgg/main` and creating a backend-scoped issue if needed.
- Results V1 rework (already separate #51/#53 gates).

## 3. Current evidence and source-of-truth checks

- `src/pages/qbank/PreviousTestsPage.tsx`: basic table already displays score/title/date/mode/question count/status and links completed to `/test/:id/results`; it does not yet have Copy Test ID, pool details or polished mobile cards.
- `src/pages/qbank/CreateTestPage.tsx`: optional `testName` input already exists. Current fallback `bank name — custom/status`, **not** selected Systems/Topics. Only expand fallback when contract is clear; do not duplicate fields.
- Canonical backend `medhvgg/main`: Create Test DTO supports title; test ID, rename, suspend and resume endpoints exist; **repeat-from-test-ID API and filtered listing provenance need verification**.
- Original user-provided reference image and desktop/mobile prototype are UX references, never proof of implemented functionality.

## 4. Approved design and future palette

- Same simplicity as the provided interactive HTML prototype: clean table, lightweight row separators, low visual noise, legible typography and discreet compact actions.
- Color palette **not chosen yet**. Use existing semantic tokens/CSS variables for background, surface, text, muted, border, success, warning, danger and link/focus. Avoid hard-coded terracotta/red/other brand values. Changing the new palette should require token updates rather than reworking the page.
- No extra badges for ordinary labels; status text clearly legible in any theme. Small score treatment, restrained hover state, no excessive shadows/animations.

## 5. Desktop layout

Top: Previous Tests heading and appropriate empty/list states. Table columns in visual order:
1. Score/Accuracy (only when completed; show "—" otherwise).
2. Name (manual or generated; truncated with full-name disclosure).
3. Date (single clear date type and timezone; compare created vs completed as approved).
4. Mode (Tutor/Timed).
5. Question pool (Custom / Used / Unused / Marked / Correct / Incorrect / Mixed; reflect actual source).
6. # Questions.
7. Status (Completed / Suspended / In Progress).
8. Actions: Results or Resume, Copy Test ID. Consider Review Questions only for completed where existing route works.

Optional selected-system/topic details live in a small accessible popover on name, not additional dense columns. No fake or inferred metadata if the list endpoint lacks it.

## 6. Mobile / tablet

- Convert each row into one compact card: top score+state, test name, date/mode/pool/# Qs, bottom actions.
- ≥44px practical touch targets, visible focus, popover confined to viewport, Escape/close and no clipped menus.
- Tablet table/card breakpoint based on actual width; no horizontal document overflow, no hidden essential data.

## 7. Navigation and lifecycle

- Completed Results route: `/test/:id/results`. Review Questions: existing `/test/:id` completed review path.
- Suspended/In Progress: Resume via canonical backend guard then continue `/test/:id`; never mark suspended based on a frontend-only flag.
- AMBOSS active Exit Session: drain/persist answer+time+flags as contract allows → server suspend acknowledged → Previous Tests route (same bank/step). If suspend/flush fails, stay in Exam Runner with retry; do not discard unsaved state. For already-completed test, exit can navigate directly.
- End Block: server finalizes, then Results only on acknowledged completed state. Do not conflate End Block with suspend.
- Copy internal Test ID: clear accessible label, clipboard feedback and error handling. Future Custom repeat requires read-only validated source test ownership/entitlement and server-side question-set recreation into **new** test, independent analytics.
- Keep all dates in clear user-visible timezone presentation; never guess status transitions.

## 8. Components / domain boundaries

- `PreviousTestsPage` orchestrates filters/list/navigation; presentational table/card, name details popover and actions separated if clearly useful (incremental extraction only).
- `CreateTestPage` owns text input UX; backend retains authoritative validation, persistency, title generation policy and provenance if needed.
- API path centralized in existing `src/api/tests.ts`; TanStack Query for listing and invalidation.
- Session status/answer integrity/security handled by `medhvgg/main`, not duplicated in browser.

## 9. Backend/API contracts to resolve **before implementation**

| Feature | Current evidence | Pending server-side validation |
|---|---|---|
| Previous Tests list | Existing `getPreviousTests(step, bankId)` | Exact returned pool, selected Systems/Topics, times, score, status; pagination/access rules |
| Optional test name | Create Test accepts title | Canonical fallback and stable human-readable name; safe lengths and duplicate names |
| Rename | `PATCH /tests/:id/name` exists | Ownership/limits/UI requirement |
| Copy internal ID | Test IDs exist in list | Allowed display/copy semantics |
| Repeat by Test ID | **NOT established** | Authenticated source owner/entitlements, membership, copying exact IDs as new attempt, mixed/timed rules, no exposure across users |
| Suspend/resume | `PUT /tests/:id/suspend` and `PUT /tests/:id/resume` exist | Exit orchestration, progress durability, failure/retry, status after refresh |
| Results | `GET /tests/:id/results` exists | Access locks, Completed-only UI path |

No invention of endpoints/permissions. If source details aren't available, display neutral fallback, not fabricated pool names.

## 10. Page states and accessibility

Loading/skeleton; no tests with Create Test CTA; empty subset; incomplete metadata; network/retry; 401/403; subscription/locked; 429; out-of-date status; copy clipboard rejected. Semantic table headings and row scope on desktop; card labels on mobile; keyboard/hover/focus parity, color contrast, reduced-motion preferences and accessible popover state.

## 11. Performance and safety

Avoid per-row API requests/N+1 for topics and Systems; batch metadata on backend if needed. Paginate large histories, keep stale lists invalidated on create, suspend, resume, complete or rename; no silent expensive client joins. Avoid exposing other users' tests or answers. No browser-only status persistence.

## 12. Acceptance criteria / future verification

- [ ] Confirm backend authoritative contract and any gaps (especially repeat ID workflow).
- [ ] Create Test fallback uses selected Systems/Topics, with stable truncation and details; manual name wins.
- [ ] Desktop accurate table, responsive cards and neutral semantic-color tokens.
- [ ] Row status and actions match true backend state; navigation works and does not lose data.
- [ ] Copy Test ID works; repeat-by-ID supports only verified owned accessible tests and opens a separate attempt once backend capability is approved.
- [ ] End Block → Results, Exit → suspend-then-Previous Tests with error handling.
- [ ] Empty/error/locked/zero scores/long names/multiple topics tested.
- [ ] `npm ci`, Typecheck, Lint, Build, targeted unit and Chromium desktop/mobile PASS.
- [ ] GitHub Actions Verify on PR and on `main` PASS; signed-in Cloudflare/Railway API acceptance before marking DONE.
- [ ] Issue, spec and PROJECT_STATUS updated after each verified implementation slice.

## 13. Approval and status

**2026-10-09:** User approved **the same simplicity** as the presented prototype, and requested preparation for a **new future color palette**, not designing/changing that palette now. This authorizes the visual spec only, without asserting unfinished backend mechanics have been approved as implemented. Current primary #53 Results verification remains active; #55 is **SPEC APPROVED / PARKED** until the correct handoff.

**Implementation:** not started. UX mock is illustrative, not deployed.
