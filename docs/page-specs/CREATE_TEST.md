# Create Test — Page Spec

**Issue:** #3  
**Status:** VERIFYING  
**Route(s):** `/qbank/:bankId/create-test` (nested Create Test route in the bank workspace)  
**Last updated:** 2026-10-05  
**User approval:** Approved 2026-10-05

## 1. Purpose

Let a learner create a question block from one bank using status modes, difficulty, subjects, systems/topics, or an explicit Custom UWorld-ID list without hidden truncation or unstable filter metadata.

## 2. Scope

### In scope
- Correct multi-status creation to the canonical backend enum `mixed_modes`.
- Automatically treat 2+ selected status modes as Mixed and show a subtle `Mixed · N selected` indicator.
- Keep single selected status as its normal single mode.
- Custom ID input must never silently truncate.
- Show `N / 50` for the parsed unique valid IDs.
- Surface invalid/non-numeric/non-positive/non-integer entries before submission.
- Disable Create Test when Custom has no valid IDs, has invalid entries, or exceeds 50 valid unique IDs.
- Keep all user-entered Custom text intact when invalid or over the limit.
- Keep Systems/Topics metadata stable while system/topic selections change; selected systems/topics affect availability/creation, not the metadata universe used to render the matrix/search.
- Preserve the current visual language and layout except for the approved Mixed indicator and Custom validation feedback.

### Explicit non-goals
- No Create Test redesign.
- No Exam Runner work.
- No new test-mode semantics beyond the canonical backend contract.
- No wholesale refactor of `CreateTestPage.tsx`.
- Existing copy saying Custom questions are `unused` is not treated as proven by this slice: canonical `medhvgg/main` currently selects active matching custom IDs in the allowed bank but does not apply the normal UNUSED predicate. This discrepancy must not be claimed as verified until backend semantics are explicitly aligned.

## 3. Evidence reviewed

### Current frontend
- `src/pages/qbank/CreateTestPage.tsx`
- `src/api/tests.ts`
- Current route/workspace structure and existing Create Test documentation.

Observed defects before implementation:
- Multiple selected modes submitted `mode: "mixed"`.
- Custom parsing ended with `.slice(0, 50)`, silently dropping extra IDs and making the existing `> 50` visual branch unreachable.
- `getSystemsWithTopics` received the final `filters`, including selected `systemIds`/`topicIds`, which could shrink the matrix/search after selection.

### Canonical backend (`medhvgg/main`)
- `src/entities/test.entity.ts`
- `src/tests/dto/test.dto.ts`
- `src/tests/services/test-creation.service.ts`
- `src/tests/tests.controller.ts`

Canonical findings:
- `TestMode.MIXED = "mixed_modes"`.
- `CreateTestDto.mode` is enum validated.
- `filters.modes[]` carries the selected modes for `mixed_modes`.
- Custom IDs are resolved by external/UWorld ID within allowed active questions in the selected bank; invalid/missing IDs are rejected with structured backend errors.
- The current canonical Custom path does not apply the normal UNUSED predicate.

### Runtime target
- Cloudflare Workers frontend: `https://medfront.geminiamo0.workers.dev`
- API base: `https://medhvgg-production.up.railway.app/api`

### Historical/reference evidence
- Existing reconstruction docs and prior Create Test behavior only; canonical backend/current user decisions win.

## 4. User-approved visual direction

Preserve the existing Create Test design.

Approved additions:
- Selecting 2+ status checkboxes automatically means Mixed.
- A small, subtle status badge/label shows `Mixed · N selected`; there is no separate Mixed checkbox/button.
- Custom IDs show a compact counter and inline validation feedback.
- Invalid or over-limit state uses the existing error/bad token styling; valid state uses the existing link/accent styling.
- Do not clear, rewrite, or truncate user text to resolve an error.

## 5. Desktop layout

No structural redesign. Keep current section order and card layout.

- Question Mode card: Standard/Custom tabs; Standard mode list gets the subtle Mixed status indicator when 2+ modes are selected.
- Custom card: existing instructions/retrieve/textarea remain; counter and validation message live directly below the textarea.
- Difficulty, Subjects, Systems, Test Mode/count/create remain in their current positions.

## 6. Mobile/responsive layout

Preserve current wrapping/stacking behavior. New Mixed and validation labels must wrap rather than overflow.

## 7. Navigation and user flow

### Entry points
- Bank workspace → Create Test.

### Primary flow
1. Select Standard or Custom.
2. Standard: choose one or more status modes and optional filters.
3. Two or more status modes automatically form a Mixed selection.
4. Custom: enter/retrieve UWorld IDs and resolve validation before Create is enabled.
5. Choose Tutor/Timed and count when applicable.
6. Create Test.
7. On success navigate to `/test/:testId`.

### Exit/return paths
- Existing bank workspace navigation; unchanged.

## 8. Components and boundaries

- Keep the page architecture incremental.
- Add small pure helpers/types for Custom ID parsing and request typing where useful.
- Do not split the entire recovered page in this bug-fix slice.
- `SystemsSection` remains presentation/interaction; metadata query composition belongs at the page/API boundary.

## 9. Backend/API contract

| Action | Method | Endpoint | Request | Authority/notes |
|---|---|---|---|---|
| Per-mode counts | POST | `/tests/counts` | `{ step, filters }` | Backend authoritative |
| Mixed count | POST | `/tests/counts/mixed` | `{ step, filters: { ...filters, modes } }` | Backend deduplicates combined modes |
| Subjects | POST | `/tests/metadata/subjects` | `{ step, questionBankIds, mode }` | Metadata |
| Systems/topics | POST | `/tests/metadata/systems-with-topics` | `{ step, filters }` | Render from stable metadata filters |
| Difficulty | POST | `/tests/metadata/difficulty-counts` | `{ step, questionBankIds }` | Metadata |
| Create | POST | `/tests` | typed Create Test request | `mode: "mixed_modes"` for 2+ modes; `filters.modes` contains actual modes |
| Retrieve IDs | POST | `/tests/retrieve-questions` | `{ testId }` | Existing behavior |

Frontend validation improves UX. Backend remains authoritative for access, enum validation, availability, question existence, bank membership, creation quotas, grouping and persistence.

## 10. State ownership

### Server state
- counts, subjects, systems/topics, difficulty counts, create result, retrieved IDs.

### Local interaction state
- question tab, selected modes/difficulty/subjects/systems/topics, count, title, custom text, retrieve/create progress/errors.

### Persisted browser state
- None added by this slice.

## 11. Page states

- Loading: existing section loaders/placeholders.
- Custom empty: Create disabled.
- Custom invalid token(s): inline invalid-entry message; Create disabled.
- Custom >50 valid unique IDs: counter in error state + max message; Create disabled.
- Backend invalid/unavailable IDs: retain input and display backend error.
- Network/server/auth/access/rate-limit errors: existing API/client behavior plus page error; no destructive input clearing.

## 12. Interaction rules

- A mode selection can never become empty; preserve current behavior.
- Exactly one selected status → submit that canonical single mode.
- 2+ selected statuses → submit `mixed_modes` + `filters.modes`; show `Mixed · N selected`.
- Custom parser accepts comma-separated entries, trims whitespace, ignores empty separators, deduplicates valid IDs for the payload, and treats only positive integers as syntactically valid IDs.
- Never `.slice(0, 50)` user IDs.
- Systems/topics selected IDs remain part of availability/creation filters, but they are excluded from the systems/topics metadata query so the source matrix does not collapse as the user selects it.
- Subject and difficulty selections may still scope systems/topics metadata because they define the intended metadata universe.

## 13. Accessibility

- Preserve native checkbox/button/input semantics.
- Mixed state must be visible text, not color-only.
- Validation text must be readable and associated visually with the Custom textarea.
- Disabled Create remains a real disabled button.

## 14. Security/privacy/content safety

- Do not expose correct answers or hidden question content.
- Do not bypass backend access checks or quotas.
- Do not trust frontend validation as authorization.
- Retain backend canonical filtering and subscription enforcement.

## 15. Performance considerations

- Stable metadata filters prevent unnecessary refetch/churn from every system/topic selection.
- Counts still use the final filters so availability remains accurate.
- Memoize parsed custom input and filter objects.

## 16. Acceptance criteria

- [x] Single selected status request construction keeps its canonical mode unchanged.
- [x] 2+ selected statuses source implementation uses `mode: "mixed_modes"` plus `filters.modes` and renders the approved Mixed indicator in source.
- [x] Custom input is never silently truncated in source.
- [x] Valid unique-ID count renders `N / 50` in source.
- [x] Invalid/non-numeric/non-positive/non-integer entries are surfaced and block Create in source.
- [x] >50 valid unique IDs remain in the textarea and block Create in source.
- [x] Systems/topics metadata request excludes selected system/topic IDs.
- [x] Final availability/create requests still include selected systems/topics.
- [x] Existing visual layout is preserved apart from approved additions.
- [x] Current `unused only` Custom-copy/backend discrepancy is documented and not falsely marked verified.
- [ ] Runtime browser acceptance confirmed on Cloudflare deployment.
- [ ] Authenticated single/mixed/custom create flows confirmed against live backend.

## 17. Verification plan

### Automated
- [x] Typecheck
- [x] Lint
- [x] Build
- [x] GitHub Actions `Verify` run #14 green on implementation commit `3c2d0ae92e03e7b91a327b1d7136b61c067430ab`
- [x] Documentation/status handoff commit `631b3628095e84429160454d79225fe1d1309c94` passed `Verify` run #16

### Browser/manual evidence
- [ ] Single-mode visual/request behavior
- [ ] Mixed badge for 2+ modes
- [ ] Valid Custom IDs
- [ ] Invalid Custom token
- [ ] >50 Custom IDs without truncation
- [ ] Systems/topics stable while selecting systems/topics
- [ ] Real API happy path where credentials/test data safely permit

Runtime target: `https://medfront.geminiamo0.workers.dev`.

Current execution limitation: this tool environment failed to resolve/fetch the Workers domain and has no authenticated MedPark browser session. This is a tooling/runtime-access limitation, not absence of a deployment.

## 18. Approval record

2026-10-05 — User approved:
- automatic Mixed when 2+ status modes are selected;
- subtle `Mixed · N selected` visual trigger, no separate Mixed button;
- Custom `N / 50`, explicit invalid IDs, disabled Create on invalid/>50, never truncate or erase input;
- Systems/topics selections affect the test but must not collapse the matrix; preserve the current visual style.

## 19. Implementation/verification log

- 2026-10-05: Spec created after current frontend + canonical backend re-inspection. Newly documented discrepancy: existing Custom copy says `unused only`, while canonical Custom creation currently does not apply the UNUSED predicate.
- 2026-10-05: Approved Create Test source changes implemented.
- 2026-10-05: First typing pass widened shared API signatures and failed Typecheck; scope was corrected so tighter request/filter typing stays local to Create Test rather than creating unnecessary blast radius.
- 2026-10-05: Final implementation commit `3c2d0ae92e03e7b91a327b1d7136b61c067430ab` passed GitHub Actions `Verify` run #14: install/typecheck/lint/build all green.
- 2026-10-05: Status/docs handoff commit `631b3628095e84429160454d79225fe1d1309c94` passed `Verify` run #16.
- 2026-10-05: User supplied the actual runtime target `https://medfront.geminiamo0.workers.dev`; docs corrected to identify Cloudflare Workers rather than Vercel. Runtime browser/API checks remain open until an environment can reach the target with an authenticated MedPark session.