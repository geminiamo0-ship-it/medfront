# MedPark Overview

## What MedPark is

MedPark is a medical education platform centered on a medical Library, QBank/exam workflow, performance/study tools and supporting account/community/admin capabilities.

The current reconstruction has three major learner-facing pillars already visible:

1. **Library** — article reader with exam-oriented tooling such as High-yield mode, highlights/annotations, notebook, AI summaries, Amboss-style interactions and dark mode.
2. **QBank** — browse question banks by step/provider, view bank performance and build tests.
3. **Hub / Dashboard** — entry point and at-a-glance navigation/performance surfaces.

The next core missing learner workflow is the full Exam Runner + Results/Review experience, but it is intentionally blocked until governance/stabilization phases complete and its page design is approved.

## Canonical architecture

```text
┌─────────────────────────────────┐       HTTPS + Bearer token       ┌────────────────────────────────┐
│  medfront/main                  │ ───────────────────────────────► │  medhvgg/main                  │
│  canonical frontend             │                                  │  canonical backend/API         │
│                                 │ ◄─────────────────────────────── │                                │
│  React 18 · Vite · TypeScript   │   JSON / encrypted envelopes     │  NestJS 10 · TypeORM           │
│  React Router · TanStack Query  │                                  │  PostgreSQL · Redis            │
└─────────────────────────────────┘                                  └────────────────────────────────┘
```

`medfront/backend` is a **reference-only imported snapshot** containing useful historical code/docs. It is not the live/canonical backend and must not be developed or deployed from.

### Ownership rules

- Frontend owns presentation, interaction, routing and client orchestration.
- Backend owns authentication/authorization, security quotas, subscription/access decisions, test semantics, persistence, scoring, analytics and other business rules.
- API responses may be encrypted by backend transport infrastructure and are decrypted in the frontend API client layer.
- Backend content HTML is user/content scoped and may be watermarked; sanitize before rendering and do not strip security behavior.

See `docs/ENGINEERING_GUARDRAILS.md` for the full boundary.

## Current frontend state

| Area | Route | State |
|---|---|---|
| Auth | `/login`, `/register`, verification/reset/profile routes | Implemented |
| Hub | `/hub` | Implemented |
| Dashboard | `/dashboard` | Implemented |
| Library | `/library` | Advanced; fidelity/regression checks remain |
| QBank listing | `/qbank` | Implemented |
| Bank workspace | `/qbank/:bankId/*` | Implemented |
| Create Test | `/qbank/:bankId/create-test` | Built; correctness stabilization pending |
| Previous Tests | workspace route | Implemented |
| Test runner | `/test/:testId` | Placeholder; design-first phase |
| Results/review | future/current runner flow | Not reconstructed |
| Contests | `/contests` | Placeholder; backend capability exists |
| AI Analyst | `/ai-analyst` | Placeholder |
| Settings | `/settings` | Placeholder; backend user/access capabilities exist |
| Flashcards / Revision / Messages / Tickets | not currently routed | Backend capabilities exist; parked until their phase |

Use `PROJECT_STATUS.md` for the active issue and exact next step; use `docs/MASTER_PLAN.md` for long-range phase order.

## Glossary

| Term | Meaning |
|---|---|
| **Canonical frontend** | `geminiamo0-ship-it/medfront` branch `main` |
| **Canonical backend** | `geminiamo0-ship-it/medhvgg` branch `main` |
| **Reference backend snapshot** | `medfront/backend`; read-only historical/reference source |
| **Main bank** | Content provider/group such as UWorld, Amboss, NBME, etc. |
| **Question bank** | Specific exam/question set inside a provider |
| **Block bank** | Bank/test using fixed block-style End-Block semantics |
| **Step** | Exam step/track used as a top-level QBank filter |
| **Mode** | Question-selection criterion such as unused/incorrect/marked/etc. |
| **Mixed mode** | Combined selection stored using backend enum `mixed_modes` + filter modes |
| **Custom test** | Test created from an explicit allowed list of question/import IDs |
| **423** | Domain locked state used by some backend paths; not a generic server failure |
| **Watermark** | Server-side user/content marking applied to protected HTML |

## Product/engineering workflow

Every new page or material redesign uses:

```text
Inspect current evidence/backend
→ Discuss UX/style with user
→ Write page spec
→ User approves spec
→ Implement in small slices
→ Test/browser verify
→ GitHub Actions Verify
→ Update issue + PROJECT_STATUS
→ Done
```

See `docs/PAGE_DELIVERY_WORKFLOW.md` and `docs/page-specs/TEMPLATE.md`.

## Related documents

- Current continuation point: [`../PROJECT_STATUS.md`](../PROJECT_STATUS.md)
- Operating rules: [`../AGENTS.md`](../AGENTS.md)
- Engineering guardrails: [`ENGINEERING_GUARDRAILS.md`](ENGINEERING_GUARDRAILS.md)
- A→Z plan: [`MASTER_PLAN.md`](MASTER_PLAN.md)
- Page workflow: [`PAGE_DELIVERY_WORKFLOW.md`](PAGE_DELIVERY_WORKFLOW.md)
- Backend capability map: [`BACKEND_CAPABILITY_MAP.md`](BACKEND_CAPABILITY_MAP.md)
- Frontend setup: [`FRONTEND_SETUP.md`](FRONTEND_SETUP.md)
- Frontend architecture: [`FRONTEND_ARCHITECTURE.md`](FRONTEND_ARCHITECTURE.md)
- API reference: [`API_REFERENCE.md`](API_REFERENCE.md)
- Backend orientation: [`BACKEND_OVERVIEW.md`](BACKEND_OVERVIEW.md)
- Existing issue notes: [`ROADMAP.md`](ROADMAP.md)
