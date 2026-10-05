# Engineering Guardrails

These rules exist to keep MedPark maintainable while the recovered frontend is expanded to match the mature backend.

## 1. Architecture boundary

### Frontend owns
- presentation and interaction
- route composition
- client-side UX validation
- server-state fetching/caching
- transient local interaction state
- accessibility/responsive behavior
- rendering of already-authorized data

### Canonical backend (`medhvgg/main`) owns
- authentication and authorization
- roles and access control
- subscription/entitlement decisions
- security quotas/rate limits
- test selection/execution semantics
- correctness/scoring
- persistence and idempotency
- analytics aggregation
- content watermarking
- financial/payment rules
- admin/support permissions

Never move a backend rule into React just because it is convenient. Client checks can improve UX but cannot become the authority.

## 2. Repository ownership

- `medfront/main`: canonical frontend.
- `medhvgg/main`: canonical backend.
- `medfront/backend`: frozen reference snapshot only.

Any backend gap discovered from frontend work must be confirmed against `medhvgg/main` before a backend change is proposed.

## 3. Feature organization

Do not trigger a repository-wide refactor just to impose a new folder pattern. Preserve stable working code and improve structure when a feature is actively touched.

For new or substantially rebuilt complex features, prefer a coherent feature boundary, for example:

```text
src/features/exam/
  api/
  components/
  hooks/
  pages/
  types/
  utils/
```

Existing small shared UI primitives remain under `src/components/ui`. Cross-feature infrastructure remains under `src/lib` and `src/api` where appropriate.

### Extraction rule
Extract a component/hook/module when it has a clear responsibility, independent state/behavior, repeated use, or when a page becomes difficult to reason about. Do not split files into meaningless one-function wrappers merely to reduce line count.

Current large files such as `LibraryPage.tsx` and `CreateTestPage.tsx` should be decomposed incrementally as affected responsibilities are changed.

## 4. API contracts

- No ad-hoc `fetch`/Axios calls inside page components when a feature API layer exists.
- Centralize endpoints in `src/api/*` or feature API modules.
- Give stable backend DTOs/results concrete TypeScript types.
- Do not permanently paper over contracts with `any`, unsafe casts, or `Record<string, unknown>`.
- Preserve backend status semantics: e.g. `423` is a real locked state, `401/403` are access/auth states, `429` is a throttling/quota state.
- API docs must state correct HTTP method, route, request and response ownership.
- Treat encrypted response handling as transport infrastructure; page code must not manually decrypt payloads.

## 5. Server state vs local state

Use TanStack Query for remote/server state and cache lifecycle. Use component state/reducers for ephemeral UI behavior.

Avoid:
- duplicating API objects into multiple unsynchronized stores;
- using localStorage as a substitute for server persistence;
- global context for feature-local state;
- hidden mutation of cached data without invalidation/reconciliation.

Document any intentionally persisted browser state.

## 6. Rendering medical/content HTML

All backend-provided HTML must use the established sanitization path. Do not introduce raw unsanitized `dangerouslySetInnerHTML` usage.

Preserve watermarking rather than trying to strip or normalize it away.

Image/media behavior must respect the canonical backend/CDN contract and the page spec.

## 7. Error and lifecycle states

Every data-driven page must intentionally consider applicable states:

- initial loading
- background refresh
- empty
- validation error
- locked/entitlement required
- unauthenticated/session expired
- forbidden
- rate limited/quota exhausted
- network unavailable/retry
- backend/server failure
- partial or stale data if the contract permits it

Do not reduce every non-200 response to a generic red box.

## 8. Page/UI development gate

No new page or material redesign starts from code.

Required sequence:

1. inspect evidence and backend contract;
2. discuss UX/style with the user;
3. write page spec;
4. obtain user approval;
5. implement;
6. verify;
7. update docs/status.

See `docs/PAGE_DELIVERY_WORKFLOW.md`.

## 9. Accessibility and responsive behavior

Page specs must define keyboard/focus behavior and mobile behavior, not just desktop screenshots.

Minimum expectations:
- semantic controls rather than clickable divs when possible;
- visible focus;
- Enter/Space behavior for button-like controls;
- labels/accessible names for form controls and icon buttons;
- no critical interaction requiring hover only;
- sensible responsive layout for narrow screens;
- reduced-motion consideration for decorative animation where appropriate.

## 10. Performance rules

- Avoid request waterfalls when requests can safely be parallelized.
- Do not refetch static/taxonomy data on every interaction without need.
- Respect backend caching and invalidation semantics.
- Avoid expensive derived computations on every render when the data set is large.
- Prefer lazy loading for heavy panels/content that is not immediately needed.
- Do not optimize by weakening correctness, access checks or persistence.

Critical user flows receive real browser/network measurement before release.

## 11. Security rules

- Never place secrets in frontend env variables or repository files.
- Treat every `VITE_*` value as public.
- Never bypass backend authorization or subscription checks in the UI.
- Do not expose correct answers in timed flows before the backend allows them.
- Never disable sanitization to fix styling.
- Preserve CSRF/OAuth/security behavior defined by the canonical backend.
- Historical security audits are re-check lists; only current code/dynamic verification can establish present state.

## 12. Testing pyramid

### Every code issue
- typecheck
- lint
- production build
- targeted automated tests as available

### User-facing behavior
- browser verification of acceptance criteria
- error/state verification, not only happy path

### Critical workflows
Use E2E coverage once the test harness is established, especially:
- auth
- Create Test
- exam taking/suspend/resume/finish
- results/review
- subscription/access boundaries
- payments if implemented

### Performance/security-sensitive changes
Run targeted backend/API verification and relevant load/security checks rather than assuming frontend build success is sufficient.

## 13. Change sizing

Prefer issue-scoped, reviewable changes. Avoid:
- page redesign + architecture rewrite + unrelated cleanup in one commit;
- mass renames without product value;
- speculative abstractions for future features;
- giant shared hooks containing multiple unrelated domains.

If scope grows, split the issue and update the plan before coding further.

## 14. Documentation and evidence

Every completed issue must leave behind:
- what changed;
- what was tested;
- what remains unverified;
- links/references to the governing spec/issue;
- updated `PROJECT_STATUS.md` exact continuation point.

No green checkmark without evidence.