---
name: Page / major feature
about: Design-first implementation issue for one MedPark page or major feature
labels: ''
assignees: ''
---

## Parent / phase

Parent: #

## Goal

Describe the user outcome, not the implementation.

## Status

**DESIGN**

Allowed values: PARKED · BLOCKED · DESIGN · SPEC APPROVED · IMPLEMENTING · VERIFYING · DONE

## Evidence

- [ ] Current frontend inspected
- [ ] Canonical backend `geminiamo0-ship-it/medhvgg/main` inspected
- [ ] Relevant reference/history inspected if useful
- [ ] Existing docs/constraints reconciled

## Design gate

- [ ] UX/style discussed with user
- [ ] Desktop behavior agreed
- [ ] Mobile/responsive behavior agreed
- [ ] Loading/empty/error/access states agreed
- [ ] Keyboard/accessibility behavior agreed
- [ ] `docs/page-specs/<PAGE>.md` committed
- [ ] User approval recorded in spec + issue

> Do not start product implementation before the design gate is complete. Contract-only/no-visual-change fixes must explicitly say so and still define acceptance criteria.

## Backend/API contract

List the verified current endpoints/DTOs and state which rules are server-authoritative.

## Implementation slices

- [ ] Typed API/contracts
- [ ] Feature components
- [ ] State/query orchestration
- [ ] Page composition
- [ ] Edge/access/error states
- [ ] Responsive/accessibility
- [ ] Tests

## Acceptance criteria

- [ ]

## Verification

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Targeted automated tests
- [ ] Browser acceptance checks
- [ ] Real API/E2E verification where applicable
- [ ] GitHub Actions `Verify` green

## Closeout

- [ ] Page/feature/API docs updated
- [ ] `PROJECT_STATUS.md` updated with exact next step
- [ ] Remaining limitations/unverified items recorded
- [ ] Parent issue reconciled

## Notes / evidence

Add commit/run/screenshot/reference links as work progresses.
