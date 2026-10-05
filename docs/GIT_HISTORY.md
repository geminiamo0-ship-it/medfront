# Git history & branch state

## Branches

| Branch | Contents | Remote |
|---|---|---|
| `main` | Frontend (`medpark-frontend`) | `origin` → `https://github.com/geminiamo0-ship-it/medfront.git` |
| `backend` | Backend (`medpark-backend` v1.0.0) | same repo, separate root history (imported as a single commit) |

Because the backend was imported from an archive rather than cloned, `backend` shares no ancestry with `main`. Treat them as two independent trees in one repository.

## Frontend commits (`main`, oldest → newest)

| Hash | Message |
|---|---|
| `23905da` | Phase 0: scaffold, API client with response decryption, auth, login vertical slice |
| `17ac4a8` | Theme: Lunar Chalk (dark lunar + moonlight blue) |
| `1afd736` | Theme: Reddit light (white cards, orangered accent, blue links) |
| `580321a` | Phase 1: register, verify-email (OTP), forgot/reset password, complete-profile |
| `3959d2d` | Add animated Hub page + themed logo (Reddit palette) |
| `9521ac5` | Phase 2: app shell (top nav) + real dashboard (steps, performance, curated banks) |
| `69da682` | Library L-A: scoped+recolored CSS, own header, sidebar tree, article reader (React) |
| `edc7a8d` | Library L-B: in-article search (highlight + navigate) + image lightbox/zoom/download |
| `3e59a6a` | Library L-C: highlights + annotation tools (pencil/highlighter/eraser/laser, undo/redo) as a React hook |
| `1c78fd3` | Library L-D: notebook drawer (resizable, rich text, insert-article, PDF) + AI summary panel |
| `b8e04f5` | Library L-E: Amboss mode (cards, key-exam/toggle-all, term popovers, image viewer + hover card, split screen, dark-mode content stripping); fix article scroll |
| `8fdbc9c` | Library: cache+dedupe structure per source (TanStack Query) and handle 423 lock with retry |
| `0796c20` | Library: replace learning-tip emoji with 16×16 learning-card SVG badge (click → popover) |
| `713a4ae` | Library: learning tips open as popover (inline box hidden) + shrink tip icon |
| `9685421` | Library: restore Create Test button for q-bank sources |
| `4f5ae78` | Library dark mode: preserve colored spans and make key-exam highlights readable |
| `9325317` | Library dark mode: stop the broad `*:not(mark)` rule from wiping callout backgrounds |
| `0700f28` | Library: key-exam mode cancels native text colors; cross-ref navigation jumps to anchor without refetching |
| `e4ad1fe` | Library: fix anchor accuracy + Split always splits and jumps |
| `ed8cb0b` | Library: Condensed toggle button; fix key-exam popover-term text; fix anchor target selector |
| `1b148f0` | Library: fix key-exam dark mode |
| `41b1455` | Library: condensed content shown by default; rename toggle to "High-yield on/off" |
| `ac0ff82` | Library: High-yield button only toggles condensed visibility |
| `89633d8` | Library: high-yield hides only `.condensed-hidden*` extras |
| `e8bd2b4` | Phase 0: ESLint + react-hooks safety net; fix use-before-declare and missing dep |
| `db2ac5b` … `8db911d` | Library refactor series: extract `utils`, `CategoryNode`, `Toast`, `Lightbox`, `AmbossImageViewer`, `ImageHoverCard`, `AmbossPopover`, `AiSummaryPanel`, `SplitPane`, `AmbossToolbar`, `LibrarySidebar`, `LibraryNavbar`, `NotebookDrawer` (1925 → 1146 lines) |
| `6e12813` → `ee49c57` | Reverted: fade-based high-yield (requirement is `display:none`, not opacity) |
| `01bf778` | Library: high-yield toggle only hides inline fragments, never sections/tables/mnemonics |
| `0f92f11` | Library: match original high-yield rules + restore list markers |
| `e781a97` | Library: high-yield hides only inline spans, never section wrappers |
| `710236b` | QBank: bank-provider page listing all question banks underneath with progress |
| `e34be2d` | QBank: bank workspace with welcome stats, create test, previous tests |
| `6ed68e6` | QBank: resolve workspace bank from question-banks, not main banks |
| `f6888a8` | QBank: UWorld-style standard mode multi-select with availability and difficulty counts |
| `f9274cf` | QBank: friendly locked-results state for incomplete block banks (HTTP 423) |
| `159976e` | QBank: subjects/systems matrix, expandable topics with counts, global topic search |
| `3906ad7` | QBank: systems gated by subjects, select-all headers, merged duplicate topic names |
| `34302fc` | QBank: merge same-named topics inside expanded system topic lists |
| `4d0e469` | QBank: standard/custom question mode with UW ID custom tests and test retrieval |
| `478d3bb` | UI: heartbeat logo loader with ECG sweep on all page sections |

## Backend commit

| Hash | Message |
|---|---|
| `9343927` | chore: import MedPark backend (NestJS) source |

## What is intentionally not in git

`.gitignore` (frontend) excludes `node_modules`, `dist`, `dist-ssr`, `.env`, `.env.*.local`, `*.log`, `.vscode/*`, `.idea`, `*.local`.

The backend branch additionally ignores `coverage`, `*.db`, and `.claude/settings.local.json`. Excluded on purpose:

| Excluded | Why |
|---|---|
| `.env` / real secrets | Never commit credentials. Only `.env.example` is tracked. |
| `dist/` | Build output (frontend and backend) |
| `node_modules/` | Dependencies |
| `my_course_bank.db` (24 MB) | Large SQLite data file; kept out of history |
| `.claude/settings.local.json` | Machine-local permission allowlists |
| `*.log` | Local dev logs (`dev.log`) |

## Working commands

```bash
git status -sb                        # current branch + sync state
git log --oneline -10                 # recent history
npm run lint && npm run build         # before every commit
git push origin main                  # publish
```

The dev server runs detached on Windows:

```powershell
Start-Process cmd.exe -ArgumentList "/c","npm run dev > dev.log 2>&1" -WorkingDirectory "D:\fr" -WindowStyle Hidden
```