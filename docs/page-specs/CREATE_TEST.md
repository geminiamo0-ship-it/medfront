# Create Test — Page Spec

**Issue:** #3 / active responsive shell #11  
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
- Enforce an intentional **frontend product limit of 50 questions for Standard tests** through `MAX_TEST_QUESTIONS`.
- Show the current filtered **Available** question count directly beside the Standard `Questions` input.
- Block Standard Create when the requested count is outside `1..50` rather than silently clamping to a different test size.
- Custom ID input must never silently truncate.
- Enforce an intentional **frontend product limit of 50 Custom UWorld IDs** through `MAX_CUSTOM_IDS`.
- Show `N / 50` for the parsed unique valid Custom IDs.
- Surface invalid/non-numeric/non-positive/non-integer entries before submission.
- Disable Create Test when Custom has no valid IDs, has invalid entries, or exceeds the frontend 50-ID product limit.
- Keep all user-entered Custom text intact when invalid or over the limit.
- Keep Systems/Topics metadata stable while system/topic selections change; selected systems/topics affect availability/creation, not the metadata universe used to render the matrix/search.
- Preserve the current visual language while making the page usable on desktop, tablet/iPad and mobile.
- Preserve QBank `step` context when entering Create Test; legacy/bare selected-bank URLs are repaired by the workspace shell.

### Explicit non-goals
- No Exam Runner work.
- No new test-mode semantics beyond the canonical backend contract.
- No wholesale refactor of `CreateTestPage.tsx`.
- Do not change the backend maximum merely to mirror the stricter frontend 50-question product limits.
- Existing copy saying Custom questions are `unused` is not treated as proven by this slice: canonical `medhvgg/main` currently selects active matching custom IDs in the allowed bank but does not apply the normal UNUSED predicate. This discrepancy must not be claimed as verified until backend semantics are explicitly aligned.
- Library mobile/tablet remains deferred to a separate detailed UX discussion.

## 3. Evidence reviewed

### Current frontend
- `src/pages/qbank/CreateTestPage.tsx`
- `src/pages/qbank/QbankWorkspace.tsx`
- `src/pages/qbank/WelcomePage.tsx`
- `src/pages/qbank/PreviousTestsPage.tsx`
- `src/api/tests.ts`
- Current route/workspace structure and existing Create Test documentation.

Observed defects before implementation:
- Multiple selected modes submitted `mode: "mixed"`.
- Custom parsing ended with `.slice(0, 50)`, silently dropping extra IDs and making the existing `> 50` visual branch unreachable.
- `getSystemsWithTopics` received the final `filters`, including selected `systemIds`/`topicIds`, which could shrink the matrix/search after selection.
- Standard count UI previously exposed the backend-compatible 200 ceiling instead of the product-selected 50-question ceiling.
- Runtime later showed `/qbank/39/create-test` without `?step=` falsely resolving as Step 1 and showing `Bank not found`; some internal Create Test links were dropping Step context.

### Canonical backend (`medhvgg/main`)
- `src/entities/test.entity.ts`
- `src/tests/dto/test.dto.ts`
- `src/tests/services/test-creation.service.ts`
- `src/tests/tests.controller.ts`

Canonical findings:
- `TestMode.MIXED = "mixed_modes"`.
- `CreateTestDto.mode` is enum validated.
- `filters.modes[]` carries the selected modes for `mixed_modes`.
- `CreateTestDto.totalQuestions` allows up to 200.
- `customQuestionIds` is not capped at 50 by the DTO.
- Therefore the Standard 50-question ceiling and Custom 50-ID ceiling are intentional frontend product rules, not backend contract limits.
- The service emits an abuse/security alert when requested `totalQuestions` is over 100 but does not reject solely for being over 100; the DTO maximum remains authoritative at the backend layer.
- Custom IDs are resolved by external/UWorld ID within allowed active questions in the selected bank; invalid/missing IDs are rejected with structured backend errors.
- The current canonical Custom path does not apply the normal UNUSED predicate.
- The service's internal `previewCount = 50` only limits how many invalid IDs are included in human-readable error text; it is not a creation-size limit.

### Runtime target
- Cloudflare Workers frontend: `https://medfront.geminiamo0.workers.dev`
- API base: `https://medhvgg-production.up.railway.app/api`

## 4. User-approved visual direction

Preserve the existing Create Test visual language, but make it premium-responsive.

Approved behavior/additions:
- Selecting 2+ status checkboxes automatically means Mixed.
- A small, subtle status badge/label shows `Mixed · N selected`; there is no separate Mixed checkbox/button.
- Standard `Questions` is capped at 50 in the frontend; invalid `0`, negative, non-integer, or `>50` values prevent Create instead of being silently rewritten into another test size.
- Beside the Standard `Questions` number input, show `Available: N` using the same live filtered availability already used by the page.
- Custom IDs show a compact counter and inline validation feedback.
- Custom remains intentionally capped at 50 in the frontend even though the backend supports a higher ceiling.
- Invalid or over-limit state uses the existing error/bad token styling; valid state uses the existing link/accent styling.
- Do not clear, rewrite, or truncate user Custom text to resolve an error.
- Mobile/tablet: Standard/Custom tabs, modes, difficulty, filters, topic search, Custom retrieve, and bottom create controls must fit without horizontal overflow.

## 5. Desktop layout

Keep current section order and card layout.

- Question Mode card: Standard/Custom tabs; Standard mode list gets the subtle Mixed status indicator when 2+ modes are selected.
- Custom card: existing instructions/retrieve/textarea remain; counter and validation message live directly below the textarea.
- Difficulty, Subjects, Systems, Test Mode/count/create remain in their current positions.
- Standard Test Mode/count/create row shows `Questions [input] Available: N` together.

## 6. Mobile/responsive layout

- Page/container uses `min-w-0` and compact phone padding.
- Standard/Custom tabs become full-width on narrow screens.
- Mode and Difficulty controls use responsive touch-friendly grids.
- Subjects and Systems become one column on narrow screens, two columns when space allows.
- Custom Retrieve input/button stack vertically on mobile.
- Topic Search panel is fixed/viewport-safe on phone widths instead of overflowing off-screen.
- Tutor/Timed and Questions/Available/Create stack into a usable vertical layout when required.
- Create button may become full-width on phones.
- No unintended horizontal overflow.

## 7. Navigation and user flow

### Entry points
- Bank workspace → Create Test.
- Welcome locked-results CTA → absolute `/qbank/:bankId/create-test?step=N`.
- Previous Tests empty-state CTA → absolute `/qbank/:bankId/create-test?step=N`.
- QBank sidebar → Step-preserving Create Test link.
- Legacy/bookmarked bare selected-bank Create Test URLs are repaired by `QbankWorkspace` using the bank's canonical Step from active QBank metadata.

### Primary flow
1. Select Standard or Custom.
2. Standard: choose one or more status modes and optional filters.
3. Two or more status modes automatically form a Mixed selection.
4. Standard: review the live `Available` count beside the requested Questions input and enter `1..50` questions.
5. Custom: enter/retrieve UWorld IDs and resolve validation before Create is enabled; the frontend product limit is 50.
6. Choose Tutor/Timed when applicable.
7. Create Test.
8. On success navigate to `/test/:testId`.

## 8. Components and boundaries

- Keep the page architecture incremental.
- Keep `MAX_TEST_QUESTIONS` as the single frontend Standard test-size product constant.
- Keep `MAX_CUSTOM_IDS` as the single frontend Custom product-limit constant.
- Do not split the entire recovered page in this slice.
- `SystemsSection` remains presentation/interaction; metadata query composition belongs at the page/API boundary.
- Step recovery belongs to the QBank workspace shell, not Create Test business logic.

## 9. Backend/API contract

| Action | Method | Endpoint | Request | Authority/notes |
|---|---|---|---|---|
| Per-mode counts | POST | `/tests/counts` | `{ step, filters }` | Backend authoritative |
| Mixed count | POST | `/tests/counts/mixed` | `{ step, filters: { ...filters, modes } }` | Backend deduplicates combined modes |
| Subjects | POST | `/tests/metadata/subjects` | `{ step, questionBankIds, mode }` | Metadata |
| Systems/topics | POST | `/tests/metadata/systems-with-topics` | `{ step, filters }` | Render from stable metadata filters |
| Difficulty | POST | `/tests/metadata/difficulty-counts` | `{ step, questionBankIds }` | Metadata |
| Create | POST | `/tests` | typed Create Test request | `mode: "mixed_modes"` for 2+ modes; `filters.modes` contains actual modes; backend DTO `totalQuestions` max = 200 |
| Retrieve IDs | POST | `/tests/retrieve-questions` | `{ testId }` | Existing behavior |
| QBank catalogue | GET | `/tests/metadata/question-banks` | optional `step` | Missing-Step workspace recovery only when selected-bank URL lacks a valid Step |

Frontend validation improves UX. Backend remains authoritative for access, enum validation, availability, question existence, bank membership, creation quotas, grouping and persistence.

## 10. State ownership

### Server state
- counts, filtered availability, subjects, systems/topics, difficulty counts, create result, retrieved IDs.

### Local interaction state
- question tab, selected modes/difficulty/subjects/systems/topics, count, title, custom text, retrieve/create progress/errors.

### Workspace navigation state
- `step` is URL-owned QBank context. QBank shell recovers/canonicalizes it when a malformed legacy URL omits it.

## 11. Page states

- Loading: existing section loaders/placeholders; availability renders `…` while unknown.
- Standard availability known: show `Available: N` beside the Questions input.
- Standard invalid count (`<1`, non-integer, or `>50`): count input uses invalid styling and Create is disabled.
- Custom empty: Create disabled.
- Custom invalid token(s): inline invalid-entry message; Create disabled.
- Custom >50 valid unique IDs: counter in error state + max message; Create disabled.
- Backend invalid/unavailable IDs: retain input and display backend error.
- Missing Step in selected-bank URL: workspace resolves canonical Step and replaces URL; valid bank should not falsely render `Bank not found`.
- True missing/unavailable bank: neutral Bank not found state.

## 12. Interaction rules

- A mode selection can never become empty.
- Exactly one selected status → submit that canonical single mode.
- 2+ selected statuses → submit `mixed_modes` + `filters.modes`; show `Mixed · N selected`.
- Standard `Available: N` beside the Questions input comes from the same current filtered availability used to gate creation.
- Standard frontend product limit is `MAX_TEST_QUESTIONS = 50`; only integer counts from `1..50` may create a test.
- Do not silently clamp a Standard request from an invalid value such as 100 down to 50.
- Custom parser accepts comma-separated entries, trims whitespace, ignores empty separators, deduplicates valid IDs for the payload, and treats only positive integers as syntactically valid IDs.
- Never `.slice(0, 50)` user IDs.
- Custom frontend product limit is `MAX_CUSTOM_IDS = 50`; >50 unique valid IDs block Create but remain visible in the textarea.
- Systems/topics selected IDs remain part of availability/creation filters, but they are excluded from the systems/topics metadata query so the source matrix does not collapse as the user selects it.
- Internal QBank links must preserve `step`; missing-Step recovery is a fallback, not the normal navigation path.

## 13. Accessibility

- Preserve native checkbox/button/input semantics.
- Mixed state must be visible text, not color-only.
- Availability is rendered as visible text beside the number input, not color-only.
- Standard invalid count uses `aria-invalid` and visible invalid styling.
- Validation text must be readable and associated visually with the Custom textarea.
- Disabled Create remains a real disabled button.
- Responsive controls retain practical touch targets.

## 14. Security/privacy/content safety

- Do not expose correct answers or hidden question content.
- Do not bypass backend access checks or quotas.
- Do not trust frontend validation as authorization.
- Retain backend canonical filtering and subscription enforcement.
- Step recovery only finds active banks already exposed through the authenticated QBank metadata endpoint; it does not bypass bank access rules.

## 15. Performance considerations

- Stable metadata filters prevent unnecessary refetch/churn from every system/topic selection.
- Counts still use the final filters so availability remains accurate.
- The `Available: N` label reuses existing availability state; it adds no new network request.
- Standard count validation is local state only and adds no network request.
- Normal valid-Step QBank navigation remains step-scoped.
- Only malformed/legacy selected-bank URLs missing a valid Step use the unscoped active-bank catalogue once to recover context.

## 16. Acceptance criteria

- [x] Single selected status request construction keeps its canonical mode unchanged.
- [x] 2+ selected statuses source implementation uses `mode: "mixed_modes"` plus `filters.modes` and renders the approved Mixed indicator in source.
- [x] Standard frontend product maximum is 50 questions via `MAX_TEST_QUESTIONS`.
- [x] Standard invalid counts outside `1..50` block Create instead of silently creating a differently sized test.
- [x] Standard Questions input renders the current filtered `Available: N` beside it without an additional API call.
- [x] Custom input is never silently truncated in source.
- [x] Frontend intentionally enforces 50 Custom IDs through `MAX_CUSTOM_IDS` while documenting that the backend supports a higher ceiling.
- [x] Invalid/non-numeric/non-positive/non-integer entries are surfaced and block Create in source.
- [x] >50 valid unique IDs remain in the textarea and block Create in source.
- [x] Systems/topics metadata request excludes selected system/topic IDs.
- [x] Final availability/create requests still include selected systems/topics.
- [x] Create Test responsive source pass implemented.
- [x] Step-preserving Create Test links implemented from QBank Welcome/Previous Tests/sidebar.
- [x] Bare selected-bank URL Step recovery implemented in QBank workspace source.
- [ ] Runtime browser acceptance confirmed on Cloudflare deployment.
- [ ] Runtime bare-URL Step recovery confirmed.
- [ ] Authenticated single/mixed/custom create flows confirmed against live backend.

## 17. Verification plan

### Automated
- Typecheck
- Lint
- Build
- GitHub Actions `Verify` on latest head

### Browser/manual evidence
- Single-mode visual/request behavior
- Mixed badge for 2+ modes
- Standard Questions row shows the correct live `Available: N`
- Standard 50 is allowed; Standard 51 remains visible/invalid and blocks Create
- Valid Custom IDs up to the frontend limit
- Invalid Custom token
- 51 Custom IDs remain visible and block Create without truncation
- Systems/topics stable while selecting systems/topics
- Desktop/tablet/mobile responsive acceptance
- Remove `?step=` from a known valid Create Test URL and reload; URL should self-repair to the bank's real Step and page should load
- Welcome → Create Test and Previous Tests → Create Test retain correct Step
- Real API happy path where credentials/test data safely permit

Runtime target: `https://medfront.geminiamo0.workers.dev`.

## 18. Approval/runtime record

2026-10-05 — User approved:
- automatic Mixed when 2+ status modes are selected;
- subtle `Mixed · N selected` visual trigger, no separate Mixed button;
- Custom `N / 50`, explicit invalid IDs, disabled Create on invalid/>50, never truncate or erase input;
- Systems/topics selections affect the test but must not collapse the matrix;
- Standard and Custom frontend product maximum = 50;
- live filtered Available count beside Questions;
- premium responsive QBank/Create Test handling across desktop/tablet/mobile, while deferring Library mobile/tablet to a separate discussion.

2026-10-05 — User supplied runtime evidence of false `Bank not found` on some Create Test pages. Screenshot URL lacked `?step=`. Source audit found Step-dropping Create Test links and Step-1 fallback; source fixes now preserve Step and recover old/bare URLs.