# MedPark

Medical question-bank platform (Amboss / UWorld style) with a React frontend backed by the canonical NestJS API in a separate repository.

## Canonical sources

| Source | Role |
|---|---|
| **`geminiamo0-ship-it/medfront` → `main`** | Canonical MedPark **frontend** — React 18 + Vite 6 + TypeScript + Tailwind (`medpark-frontend`) |
| **`geminiamo0-ship-it/medhvgg` → `main`** | Canonical MedPark **backend/API** — NestJS 10 + TypeORM + PostgreSQL |
| **`medfront` → `backend`** | **Reference-only imported backend snapshot** with historical docs/code. Do not develop or deploy from it. |

For continuation, read **`PROJECT_STATUS.md` first**, then `AGENTS.md`, the engineering guardrails, master plan and active GitHub issue.

---

## Status

| Area | Route | Status |
|---|---|---|
| Hub | `/hub` | Done |
| Dashboard | `/dashboard` | Done |
| Library | `/library` | Advanced; fidelity/regression work remains |
| QBank listing | `/qbank` | Done (step → provider → banks underneath) |
| Bank workspace | `/qbank/:bankId` | Done (Welcome stats, Create Test, Previous Tests) |
| Create Test | `/qbank/:bankId/create-test` | Built; P0 correctness stabilization pending (#3) |
| Test runner | `/test/:testId` | **Placeholder** — design-first issue #4 |
| Contests / AI Analyst / Settings | `/contests`, `/ai-analyst`, `/settings` | Placeholder / future design-first work |

The exact active phase and next task live in [`PROJECT_STATUS.md`](PROJECT_STATUS.md), not in this summary.

---

## Quick start (frontend)

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run typecheck
npm run lint
npm run build
npm run preview
```

### Environment

`.env.development` / `.env.production` currently contain the public API base URL:

```text
VITE_API_URL=https://medhvgg-production.up.railway.app/api
```

API responses may arrive AES-256-GCM encrypted (`{enc:true,v:"..."}`) and are decrypted transparently by the API client/crypto layer. The auth token lives in `localStorage.token`.

Never put a secret in a `VITE_*` variable; Vite exposes these values to browser code.

---

## Project operating system

| Document | Purpose |
|---|---|
| [`PROJECT_STATUS.md`](PROJECT_STATUS.md) | Active phase, active issue, blockers, exact next step, proven/unverified state |
| [`AGENTS.md`](AGENTS.md) | Mandatory rules and source-of-truth precedence |
| [`docs/ENGINEERING_GUARDRAILS.md`](docs/ENGINEERING_GUARDRAILS.md) | Architecture, state, API, security, testing and no-spaghetti rules |
| [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md) | A→Z delivery sequence |
| [`docs/PAGE_DELIVERY_WORKFLOW.md`](docs/PAGE_DELIVERY_WORKFLOW.md) | Design/spec/implementation/verification workflow for every page |
| [`docs/page-specs/TEMPLATE.md`](docs/page-specs/TEMPLATE.md) | Required page-spec template |
| [`docs/BACKEND_CAPABILITY_MAP.md`](docs/BACKEND_CAPABILITY_MAP.md) | Canonical backend capabilities mapped to possible frontend surfaces |

### Existing feature/reference docs

| Document | Contents |
|---|---|
| [docs/OVERVIEW.md](docs/OVERVIEW.md) | Product scope, architecture and glossary |
| [docs/FRONTEND_SETUP.md](docs/FRONTEND_SETUP.md) | Install/run/build, environment, dev rules and gotchas |
| [docs/FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md) | Folder map, routing table, API layer, theme tokens |
| [docs/FEATURES_AUTH_HUB_DASHBOARD.md](docs/FEATURES_AUTH_HUB_DASHBOARD.md) | Auth flows, Hub, Dashboard |
| [docs/FEATURES_QBANK.md](docs/FEATURES_QBANK.md) | Step → provider → banks, workspace, Welcome, Previous Tests |
| [docs/FEATURES_CREATE_TEST.md](docs/FEATURES_CREATE_TEST.md) | Standard + Custom modes, payload contract, subjects/systems/topics |
| [docs/FEATURES_LIBRARY.md](docs/FEATURES_LIBRARY.md) | Reader phases, components, High-yield rules, dark mode |
| [docs/UI_LOADING_SYSTEM.md](docs/UI_LOADING_SYSTEM.md) | Heartbeat/ECG loader components and keyframes |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | Frontend API helpers and relevant backend lifecycle endpoints |
| [docs/BACKEND_OVERVIEW.md](docs/BACKEND_OVERVIEW.md) | Canonical backend orientation + reference-snapshot notes |
| [docs/BACKEND_TESTS_MODULE.md](docs/BACKEND_TESTS_MODULE.md) | Test module contract and execution rules |
| [docs/GIT_HISTORY.md](docs/GIT_HISTORY.md) | Frontend history and reference-branch context |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Existing known frontend issues; superseded for phase ordering by MASTER_PLAN/PROJECT_STATUS |

---

## Verification

GitHub Actions workflow **`Verify`** runs on pushes/PRs to `main`:

```text
npm ci → typecheck → lint → build
```

A page/feature is not Done until its acceptance criteria, applicable browser/E2E checks, `Verify`, issue checklist and status/docs are all reconciled.

---

## Security notes

- No real credentials/tokens should be committed.
- The frontend `.gitignore` excludes `node_modules`, build output, `.env`, `.env.*.local`, logs and editor-local files. The separate reference backend snapshot has additional ignore rules; do not conflate the two.
- Backend secrets belong to the canonical backend deployment environment/secrets system, not this frontend repository.
- Backend-returned HTML must use the established sanitization path; do not bypass it to fix styling.
