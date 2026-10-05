# Features — Auth, Hub, Dashboard

## Authentication

| Page | Route | Purpose |
|---|---|---|
| Login | `/login` | Email + password sign-in; stores the token in `localStorage.token` |
| Register | `/register` | Account creation |
| Verify email | `/verify-email` | OTP code confirmation |
| Forgot password | `/forgot-password` | Request a reset code/link |
| Reset password | `/reset-password` | Set a new password |
| Complete profile | `/complete-profile` | Onboarding after registration (nickname/medical school/country etc., via `src/lib/countries.ts`) |

Architecture:

- `src/auth/AuthProvider.tsx` owns session state: it hydrates from the stored token on boot, exposes `login`, `register`, `logout`, and the current user.
- `src/auth/ProtectedRoute.tsx` gates children; `src/router.tsx` wraps every non-auth route with it.
- Requests are authenticated by axios interceptor in `src/api/client.ts` using the stored token.
- The API also supports Google OAuth (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` backend-side); the frontend login page is email/password first.

## Hub (`/hub`)

Entry landing page with its own header (outside `AppLayout`). Cards animate in via `src/components/hub/TiltCard.tsx`, and the page reuses the themed logo. `/` and any unknown path redirect here.

## Dashboard (`/dashboard`)

Inside `AppLayout`. Contains:

- **Step selector** (Step 1 / 2 / 3) driving the bank queries.
- **Performance overview** — summary tiles fed by `getPerformanceOverview(step)`.
- **Curated banks grid** — cards from `getMainBanks(step)` showing name, code, question counts and description.
- Banks list loading uses the shared heartbeat loader (`SectionLoader`), so the rest of the page renders immediately.

Clicking a bank routes into `/qbank/:bankId?step=N`; see [FEATURES_QBANK.md](FEATURES_QBANK.md).