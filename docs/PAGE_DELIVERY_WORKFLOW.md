# Page Delivery Workflow

Every new MedPark page and every material redesign follows this workflow. This is the mechanism that prevents ad-hoc UI decisions, hidden assumptions and spaghetti growth.

## Status flow

```text
PARKED
  ↓
DESIGN
  ↓
SPEC APPROVED
  ↓
IMPLEMENTING
  ↓
VERIFYING
  ↓
DONE
```

A page may move backward if new evidence invalidates the spec.

---

## Step 0 — Activate one focused issue

Before page work:

- create/activate one GitHub issue;
- link its parent phase/master issue;
- state dependencies/blockers;
- state whether this is a new page, reconstruction, redesign or contract-only fix.

Do not use a broad phase epic as the implementation issue.

---

## Step 1 — Inspect before proposing design

Read:

1. current route/page/components in `medfront/main`;
2. canonical backend contracts in `medhvgg/main`;
3. relevant current docs;
4. relevant `medfront/backend` files only as historical/reference evidence;
5. any screenshots/references supplied by the user.

Produce a short evidence summary:
- what exists now;
- what backend supports;
- what is missing;
- what old/reference behavior may be reusable;
- any contradictions/risks.

Do not implement yet.

---

## Step 2 — UX/style conversation with the user

For the active page, explicitly discuss the decisions that matter before code.

Typical design topics:
- purpose and primary user job;
- information hierarchy;
- page shell/header/sidebar;
- density and spacing;
- colors/theme/tokens;
- cards/tables/forms/navigation style;
- desktop layout;
- mobile layout;
- empty/loading/error/locked states;
- animations/motion;
- interaction details;
- keyboard behavior;
- references to UWorld/Amboss/old MedPark/current MedPark where relevant;
- what should intentionally **not** be copied.

The user does not need to specify every CSS value. The goal is agreement on the design system and behavior, not pixel-by-pixel micromanagement.

If the user supplies a screenshot or image reference, record what aspects are authoritative (layout, hierarchy, colors, interactions, etc.) in the spec.

---

## Step 3 — Write the page spec before implementation

Create/update `docs/page-specs/<PAGE>.md` from `TEMPLATE.md`.

The spec must include:
- route and entry/exit paths;
- page purpose and user jobs;
- approved visual direction;
- responsive behavior;
- component boundaries;
- backend endpoints and authoritative rules;
- server/local state ownership;
- loading/empty/error/access states;
- security/privacy/sanitization considerations;
- accessibility/keyboard requirements;
- acceptance criteria;
- verification plan;
- explicit non-goals;
- approval record.

Commit the spec and update the issue checklist.

No product implementation before the spec is approved.

---

## Step 4 — Decompose the implementation

Break the approved page into small coherent slices. A typical order:

1. API/types/contracts;
2. pure/shared feature components;
3. state/query hooks;
4. page orchestration;
5. interaction details;
6. error/access/edge states;
7. responsive/accessibility polish;
8. automated tests;
9. browser/E2E verification.

Avoid one giant commit that creates the whole page plus unrelated refactors.

If implementation reveals an unapproved UX decision, return to DESIGN/SPEC instead of silently deciding it in code.

---

## Step 5 — Verify each slice

Minimum code checks:

```bash
npm run typecheck
npm run lint
npm run build
```

Plus targeted automated tests once present.

For user-facing pages, verify acceptance criteria in a real browser. Check more than the happy path.

Applicable states may include:
- loading;
- empty;
- invalid input;
- 401/403;
- 423 locked;
- 429/quota;
- network retry;
- server error;
- stale/expired session;
- mobile layout;
- keyboard/focus behavior.

Critical flows should use the real canonical API where safe/appropriate.

---

## Step 6 — GitHub Actions gate

Push the completed slice and verify the repository `Verify` workflow.

Do not mark a checkbox for “verified” based only on a local statement. Record the passing run/commit in the issue or status document when practical.

---

## Step 7 — Documentation/status reconciliation

Before Done:

- update the active issue checklist;
- update the page spec if implementation refined any approved detail;
- update feature/API docs if contracts changed;
- update `PROJECT_STATUS.md` with current phase, active issue and exact next step;
- record anything still unverified.

Then, and only then, mark the issue/page `DONE`.

---

# Contract-only fixes

Not every bug needs a visual-design meeting. If a change is strictly a backend/frontend contract correction with no visual/interaction choice (for example changing a wrong enum value):

- document it as `NO VISUAL CHANGE` in the issue/spec;
- define acceptance criteria;
- implement and verify normally.

If the fix changes visible validation, errors, layout or interaction, discuss those visible details first.

---

# Page issue checklist template

Copy this into a focused page issue:

```md
## Evidence
- [ ] Current frontend inspected
- [ ] Canonical backend contract inspected
- [ ] Reference/history inspected if useful

## Design
- [ ] UX/style discussed with user
- [ ] Desktop behavior agreed
- [ ] Mobile behavior agreed
- [ ] States/interactions agreed
- [ ] Page spec committed
- [ ] User approval recorded

## Implementation
- [ ] API/types
- [ ] Components
- [ ] State/query orchestration
- [ ] Error/access states
- [ ] Responsive/accessibility
- [ ] Tests

## Verification
- [ ] Typecheck
- [ ] Lint
- [ ] Build
- [ ] Browser acceptance checks
- [ ] Critical API/E2E check where applicable
- [ ] GitHub Actions Verify

## Closeout
- [ ] Relevant docs updated
- [ ] PROJECT_STATUS.md updated
- [ ] Remaining limitations recorded
```
