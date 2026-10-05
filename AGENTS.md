# AGENTS.md — MedPark operating rules

This file is mandatory reading before changing `medfront/main`.

## 1. Read order before every task

Read, in order:

1. `PROJECT_STATUS.md`
2. `AGENTS.md`
3. `docs/ENGINEERING_GUARDRAILS.md`
4. `docs/MASTER_PLAN.md`
5. the active GitHub issue
6. the relevant feature/page documentation
7. for page work, the approved file under `docs/page-specs/`

If any of these disagree, stop feature implementation and reconcile the documentation first.

## 2. Sources of truth

Use this precedence:

1. **Explicit current user decision / approved page spec** — UX and intended behavior.
2. **Canonical backend: `geminiamo0-ship-it/medhvgg` → `main`** — API contracts, validation, security, authorization, subscription/access rules, persistence, analytics and business semantics.
3. **Canonical frontend: this repository `geminiamo0-ship-it/medfront` → `main`** — current implemented web client.
4. **`medfront/backend` branch** — historical/reference snapshot only. Never develop, deploy or treat it as canonical.
5. Historical Markdown/audits — clues to re-check, never proof of current behavior when contradicted by current code.

Do not duplicate backend business rules in React. The frontend may validate for UX, but the server remains authoritative.

## 3. One active implementation issue

Keep one primary implementation issue active at a time unless the user explicitly reprioritizes.

Issue status vocabulary:

- `PARKED` — future work only.
- `BLOCKED` — dependency not complete.
- `DESIGN` — UX/style discussion in progress.
- `SPEC APPROVED` — user approved the page/feature specification.
- `IMPLEMENTING` — code changes allowed.
- `VERIFYING` — implementation complete; checks still running.
- `DONE` — all Definition of Done gates passed.

Never call something Done because code exists.

## 4. Mandatory page-design gate

For every new page or material redesign:

1. Inspect current frontend, canonical backend and relevant reference evidence.
2. Discuss the page style/UX with the user **before implementation**.
3. Record the agreed design in `docs/page-specs/<PAGE>.md` using the template.
4. Include desktop/mobile layout, states, components, interactions, APIs, security/access notes, acceptance criteria and verification plan.
5. Record user approval in the spec and issue.
6. Only then move the issue to `IMPLEMENTING`.

Do not silently choose a visual direction and start coding.

A contract-only bug fix with no visible UX change may skip visual redesign, but it must still have explicit scope and acceptance criteria in its issue/spec.

## 5. Implementation discipline

For every issue:

1. inspect
2. specify
3. implement the smallest coherent slice
4. test locally/automatically where possible
5. verify browser behavior where applicable
6. verify GitHub Actions `Verify`
7. update the active issue checkboxes
8. update `PROJECT_STATUS.md`
9. update any affected feature/API/page docs
10. only then close or advance the issue

Do not bundle unrelated cleanup into a feature issue.

## 6. No-spaghetti rules

- Pages orchestrate UI; they do not become domain-service dumping grounds.
- API calls belong in `src/api/` or a feature API module, never scattered inline across page components.
- Use TanStack Query for server state. Keep local React state for local interaction state only.
- Add concrete request/response types for mature API paths. Avoid spreading `any` or generic `Record<string, unknown>` as a permanent contract.
- Keep shared primitives generic; keep feature-specific components near their feature.
- Prefer composition over giant components and deeply nested conditionals.
- Extract coherent responsibilities when touching oversized files; do not do a risky all-at-once rewrite just to reduce line count.
- Do not add a second implementation of auth, navigation, sanitization, API encryption, subscription checks or test semantics.
- Do not persist new state to `localStorage` unless the spec explicitly requires it and ownership/lifecycle are documented.
- Never render backend HTML without the existing sanitization path.
- Do not swallow API failures. Model loading, empty, locked, unauthorized, rate-limited and server-error states intentionally.
- Avoid premature abstraction: create a reusable abstraction only when there is a real repeated concept or a clear platform boundary.

## 7. Backend-change rule

If frontend work reveals a backend gap:

- confirm the gap against `medhvgg/main` first;
- create a separate backend-scoped issue/change;
- keep backend migrations/business logic in the backend repo;
- use migrations, never schema synchronization shortcuts;
- verify backend tests/contracts before consuming the change in the frontend.

Do not modify the `medfront/backend` reference branch as a workaround.

## 8. Verification gates

Minimum frontend gate for every code change:

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

Also run targeted automated tests once test infrastructure exists, and browser/E2E verification for user-facing flows.

Critical flows require real API verification where safe and appropriate. Do not claim end-to-end success from mocked/type-only checks.

## 9. Documentation must match reality

When implementation changes behavior, update the relevant docs in the same work item. `PROJECT_STATUS.md` must always identify:

- active phase
- active issue
- exact next step
- blockers
- what is proven vs unverified
- last successful verification

A future AI/developer should be able to continue from the repository without relying on hidden chat context.
