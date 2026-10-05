# Tactical Roadmap — Existing Frontend Issues

> **Planning authority:** use `PROJECT_STATUS.md` for the active task and `docs/MASTER_PLAN.md` for A→Z phase order. This file preserves the concrete tactical defects discovered in the recovered frontend. It does not override the design/spec/issue/CI workflow in `AGENTS.md`.
>
> **Canonical backend:** `geminiamo0-ship-it/medhvgg/main`. `medfront/backend` is reference-only.

## G1 / P0 — Create Test correctness

These break or distort real test creation and should be stabilized before the Exam Runner.

### 1. Multi-mode tests are rejected by the API
- `src/pages/qbank/CreateTestPage.tsx` currently sends `mode: "mixed"` when 2+ question modes are selected.
- Canonical backend `TestMode.MIXED` uses `"mixed_modes"` and validates the enum → current payload can return **400**.
- Fix: send `"mixed_modes"` whenever more than one mode is selected; single mode → that mode; custom → server-approved mode such as `"all"` according to the verified DTO/creation contract. `filters.modes` remains required for mixed selection.
- Visual impact: none for the enum correction itself; still verify UI behavior end-to-end.

### 2. Custom UW-ID validation silently truncates
- Current Create Test parsing uses a max slice so IDs beyond 50 can be silently dropped and the intended over-limit UI becomes unreachable.
- Fix: retain parsed input for validation, surface invalid/non-numeric values, disable creation when over the server maximum, and explain the verified server rules (selected bank / eligible unused questions / maximum count).
- **Visible validation/error behavior must be discussed/recorded before implementation.**

### 3. Systems matrix / topic search shrinks on selection
- The systems/topics metadata query currently shares the final creation filter object, including selected `systemIds`/`topicIds`.
- Result: selecting dimensions can refetch/narrow the metadata source itself so the matrix/global search collapses.
- Fix: use separate metadata-query filters (bank + relevant broad dimensions such as subject/difficulty) versus final creation/count filters.
- **Any visible interaction change must be reflected in the Create Test page spec/issue.**

### G1 verification gate
- single-mode creation succeeds against canonical live API;
- mixed-mode creation succeeds;
- custom allowed-ID creation succeeds;
- invalid/over-limit custom states are explicit;
- metadata matrix remains stable while selections change;
- typecheck/lint/build/browser checks/`Verify` pass.

Tracked by Issue #3.

---

## G1 / P1 — Library fidelity

### 4. API links disappear in High-yield mode
The current High-yield rule can hide `span.condensed-hidden*` elements that also act as Medical Interactive Links (`.api`, dictionary/link-suggest classes) that the intended reference behavior keeps available.

- Fix selectors narrowly so High-yield hides the intended condensed inline fragments without removing interactive medical links.
- Do not broaden hiding to section/table/block wrappers.

### 5. Ordered-list numbering needs visual verification
The Library CSS restores list styles because Tailwind Preflight strips markers, but this needs real browser verification on representative Amboss content.

Verify:
- ordered and unordered lists;
- nested lists;
- High-yield on/off;
- light/dark mode.

Tracked within Issue #3.

---

## G2 — Exam Runner + Results/Review

`/test/:testId` is currently a placeholder while the canonical backend already provides the execution engine.

**Do not implement directly from this checklist.** Issue #4 is design-first and must produce an approved page spec.

Candidate delivery slices after approval:

1. typed test lifecycle API helpers/contracts;
2. runner shell with sanitized/watermarked content;
3. prev/next and quick navigation;
4. mark/highlight;
5. timer/elapsed-time behavior;
6. Tutor submission flow;
7. Timed/batch End-Block flow;
8. suspend/resume/leave/reload/network recovery;
9. explanation/AI-explanation states;
10. approved notes/library/notebook/reference integrations;
11. completion and results/review;
12. keyboard/accessibility/responsive behavior;
13. automated + browser/E2E verification.

Tracked by Issue #4 and the future approved `docs/page-specs/EXAM_RUNNER.md`.

---

## Later surfaces

Current placeholder routes include Contests, AI Analyst and Settings, while the canonical backend also exposes substantial capabilities for flashcards, revision, notes/notebook, subscriptions/payments, messages, tickets/support, admin, finance, careers and more.

These are **not** permission to implement all at once. See `docs/BACKEND_CAPABILITY_MAP.md`, Issues #5/#7/#8 and the phase order in `docs/MASTER_PLAN.md`.

---

## Existing verification evidence (pre-governance)

Historical/current reconstruction work recorded:
- lint/build were run during prior feature commits;
- live API checks confirmed core bank/count/metadata data;
- browser checks covered systems/subjects/topic merging/custom selection/loader behavior;
- actual test-taking/results remained unimplemented;
- full end-to-end creation for all modes still needs the G1 stabilization/verification pass.

From G0 onward, evidence must also be reconciled in the active GitHub issue and `PROJECT_STATUS.md`, with GitHub Actions `Verify` passing before Done.
