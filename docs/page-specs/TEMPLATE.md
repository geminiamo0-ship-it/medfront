# <Page / Feature Name> — Page Spec

**Issue:** #<number>  
**Status:** DESIGN | SPEC APPROVED | IMPLEMENTING | VERIFYING | DONE  
**Route(s):** `<route>`  
**Last updated:** YYYY-MM-DD  
**User approval:** Pending | Approved YYYY-MM-DD

## 1. Purpose

What is this page for? What user job should it make easy?

## 2. Scope

### In scope
- 

### Explicit non-goals
- 

## 3. Evidence reviewed

### Current frontend
- files/routes/components inspected:

### Canonical backend (`medhvgg/main`)
- controller/service/entity/DTO paths inspected:
- endpoints used:

### Historical/reference evidence
- `medfront/backend` files/docs used, if any:
- screenshots/references supplied by user:

> Historical/reference evidence is never more authoritative than current canonical code or an explicit current user decision.

## 4. User-approved visual direction

Describe the agreed style in practical terms:
- overall visual language;
- density/spacing;
- hierarchy;
- surfaces/cards/tables/forms;
- typography;
- color/token use;
- iconography;
- motion/animation;
- reference products/elements to emulate or avoid.

## 5. Desktop layout

Describe regions from top to bottom/left to right.

## 6. Mobile/responsive layout

Define what stacks, collapses, becomes a drawer, remains sticky, changes control density, etc.

## 7. Navigation and user flow

### Entry points
- 

### Primary flow
1. 

### Exit/return paths
- 

## 8. Components and boundaries

Suggested feature components/hooks and their responsibilities. Do not force abstractions without a coherent responsibility.

## 9. Backend/API contract

| Action | Method | Endpoint | Request | Response | Authority/notes |
|---|---|---|---|---|---|
| | | | | | |

State which rules are backend-authoritative and which frontend validation exists only for UX.

## 10. State ownership

### Server state
- 

### Local interaction state
- 

### Persisted browser state (only if explicitly required)
- 

## 11. Page states

Define applicable behavior for:
- loading;
- background refresh;
- empty;
- validation failure;
- locked/entitlement required;
- unauthenticated/session expired;
- forbidden;
- rate limited/quota exhausted;
- offline/network failure;
- backend/server failure;
- stale/expired domain state.

## 12. Interaction rules

Document selections, confirmations, keyboard shortcuts, optimistic updates, retry rules, destructive actions, timers, panels, etc.

## 13. Accessibility

- semantics;
- labels/accessible names;
- keyboard behavior;
- focus management;
- contrast/state communication;
- reduced-motion behavior if relevant.

## 14. Security/privacy/content safety

- authorization/entitlement expectations;
- sanitized HTML requirements;
- sensitive data considerations;
- watermark/content-security behavior;
- what must never be exposed client-side.

## 15. Performance considerations

- query parallelization/caching;
- lazy loading;
- large list/HTML concerns;
- render hot paths;
- expected critical measurements if relevant.

## 16. Acceptance criteria

- [ ] 

## 17. Verification plan

### Automated
- [ ] Typecheck
- [ ] Lint
- [ ] Build
- [ ] Targeted unit/component tests
- [ ] E2E where applicable

### Browser/manual evidence
- [ ] Desktop
- [ ] Mobile
- [ ] Keyboard/focus
- [ ] Relevant error/access states
- [ ] Real API happy path where safe/appropriate

### CI
- [ ] GitHub Actions `Verify` green on final commit

## 18. Approval record

Record the user's approved direction and date. If material visual/interaction decisions change later, update this section before implementing the change.

## 19. Implementation/verification log

Keep a concise dated record of meaningful deviations, checks and remaining limitations.
