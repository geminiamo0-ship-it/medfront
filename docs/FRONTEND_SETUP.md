# Frontend setup & conventions

## Requirements

- Node.js 18+ (Vite 6 targets modern Node)
- npm
- A reachable MedPark API (`VITE_API_URL`)

## Install and run

```bash
cd D:\fr
npm install
npm run dev
```

Vite prints the local and network URLs; the dev server log is written to `dev.log`.

Run it detached on Windows:

```powershell
Start-Process cmd.exe -ArgumentList "/c","npm run dev > dev.log 2>&1" -WorkingDirectory "D:\fr" -WindowStyle Hidden
```

## Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `vite` | Dev server with HMR |
| `npm run build` | `tsc --noEmit && vite build` | Typecheck, then production build |
| `npm run preview` | `vite preview` | Serve the built output |
| `npm run typecheck` | `tsc --noEmit` | Types only |
| `npm run lint` | `eslint src` | ESLint (`eslint-plugin-react-hooks` safety net) |

Always run `npm run lint` and `npm run build` before committing.

## Environment files

`.env.development` and `.env.production` both contain only the public API base URL:

```
VITE_API_URL=https://medhvgg-production.up.railway.app/api
```

Do **not** add secrets to any `VITE_*` variable — everything prefixed `VITE_` is bundled into client-side JavaScript and is publicly readable.

## Rules and gotchas

These have caused real bugs; keep them in mind.

1. **Never rewrite source files with PowerShell `Get-Content | Set-Content`.** It has corrupted files in this repo (mojibake in comments). Use the editor tools instead.
2. **Token key is `localStorage.token`** (`src/lib/token.ts`). The historical `mp_token` key is wrong.
3. **Responses may be encrypted.** `src/api/client.ts` handles `{enc:true, v}` payloads via `src/lib/crypto.ts` (AES-256-GCM). Callers always receive plain objects — never parse the envelope yourself.
4. **`mode: "mixed_modes"`, not `"mixed"`.** The backend enum `TestMode.MIXED` is the string `mixed_modes`, and the DTO validates with `@IsEnum(TestMode)`. Any other value is rejected with 400.
5. **HTTP 423 means locked, not broken.** Block banks without completed attempts return 423; render the friendly locked state (see `WelcomePage`) instead of an error box.
6. **High-yield hides, never fades.** The Library toggle must use `display: none` on inline `span.condensed-hidden*` only — never opacity, and never on block wrappers (`ul`, `h2`, `p`, `div.table-wrapper`).
7. **Timed tests need `timeLimitSeconds`.** The API rejects timed creations without it unless the test is a block.
8. **Custom tests need `filters.questionBankIds`.** The API throws `Custom tests require selecting a question bank.` otherwise; custom IDs are also restricted to unused questions and capped at 50.
9. **Tailwind Preflight resets list markers.** The Library CSS re-declares `list-style` for `#acon` and `.amboss-card-body` (`disc`, `decimal`, nested `circle`/`square`) — keep those rules if you touch that stylesheet.
10. **Sanitize any HTML you render.** Article/question/explanation HTML comes from the API and is user-scoped (watermarked); render it through `src/lib/sanitize.ts` (DOMPurify).

## Adding a page

1. Create the component under `src/pages/` (or a subfolder for a feature area).
2. Register the route in `src/router.tsx`; wrap authenticated routes with `protect(...)` / the `AppLayout` children array.
3. Fetch data with TanStack Query and show loading with the shared loaders — see [UI_LOADING_SYSTEM.md](UI_LOADING_SYSTEM.md).
4. Add the API helper to the matching `src/api/*.ts` module rather than calling `api.get` inline.
5. Run `npm run lint && npm run build`.