# Frontend architecture

## Folder map

```
src/
├─ api/
│  ├─ client.ts        axios instance, bearer token, response decryption, ApiError
│  ├─ auth.ts          login / register / verify / reset / profile
│  ├─ library.ts       library structure, articles, annotations
│  ├─ notebook.ts      notebook entries
│  ├─ tests.ts         main banks, question banks, counts, subjects, systems, tests
│  └─ users.ts         user profile/preferences
├─ auth/
│  ├─ AuthProvider.tsx     session hydration, login/logout, token storage
│  └─ ProtectedRoute.tsx   route guard
├─ components/
│  ├─ Logo.tsx             ECG-in-circle logo (orange gradient)
│  ├─ PulseLoader.tsx      heartbeat/ECG loading components
│  ├─ hub/TiltCard.tsx     Hub card entrance animation
│  ├─ layout/
│  │  ├─ AppLayout.tsx     top-nav app shell (dashboard, qbank, test…)
│  │  └─ AuthLayout.tsx    split auth shell
│  └─ ui/                  Button, Input, Select
├─ lib/
│  ├─ crypto.ts        AES-256-GCM decryption of API envelopes
│  ├─ token.ts         localStorage token helpers (key: "token")
│  ├─ env.ts           environment access
│  ├─ nav.ts           navigation definitions
│  ├─ sanitize.ts      DOMPurify wrapper for API HTML
│  └─ countries.ts    country list for profile fields
├─ pages/
│  ├─ auth/            Login, Register, VerifyEmail, ForgotPassword, ResetPassword, CompleteProfile
│  ├─ library/         LibraryPage + 13 extracted components + library.css + amboss.ts + utils.ts
│  ├─ qbank/           QbankWorkspace, WelcomePage, CreateTestPage, PreviousTestsPage, bankTheme.ts
│  ├─ Hub.tsx  Dashboard.tsx  QbankPage.tsx  TestPage.tsx  ComingSoon.tsx
├─ router.tsx          createBrowserRouter tree
├─ index.css           Tailwind layers + heartbeat loader keyframes
├─ App.tsx  main.tsx
```

## Routing table (`src/router.tsx`)

| Path | Component | Shell | Auth |
|---|---|---|---|
| `/login` | `auth/Login` | `AuthLayout` | public |
| `/register` | `auth/Register` | `AuthLayout` | public |
| `/verify-email` | `auth/VerifyEmail` | `AuthLayout` | public |
| `/forgot-password` | `auth/ForgotPassword` | `AuthLayout` | public |
| `/reset-password` | `auth/ResetPassword` | `AuthLayout` | public |
| `/hub` | `Hub` | own header | protected |
| `/library` | `library/LibraryPage` | own full-screen header | protected |
| `/complete-profile` | `auth/CompleteProfile` | own layout | protected |
| `/dashboard` | `Dashboard` | `AppLayout` | protected |
| `/contests` | `ComingSoon` | `AppLayout` | protected |
| `/qbank` | `QbankPage` | `AppLayout` | protected |
| `/qbank/:bankId` | `qbank/QbankWorkspace` | `AppLayout` + dark sidebar | protected |
| `/qbank/:bankId` (index) | `qbank/WelcomePage` | — | protected |
| `/qbank/:bankId/create-test` | `qbank/CreateTestPage` | — | protected |
| `/qbank/:bankId/previous-tests` | `qbank/PreviousTestsPage` | — | protected |
| `/test/:testId` | `TestPage` (placeholder) | `AppLayout` | protected |
| `/ai-analyst` | `ComingSoon` | `AppLayout` | protected |
| `/settings` | `ComingSoon` | `AppLayout` | protected |
| `/`, `*` | redirect → `/hub` | — | — |

The workspace uses nested routing: `QbankWorkspace` renders the dark sidebar/topbar and an `<Outlet />`, so `WelcomePage`, `CreateTestPage` and `PreviousTestsPage` receive context via `useOutletContext()` (typed as `WorkspaceContext`).

## API layer

- `src/api/client.ts` builds the axios instance from `VITE_API_URL`, attaches `Authorization: Bearer <token>` from `localStorage.token`, decrypts encrypted envelopes, and normalises failures into `ApiError` (`status` + `payload`). `ApiError` is how pages detect HTTP 423.
- Feature modules export typed helpers; pages should not call `api.*` directly (the test runner is the one place that still does, because it uses ad-hoc endpoints).
- TanStack Query v5 is the data layer: `useQuery` for reads, `useMutation` for writes, query keys shaped as `['resource', ...params]`.

## Data fetching conventions

- Query keys include every parameter that changes the result, e.g. `['test-counts', step, filters]`, `['test-systems', step, filters]`.
- Metadata and creation filters should be **separate** objects: metadata endpoints need bank + subjects (+ difficulty), while creation/counts additionally need the selected `systemIds` / `topicIds`. Sharing one object makes the systems matrix refetch (and shrink) as soon as a system is picked — tracked in [ROADMAP.md](ROADMAP.md).
- Loading states use the shared heartbeat loaders, never ad-hoc spinners.

## Design tokens

Defined in `tailwind.config.js` and `src/index.css` — "Reddit light" palette:

| Token | Value | Use |
|---|---|---|
| `canvas` | `#F6F7F8` | page background |
| `surface` | `#FFFFFF` | cards |
| `surface2` | `#EFF2F3` | subtle fills, skeleton rows |
| `line` | `#E5EBEE` | borders/dividers |
| `ink` | `#1A1A1B` | primary text |
| `ink-soft` / `ink-muted` | derived | secondary/tertiary text |
| `mp` | `#FF4500` | MedPark orange accent (hover `#D93A00`) |
| `link` | `#0079D3` | links |
| `ok` / `bad` | green / red | success / error |

Tailwind Preflight strips list markers and default heading styles, which is why the Library stylesheet re-declares them explicitly.