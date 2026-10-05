# MedPark

Medical question-bank platform (Amboss / UWorld style) — a React frontend and a NestJS backend.

| Branch | Contents |
|---|---|
| **`main`** | MedPark **frontend** — React 18 + Vite 6 + TypeScript + Tailwind (`medpark-frontend`) |
| **`backend`** | MedPark **backend** — NestJS 10 + TypeORM + PostgreSQL (`medpark-backend` v1.0.0) |

The two branches have **separate root histories**. `main` holds the web client; `backend` holds the API service.

---

## Status

| Area | Route | Status |
|---|---|---|
| Hub | `/hub` | Done |
| Dashboard | `/dashboard` | Done |
| Library | `/library` | Feature-complete (reader, highlights, notebook, AI summary, Amboss mode, dark mode) |
| QBank listing | `/qbank` | Done (step → provider → banks underneath) |
| Bank workspace | `/qbank/:bankId` | Done (Welcome stats, Create Test, Previous Tests) |
| Create Test | `/qbank/:bankId/create-test` | Done (Standard + Custom question modes) |
| Test runner | `/test/:testId` | **Placeholder** — runner planned, see [docs/ROADMAP.md](docs/ROADMAP.md) |
| Contests / AI Analyst / Settings | `/contests`, `/ai-analyst`, `/settings` | Placeholder (`ComingSoon`) |

---

## Quick start (frontend)

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # tsc --noEmit && vite build
npm run lint       # eslint src
npm run typecheck  # tsc --noEmit
npm run preview    # serve the production build
```

### Environment

`.env.development` / `.env.production`:

```
VITE_API_URL=https://medhvgg-production.up.railway.app/api
```

API responses may arrive AES-256-GCM encrypted (`{enc:true,v:"..."}`) and are decrypted transparently in `src/lib/crypto.ts`. The auth token lives in `localStorage.token`.

### Backend

See [docs/BACKEND_OVERVIEW.md](docs/BACKEND_OVERVIEW.md) for env keys, npm scripts, migrations, seeding and Cloudflare Worker notes.

---

## Documentation

| Document | Contents |
|---|---|
| [docs/OVERVIEW.md](docs/OVERVIEW.md) | Product scope, architecture, glossary, quick-reference IDs |
| [docs/FRONTEND_SETUP.md](docs/FRONTEND_SETUP.md) | Install/run/build, environment, dev rules and gotchas |
| [docs/FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md) | Folder map, routing table, API layer, theme tokens |
| [docs/FEATURES_AUTH_HUB_DASHBOARD.md](docs/FEATURES_AUTH_HUB_DASHBOARD.md) | Auth flows, Hub, Dashboard |
| [docs/FEATURES_QBANK.md](docs/FEATURES_QBANK.md) | Step → provider → banks, workspace, Welcome, Previous Tests |
| [docs/FEATURES_CREATE_TEST.md](docs/FEATURES_CREATE_TEST.md) | Standard + Custom modes, payload contract, subjects/systems/topics |
| [docs/FEATURES_LIBRARY.md](docs/FEATURES_LIBRARY.md) | Reader phases, components, high-yield rules, dark mode |
| [docs/UI_LOADING_SYSTEM.md](docs/UI_LOADING_SYSTEM.md) | Heartbeat/ECG loader components and keyframes |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | Every `/tests*` endpoint, types, live bank data |
| [docs/BACKEND_OVERVIEW.md](docs/BACKEND_OVERVIEW.md) | NestJS modules, entities, scripts, env, deployment |
| [docs/BACKEND_TESTS_MODULE.md](docs/BACKEND_TESTS_MODULE.md) | Test module contract, `TestMode` enum, creation/execution rules |
| [docs/GIT_HISTORY.md](docs/GIT_HISTORY.md) | Commit history, branch state, what is excluded from git |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Known issues, priorities, verification log |

---

## Security notes

- No credentials, tokens or secrets are stored in this repository. Only `.env.example`-style templates and the public API base URL are committed.
- `.gitignore` excludes `node_modules`, `dist`, `.env*`, `*.log`, `coverage`, and `*.db` data files.
- Backend secrets (`DB_PASSWORD`, `JWT_SECRET`, `REDIS_PASSWORD`, `RESPONSE_ENCRYPTION_KEY`, provider API keys) are provided through environment variables or `wrangler secret put` — never in `wrangler.toml`.