# Git history & branch state

## Canonical repositories and local branches

| Source | Contents | Authority |
|---|---|---|
| `geminiamo0-ship-it/medfront` → `main` | Frontend (`medpark-frontend`) | **Canonical frontend** |
| `geminiamo0-ship-it/medhvgg` → `main` | NestJS backend/API | **Canonical backend** |
| `medfront` → `backend` | Imported backend snapshot (`medpark-backend` v1.0.0) | **Reference only** — separate root history, never deploy/develop from it |

The `medfront/backend` branch was imported from an archive as a root commit and shares no ancestry with frontend `main`. It remains useful for code/doc archaeology and recovering historical product intent, but current API/business truth comes from `medhvgg/main`.

## Frontend commits (`main`, oldest → reconstruction milestone)

| Hash | Message |
|---|---|
| `23905da` | Phase 0: scaffold, API client with response decryption, auth, login vertical slice |
| `17ac4a8` | Theme: Lunar Chalk (dark lunar + moonlight blue) |
| `1afd736` | Theme: Reddit light (white cards, orangered accent, blue links) |
| `580321a` | Phase 1: register, verify-email (OTP), forgot/reset password, complete-profile |
| `3959d2d` | Add animated Hub page + themed logo (Reddit palette) |
| `9521ac5` | Phase 2: app shell (top nav) + real dashboard (steps, performance, curated banks) |
| `69da682` | Library L-A: scoped+recolored CSS, own header, sidebar tree, article reader (React) |
| `edc7a8d` | Library L-B: in-article search + image lightbox/zoom/download |
| `3e59a6a` | Library L-C: highlights + annotation tools |
| `1c78fd3` | Library L-D: notebook drawer + AI summary panel |
| `b8e04f5` | Library L-E: Amboss-style mode and advanced reader interactions |
| `8fdbc9c` | Library: cache/dedupe structure and 423 locked handling |
| `0796c20` | Library: learning-card badge UI |
| `713a4ae` | Library: learning-tip popover behavior |
| `9685421` | Library: restore Create Test button for q-bank sources |
| `4f5ae78` | Library dark mode: preserve colored spans |
| `9325317` | Library dark mode: preserve callout backgrounds |
| `0700f28` | Library cross-reference and key-exam behavior |
| `e4ad1fe` | Library anchor/split behavior fixes |
| `ed8cb0b` | Library condensed/high-yield related fixes |
| `1b148f0` | Library key-exam dark-mode fix |
| `41b1455` | Library High-yield naming/default behavior |
| `ac0ff82` | Library High-yield toggle behavior |
| `89633d8` | Library condensed-hidden behavior |
| `e8bd2b4` | ESLint + react-hooks safety net |
| `db2ac5b` … `8db911d` | Library refactor series extracting coherent components/hooks |
| `6e12813` → `ee49c57` | Reverted fade-based High-yield approach |
| `01bf778` | High-yield hides inline fragments only |
| `0f92f11` | High-yield/list-marker restoration |
| `e781a97` | High-yield span-only fix |
| `710236b` | QBank provider/bank page |
| `e34be2d` | Bank workspace: welcome/create/previous tests |
| `6ed68e6` | Workspace bank resolution fix |
| `f6888a8` | Standard-mode multi-select/counts |
| `f9274cf` | Friendly 423 locked results state |
| `159976e` | Subjects/systems/topics matrix/search |
| `3906ad7` | System gating/select-all/topic merge |
| `34302fc` | Merge duplicate topic names |
| `4d0e469` | Standard/custom UW-ID mode and retrieval |
| `478d3bb` | Heartbeat/ECG loader |
| `9c5d566` | Add broad project documentation set |

After `9c5d566`, governance/bootstrap commits establish the Santo-style operating system. For the exact current commit/phase, use `PROJECT_STATUS.md` and `git log` rather than extending this file on every small change.

## Reference backend import commit

| Hash | Message |
|---|---|
| `9343927` | `chore: import MedPark backend (NestJS) source` — **reference snapshot only** |

## What is intentionally not in frontend git

The frontend `.gitignore` excludes `node_modules`, build output, `.env`, `.env.*.local`, logs and editor-local files.

The reference backend snapshot has additional ignore rules such as coverage/database/local-agent files. Those rules describe that snapshot, not the canonical `medhvgg` repository.

Never commit real credentials. Frontend `VITE_*` values are public browser configuration, not secret storage.

## Working verification commands

```bash
git status -sb
npm run typecheck
npm run lint
npm run build
git log --oneline -10
```

GitHub Actions `Verify` repeats install/typecheck/lint/build on pushes and pull requests to `main`.

## Continuation

Do not use Git history alone to decide what to do next. Read:

1. `PROJECT_STATUS.md`
2. `AGENTS.md`
3. `docs/ENGINEERING_GUARDRAILS.md`
4. `docs/MASTER_PLAN.md`
5. active GitHub issue
