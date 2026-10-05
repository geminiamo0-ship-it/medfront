# Overview

## What MedPark is

MedPark is a medical question-bank web platform in the Amboss / UWorld mould, built around three pillars:

1. **Library** — a full article reader with exam-oriented tooling (high-yield toggle, highlights, notebook, AI summaries, Amboss-style presentation, dark mode).
2. **QBank** — browse question banks by step and provider, view performance, and build tests (standard multi-mode or custom UW-ID based).
3. **Hub / Dashboard** — entry point and at-a-glance view of banks and usage.

The platform is two deployables: a React single-page app (`main` branch) talking to a NestJS API (`backend` branch) over HTTPS with encrypted payloads.

## Architecture

```
┌──────────────────────────────┐        HTTPS + bearer token        ┌───────────────────────────┐
│  MedPark frontend (main)     │  ───────────────────────────────►  │  MedPark API (backend)    │
│                              │   responses may be AES-256-GCM     │                           │
│  React 18 · Vite · TS        │   encrypted → decrypted in          │  NestJS 10 · TypeORM      │
│  React Router 6              │   src/lib/crypto.ts                 │                           │
│  TanStack Query 5            │                                    │  modules: auth, users,    │
│  Tailwind (Reddit light)     │  ◄───────────────────────────────  │  tests, library, notes,   │
│                              │   JSON (already decrypted)          │  flashcards, contests...  │
└──────────────────────────────┘                                    └────────────┬──────────────┘
                                                                            │
                                                              ┌─────────────┴─────────────┐
                                                              │ PostgreSQL      Redis     │
                                                              │ (TypeORM)       (cache,  │
                                                              │                 throttles)│
                                                              └───────────────────────────┘
```

Communication rules that matter when working on this codebase:

- Auth token is read from **`localStorage.token`** (`src/lib/token.ts`).
- API responses can be `{enc:true, v:"<ciphertext>"}`; `src/api/client.ts` decrypts them before handing data to callers.
- Every route except the public auth pages is wrapped in `ProtectedRoute`.

## Pillar status

| Pillar | Route | State |
|---|---|---|
| Hub | `/hub` | Complete |
| Dashboard | `/dashboard` | Complete |
| Library | `/library` | Feature-complete |
| QBank listing | `/qbank` | Complete |
| Workspace (Welcome / Create Test / Previous Tests) | `/qbank/:bankId/*` | Complete |
| Test runner | `/test/:testId` | Placeholder |
| Contests, AI Analyst, Settings | `/contests`, `/ai-analyst`, `/settings` | Placeholder |

## Glossary

| Term | Meaning |
|---|---|
| **Main bank** | A content provider: UW, Amboss, Mehlman, NBME, CMS, Passmedicine, MedPark 120 |
| **Question bank** | A specific exam set inside a provider (e.g. *UW Step 1*, *NBME 34*, *Self Assessment 13*) |
| **Block** | A fixed, block-style test form (End-Block workflow) |
| **Step** | USMLE step (1 / 2 / 3) — the top-level filter in QBank |
| **Mode** | Question selection criterion (unused, incorrect, marked, omitted, …) |
| **Mixed mode** | A test combining several modes; stored as `mode: "mixed_modes"` + `filters.modes[]` |
| **Custom test** | A test built from an explicit list of question IDs |
| **High-yield** | Condensed exam-focus content in the Library; the toggle hides it |
| **condensed-hidden** | Inline span classes the high-yield toggle hides |
| **423** | HTTP status the API returns for locked/incomplete block-bank data |
| **Watermark** | Per-user inlining the API applies to question/option/explanation HTML |

## Quick reference — live data

**Main banks (step 1):** `1` Amboss · `2` Mehlman · `3` NBME · `4` UWorld · `22` MedPark 120 HY
**Main banks (step 2):** `5` Amboss · `6` CMS · `7` Mehlman · `8` NBME · `9` UWorld

**Question banks:** UWorld Step 1 = `19` (3654 questions) · Self Assessments = `20`, `21`, `22` (160 each, block) · NBME = `3`–`18` (multiple 120/34-question forms)

**Difficulty tiers:** `very_hard` · `hard` · `medium` · `easy` · `very_easy`

**Question modes (backend `TestMode`):** `unused` · `incorrect` · `correct` · `used` · `marked` · `marked_correct` · `marked_incorrect` · `omitted` · `suspended` · `all` · `mixed_modes`

**Test types:** `tutor` · `timed`

## Related documents

- Setup and conventions: [FRONTEND_SETUP.md](FRONTEND_SETUP.md)
- Code layout and routing: [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md)
- Endpoint reference: [API_REFERENCE.md](API_REFERENCE.md)
- Backend service: [BACKEND_OVERVIEW.md](BACKEND_OVERVIEW.md)
- Priorities and known issues: [ROADMAP.md](ROADMAP.md)