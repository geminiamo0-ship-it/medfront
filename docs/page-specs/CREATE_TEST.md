# Create Test — Page Spec

**Parent issue:** #3  
**Responsive shell issue:** #11  
**Status:** VERIFYING  
**Route:** `/qbank/:bankId/create-test`  
**Last updated:** 2026-10-05  
**User approval:** Approved 2026-10-05

## 1. Purpose

Let a learner create a question block from one bank using status modes, difficulty, subjects, systems/topics, or explicit Custom UWorld IDs, with predictable validation, stable filter metadata, and a premium responsive experience across desktop, tablet/iPad and mobile.

## 2. Approved product behavior

- Exactly one selected status submits its canonical single mode.
- Two or more selected statuses automatically submit `mode: "mixed_modes"` with `filters.modes` and show `Mixed · N selected`.
- Standard tests are intentionally capped at **50 questions in the frontend** through `MAX_TEST_QUESTIONS`.
- Standard counts outside `1..50` remain visible, are marked invalid, and block Create; they are never silently clamped to another size.
- Standard shows live filtered `Available: N` beside the Questions input using existing availability state.
- Custom is intentionally capped at **50 unique valid IDs in the frontend** through `MAX_CUSTOM_IDS`.
- Custom raw input is never silently truncated or erased.
- Invalid/non-numeric/non-positive/non-integer Custom entries are surfaced and block Create.
- >50 valid unique Custom IDs remain in the textarea and block Create.
- Systems/topics selections affect availability/create, but selected `systemIds/topicIds` are excluded from the systems/topics metadata query so the source matrix/search does not collapse while it is being selected.
- The backend remains authoritative for access, quotas, question existence, bank membership, grouping, persistence and all domain rules.

## 3. Canonical backend findings

Canonical backend: `geminiamo0-ship-it/medhvgg/main`.

- `TestMode.MIXED = "mixed_modes"`.
- `filters.modes[]` carries the selected modes for mixed creation.
- `CreateTestDto.totalQuestions` allows up to 200.
- `customQuestionIds` has no 50-element DTO cap.
- Therefore the current Standard 50-question and Custom 50-ID ceilings are deliberate frontend product rules, not backend schema/security limits.
- Backend telemetry may alert above 100 requested questions, but this does not itself reject the request; the DTO maximum remains 200.
- The service's `previewCount = 50` only limits invalid-ID error preview text; it is not a creation-size rule.
- Current canonical Custom creation resolves active matching question IDs in the permitted bank but does **not** apply the normal UNUSED predicate. Existing UI copy saying Custom is `unused only` remains a documented contract discrepancy and must not be claimed as verified behavior.

## 4. QBank shell relationship

Create Test lives inside the dedicated QBank workspace described by `docs/page-specs/QBANK_WORKSPACE.md`.

As of Issue #11:
- `/qbank/:bankId/*` must not render inside the global `AppLayout` header.
- Desktop uses the dedicated fixed QBank sidebar.
- Tablet/iPad/mobile use the QBank off-canvas drawer.
- Create Test content must fit the workspace without horizontal overflow.

## 5. Approved visual direction

Preserve the existing MedPark/QBank visual language rather than redesigning the page.

Approved visible additions/refinements:
- subtle `Mixed · N selected` state;
- Standard `Available: N` beside Questions;
- Standard invalid-count styling;
- Custom compact `N / 50` counter and inline validation;
- responsive/touch-friendly layout for desktop, tablet/iPad and mobile.

## 6. Responsive behavior

### Desktop
- Keep current card hierarchy and section order.
- Question Mode, Difficulty, Subjects and Systems use comfortable multi-column density.
- Test Mode + Questions + Available + Create may share the bottom action row.

### Tablet / iPad
- Cards retain the same hierarchy but use fewer grid columns.
- QBank navigation is supplied by the workspace drawer below the desktop breakpoint.
- Controls wrap instead of shrinking into cramped desktop rows.
- Systems/topics remain readable and tappable.
- Topic search remains inside the viewport.

### Mobile
- Page uses compact workspace padding with no horizontal overflow.
- Standard/Custom segmented control becomes full-width.
- Question status and Difficulty choices become touch-friendly stacked/grid rows.
- Subjects and Systems become one-column lists where needed.
- Custom Retrieve input/button stack vertically.
- Test Mode controls wrap cleanly.
- Standard Questions + Available + Create stack so the primary action remains obvious and full-width where appropriate.
- Topic Search opens in a viewport-safe fixed panel rather than a desktop-width dropdown that can overflow the phone.
- Interactive rows use practical touch heights.

## 7. Current component behavior

### Question Mode
- `Standard` / `Custom` remain the only top-level tabs.
- Selecting 2+ status checkboxes automatically means Mixed; there is no separate Mixed button.
- `Available` reflects current status/filter selection.

### Standard filters
- Difficulty, Subjects, Systems and Topics preserve existing backend semantics.
- Systems remain disabled until at least one Subject is selected, matching current behavior.
- Topic search merges same-name topics for presentation while applying all underlying IDs.

### Custom
- Optional test name remains.
- Existing retrieve-test flow remains.
- Comma-separated ID input is parsed, deduplicated for payload, and validated without mutating raw input.

### Bottom actions
- Tutor/Timed behavior is unchanged.
- Standard Questions accepts only integer `1..50` for creation.
- Create remains a real disabled button for invalid/unavailable states.

## 8. State ownership

### Server state
- per-mode counts;
- mixed availability;
- difficulty counts;
- subjects;
- systems/topics metadata;
- retrieved test IDs;
- create result.

### Local state
- Standard/Custom tab;
- selected modes/difficulty/subjects/systems/topics;
- requested question count;
- Tutor/Timed;
- title;
- Custom raw ID text;
- retrieve/create progress and errors.

No new persisted browser state is introduced by the responsive pass.

## 9. Accessibility

- Native checkbox/button/input semantics remain.
- Mixed state is visible text, not color-only.
- Standard invalid count uses `aria-invalid` plus visible styling.
- Custom validation remains visibly associated with the textarea.
- Touch controls must remain practically sized on narrow viewports.
- Topic-search controls remain keyboard reachable.
- Responsive transformations must not hide required controls off-screen.

## 10. Performance

- The `Available: N` label reuses existing availability state and adds no request.
- Responsive changes are CSS/layout/local UI only.
- Stable metadata filters avoid unnecessary systems/topic matrix churn.
- Parsed Custom IDs and filter objects remain memoized.

## 11. Explicit non-goals

- No backend contract change.
- No Exam Runner implementation.
- No broad QBank visual rebrand.
- No wholesale rewrite of `CreateTestPage.tsx` merely for style.
- **No Library mobile/tablet work in this slice.** The user explicitly deferred Library responsive design until a separate detailed discussion.

## 12. Acceptance criteria

### Correctness/source
- [x] Canonical `mixed_modes` request for 2+ modes.
- [x] `filters.modes` contains selected mixed statuses.
- [x] Standard frontend maximum = 50.
- [x] Standard invalid counts block Create without silent clamping.
- [x] `Available: N` reuses live filtered availability.
- [x] Custom frontend maximum = 50.
- [x] Custom raw input is never silently truncated/erased.
- [x] Invalid Custom tokens block Create.
- [x] Systems/topics metadata query excludes selected system/topic IDs.
- [x] Final availability/create filters still include selected systems/topics.
- [x] Custom `unused only` contract discrepancy remains documented.

### Responsive source implementation — Issue #11
- [x] Standard/Custom toggle fits narrow screens.
- [x] Status modes use touch-friendly responsive grid rows.
- [x] Difficulty uses responsive touch-friendly grid rows.
- [x] Subjects/Systems/Topics adapt to narrow viewports.
- [x] Custom Retrieve controls stack on mobile.
- [x] Test Mode / Questions / Available / Create stack cleanly on narrow screens.
- [x] Topic Search uses a viewport-safe mobile panel.
- [x] Existing product semantics are preserved during responsive changes.

### Runtime verification still required
- [ ] Desktop browser acceptance.
- [ ] Tablet/iPad browser acceptance.
- [ ] Mobile browser acceptance.
- [ ] No unintended horizontal overflow.
- [ ] Mixed badge verified on deployed runtime.
- [ ] Standard 50 accepted; 51 remains visible/invalid and blocks Create.
- [ ] Valid/invalid/>50 Custom states verified.
- [ ] Systems/topics matrix/search remains stable during selections.
- [ ] Authenticated single-mode create ≤50.
- [ ] Authenticated mixed-mode create ≤50.
- [ ] Authenticated valid Custom create ≤50 IDs.

## 13. Verification plan

### Automated
Run:
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- GitHub Actions `Verify`

Historical green checkpoints include the original Create Test implementation and later product-limit/availability refinements. The Issue #11 responsive source state must have its own final green `Verify` before this slice is complete.

### Browser/manual
Runtime: `https://medfront.geminiamo0.workers.dev`

Verify approximately:
- desktop ≥1280px;
- tablet/iPad ~768–1024px;
- mobile ~360–430px.

## 14. Approval record

2026-10-05 — User approved:
- automatic Mixed + subtle badge;
- Custom validation without truncation;
- stable systems/topics matrix;
- frontend-only maximum 50 for Custom;
- frontend-only maximum 50 for Standard Questions;
- live `Available: N` beside Standard Questions.

2026-10-05 — User additionally approved a premium responsive pass for the QBank workspace and Create Test across desktop, tablet/iPad and mobile. User explicitly deferred Library mobile/tablet work until a later detailed Library discussion.

## 15. Implementation log

- Original Create Test correctness slice implemented and previously CI-green.
- Standard/Custom frontend product limits aligned at 50 while leaving backend headroom unchanged.
- Live filtered availability added beside Standard Questions.
- Issue #11 introduced the dedicated QBank responsive shell and Create Test responsive pass.
- Responsive source implementation includes touch-friendly grids, mobile-stacked form/actions, compact spacing, responsive systems/topics, and a viewport-safe Topic Search panel.
- Final Issue #11 CI/browser acceptance remains the current verification checkpoint.