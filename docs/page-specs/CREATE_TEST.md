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
- Automatically treat 2+ selected status modes as Mixed and show `Mixed · N selected`.
- Keep a single selected status as its normal single mode.
- Never silently truncate Custom ID input.
- Show `N / 50` for parsed unique valid IDs.
- Surface invalid/non-numeric/non-positive/non-integer entries before submission.
- Disable Create when Custom input is empty, invalid, or above 50 valid unique IDs.
- Preserve all user-entered Custom text while invalid/over-limit.
- Keep Systems/Topics metadata stable while system/topic selections change; selected systems/topics still affect availability and final creation.
- Preserve the current visual language and layout except for the approved Mixed indicator and Custom validation feedback.

### Explicit non-goals
- No Create Test redesign.
- No Exam Runner work.
- No wholesale rewrite of `CreateTestPage.tsx`.
- No backend semantic change to Custom question eligibility in this slice.
- Existing UI copy says Custom uses `unused` questions, but canonical `medhvgg/main` Custom creation currently does not apply the normal UNUSED predicate. That mismatch is documented and must not be represented as verified behavior.

## 3. Evidence reviewed

### Current frontend
- `src/pages/qbank/CreateTestPage.tsx`
- `src/api/tests.ts`
- Current bank workspace routing/documentation.

Original defects confirmed before implementation:
- Multiple selected modes submitted `mode: "mixed"`.
- Custom parsing ended with `.slice(0, 50)`, silently dropping extra IDs.
- Systems metadata query used final filters including selected `systemIds`/`topicIds`, causing the matrix/search universe to shrink after selection.

### Canonical backend (`medhvgg/main`)
Reviewed:
- `src/entities/test.entity.ts`
- `src/tests/dto/test.dto.ts`
- `src/tests/services/test-creation.service.ts`
- `src/tests/tests.controller.ts`

Canonical findings:
- `TestMode.MIXED = "mixed_modes"`.
- `CreateTestDto.mode` is enum validated.
- `filters.modes[]` carries the selected modes for `mixed_modes`.
- Custom IDs are resolved as UWorld/external IDs inside allowed active bank questions; missing/invalid IDs are rejected by the backend.
- Current canonical Custom creation does not apply the normal UNUSED predicate.

## 4. User-approved visual direction

Preserve the existing Create Test page design.

Approved additions:
- 2+ status checkboxes automatically mean Mixed.
- Show a subtle `Mixed · N selected` badge; no separate Mixed checkbox/button.
- Custom IDs show a compact counter and inline validation.
- Invalid/over-limit states use existing error styling.
- Never clear, rewrite, or truncate input to resolve an error.

## 5. Desktop and responsive layout

No structural redesign. Existing section order/cards remain. New Mixed/validation labels wrap on smaller widths and do not introduce a new page layout.

## 6. Primary flow

1. Choose Standard or Custom.
2. Standard: choose one or more status modes and optional filters.
3. 2+ modes automatically become Mixed.
4. Custom: enter/retrieve UWorld IDs; fix validation before Create becomes enabled.
5. Choose Tutor/Timed and count where applicable.
6. Create.
7. Successful API response navigates to `/test/:testId`.

## 7. Backend/API contract

| Action | Method | Endpoint | Notes |
|---|---|---|---|
| Per-mode counts | POST | `/tests/counts` | Final selected filters |
| Mixed count | POST | `/tests/counts/mixed` | `filters.modes` contains selected modes |
| Subjects | POST | `/tests/metadata/subjects` | Metadata |
| Systems/topics | POST | `/tests/metadata/systems-with-topics` | Uses stable metadata filters without selected system/topic IDs |
| Difficulty | POST | `/tests/metadata/difficulty-counts` | Metadata |
| Create | POST | `/tests` | `mode: "mixed_modes"` for 2+ modes |
| Retrieve IDs | POST | `/tests/retrieve-questions` | Existing behavior |

Frontend validation is UX only. Backend remains authoritative for authorization, access, quotas, availability, question existence/bank membership, grouping, persistence and test semantics.

## 8. State and implementation boundaries

- Final `filters`: bank + optional subject/system/topic/difficulty selections.
- `metadataFilters`: bank + optional subjects/difficulty only; intentionally excludes system/topic selections.
- Custom parsing remains local/pure within the feature to avoid widening shared API typing during this stabilization slice.
- Shared `src/api/tests.ts` public signatures were restored after an initial broad typing attempt caused a TypeScript blast radius; the final working implementation keeps tighter feature typing local.
- No persisted browser state added.

## 9. Interaction and validation rules

- At least one status mode always remains selected.
- One selected status → that canonical single mode.
- 2+ selected statuses → `mixed_modes` + `filters.modes`.
- Custom parser accepts comma-separated values, trims whitespace, ignores empty separators, deduplicates valid IDs, and accepts only positive whole-number IDs within PostgreSQL integer range.
- No `.slice(0, 50)` or equivalent silent truncation.
- >50 unique valid IDs are retained in the textarea, shown as over-limit, and block Create.
- Invalid tokens are shown inline and block Create.
- Systems/topics metadata query does not depend on `systemIds`/`topicIds`; availability and create requests still do.

## 10. Accessibility/security/performance

- Native controls/disabled state retained.
- Mixed state is text, not color-only.
- Custom textarea exposes `aria-invalid` and validation description.
- Frontend validation never replaces backend authorization/validation.
- No answer/content-security logic moved client-side.
- Stable metadata filters avoid unnecessary systems/topic metadata churn on each system/topic selection.

## 11. Acceptance criteria

### Implemented in source and covered by successful compile/lint/build
- [x] Single status request construction keeps its canonical single mode.
- [x] 2+ statuses render `Mixed · N selected` and construct `mode: "mixed_modes"` with `filters.modes`.
- [x] Custom input is never silently truncated.
- [x] Valid unique-ID count renders `N / 50`.
- [x] Invalid/non-numeric/non-positive/non-integer entries are surfaced and block Create.
- [x] >50 unique valid IDs remain represented by the untouched textarea input and block Create.
- [x] Systems/topics metadata filters exclude selected system/topic IDs.
- [x] Final availability/create filters retain selected system/topic IDs.
- [x] Existing page layout is preserved apart from approved additions.
- [x] `unused only` UI-copy/backend discrepancy is documented and not falsely marked verified.

### Runtime acceptance still required before DONE
- [ ] Browser-confirm the Mixed badge and Custom validation states.
- [ ] Browser-confirm systems/topics matrix/search remains stable during selection.
- [ ] Run authenticated real-API create happy paths for single, mixed and valid Custom modes.

## 12. Verification

### Automated / CI
- [x] Typecheck — passed on final implementation commit `3c2d0ae92e03e7b91a327b1d7136b61c067430ab`.
- [x] Lint — passed on the same commit.
- [x] Production build — passed on the same commit.
- [x] GitHub Actions `Verify` run #14 — `success`.

### Browser/manual
- [ ] Single-mode visual/request behavior.
- [ ] Mixed badge for 2+ modes.
- [ ] Valid Custom IDs.
- [ ] Invalid Custom token.
- [ ] >50 Custom IDs without truncation.
- [ ] Systems/topics stable while selecting systems/topics.

### Real API
- [ ] Authenticated single-mode creation.
- [ ] Authenticated mixed-mode creation.
- [ ] Authenticated valid Custom creation.

Runtime verification is currently not marked complete because no deployed MedFront project was found in the connected Vercel account and no authenticated frontend/browser session is available in this execution context. This is a verification limitation, not a claim of success.

## 13. Approval record

2026-10-05 — User approved:
- automatic Mixed for 2+ selected modes;
- `Mixed · N selected`, no separate Mixed control;
- Custom `N / 50`, explicit invalid IDs, disabled Create for invalid/>50, and never truncating/erasing input;
- Systems/topics selection affects the test but must not collapse the matrix; current visual style preserved.

## 14. Implementation/verification log

- 2026-10-05: Spec created after frontend + canonical backend re-inspection.
- 2026-10-05: Issue #3 advanced DESIGN → SPEC APPROVED → IMPLEMENTING.
- 2026-10-05: Implemented `mixed_modes`, Mixed badge, non-truncating Custom validation, and stable metadata filters.
- 2026-10-05: Initial attempt to tighten shared API signatures failed Typecheck due to unnecessary cross-feature blast radius; shared API surface was restored and feature typing kept local.
- 2026-10-05: Final implementation commit `3c2d0ae92e03e7b91a327b1d7136b61c067430ab` passed GitHub Actions `Verify` run #14.
- 2026-10-05: Moved to VERIFYING. Browser/authenticated live-API verification remains before Create Test can be called DONE.