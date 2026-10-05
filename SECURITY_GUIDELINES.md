# Backend Security Guidelines

Conventions established during the May 2026 security audit. Follow these when adding new endpoints, modifying auth, or touching settings/rate limits. Breaking any of these can silently undo a security fix.

---

## 1. Environment variables

### Required in every environment
| Var | Purpose | What happens if missing |
|---|---|---|
| `CORS_ORIGIN` | Comma-separated list of allowed origins | `worker.ts` throws on boot; `main.ts` throws only in prod |
| `JWT_SECRET` | Token signing key | Auth fails |
| `JWT_EXPIRATION` | Token TTL | Required in prod (throws), defaults to `7d` in dev |
| `DB_*`, `REDIS_HOST` | Storage | Boot fails |
| `RESEND_API_KEY` | Email delivery | OTP emails don't send |

### Optional
| Var | Purpose | Default |
|---|---|---|
| `ENABLE_SWAGGER` | Mount `/mrshady/api/docs` in prod | `false` |
| `SWAGGER_USER`, `SWAGGER_PASSWORD` | Basic Auth for Swagger in prod (required when `ENABLE_SWAGGER=true`) | unset |
| `API_PREFIX` | Route prefix | `api` |
| `JWT_ISSUER`, `JWT_AUDIENCE` | JWT claims | `medpark.io`, `api.medpark.io` |

### Removed (do not re-add without re-implementing)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` — Google OAuth was retired. Adding it back requires implementing OAuth `state` CSRF protection (the previous implementation had `state: false`).

---

## 2. Rate limiting — read this BEFORE adding throttling

The throttler architecture has three coupled files that **must stay in sync**:

```
src/rate-limit/rate-limit.constants.ts   ← @Throttle() input
src/rate-limit/rate-limit.config.ts      ← Module-level throttler registration
src/rate-limit/app-throttler.guard.ts    ← Runtime overrides (read from DB)
src/security/security.constants.ts       ← Admin UI defaults
```

### Adding a NEW named throttler bucket

1. **Constants** (`rate-limit.constants.ts`): add the export
   ```ts
   export const NEW_BUCKET_THROTTLE = { new_bucket: { limit: 10, ttl: 60_000, blockDuration: 60_000 } };
   ```
   `ttl` and `blockDuration` MUST be in milliseconds (v6 contract).

2. **Module config** (`rate-limit.config.ts`): register it
   ```ts
   { name: "new_bucket", ttl: 60_000, limit: 10, blockDuration: 60_000 },
   ```
   **If you skip this step, `@Throttle()` is silently a no-op.**

3. **Guard fallback** (`app-throttler.guard.ts`): add an `else if` branch matching the name with `getNumber()` calls and matching defaults.

4. **Admin UI defaults** (`security.constants.ts`): add the `RATE_LIMIT_NEW_BUCKET_*` keys with matching values so the admin Security Settings page shows the right defaults.

All four values must match. If they drift, the admin UI will display one number and the runtime will enforce another.

### Using a named throttler on a route

```ts
import { Throttle } from '@nestjs/throttler';
import { AUTH_THROTTLE } from '../rate-limit/rate-limit.constants';

@Post('something-sensitive')
@Throttle(AUTH_THROTTLE)   // ← 5/min/IP + 10 min block on excess
async sensitive() {}
```

The `AppThrottlerGuard` scopes named throttlers to their decorated routes only. A route without `@Throttle` only gets the `default` bucket (100/min). Do NOT rely on undecorated routes inheriting auth/media/etc. throttling.

### Current limits (per IP unless stated otherwise)

| Bucket | Limit | Window | Block on excess |
|---|---|---|---|
| `default` (every route) | 100 | 60s | 60s |
| `auth` | 5 | 60s | 10 min |
| `public_resource` (read) | 120 | 60s | 60s |
| `public_resource` (write) | 30 | 60s | 60s |
| `media` | 20 | 60s | 5 min |
| `ai_burst` | 10 | 60s | 2 min |
| `test_create` | 10 | 60s | 5 min |
| `library_view` | 30 | 60s | 5 min |
| `job_application` | 3 | 10 min | 30 min |

Exponential backoff (×2) applies to repeated violations, capped at 1 hour.

### Runtime overrides

Every value above can be changed via the admin Security Settings page without redeploying. Settings persist in the DB keyed by `RATE_LIMIT_*`. If you tighten a default in code, also tighten the DB value or admins will see the old loose value as the UI default.

---

## 3. Swagger (`/mrshady/api/docs`)

Three gates:

1. **Localhost-only IP guard** — every environment. Requests from non-loopback IPs get 404. Cloudflare requests carry the real visitor IP in `cf-connecting-ip` (never localhost), so prod is unreachable from the public internet.
2. **Production opt-in** — `ENABLE_SWAGGER=true` required to mount at all.
3. **Basic Auth** — production only, requires `SWAGGER_USER` + `SWAGGER_PASSWORD`. Uses `timingSafeEqual` for comparison.

For prod debugging: SSH to the box, then `curl -u "$SWAGGER_USER:$SWAGGER_PASSWORD" http://localhost:3000/mrshady/api/docs`. Or set up an SSH port-forward.

When updating Swagger: it's also re-bound at the worker boundary — but `worker.ts` never mounts Swagger. Only `main.ts` does.

---

## 4. OTP / verification codes

### Format
- **6 characters** from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0/O/1/I/L`)
- Generated via `crypto.randomInt()` — **never use `Math.random` for any security token**
- Case-insensitive on verify (`normalizeOtpInput` uppercases + trims)
- Stored uppercase in Redis with 10-minute TTL
- 5 wrong attempts burns the OTP

### Adding a new OTP-style code
- Use the same `OTP_CHARSET` and `OTP_LENGTH` constants from `EmailService`
- Reuse `generateOtp()` (private) and `normalizeOtpInput()`
- Store in Redis with a TTL-bounded key
- Always pair with `MAX_OTP_ATTEMPTS` counter to prevent brute force on a single code

### DTO validation
- `@IsString() @Length(6, 6)` — accepts alphanumeric, do NOT add `@IsNumberString()` (that would reject letters and break the new format)
- Update Swagger `description` and `example` to reflect the new format

---

## 5. Validation pipe behavior

```ts
new ValidationPipe({
  whitelist: true,                  // strips unknown fields
  forbidNonWhitelisted: true,       // 400s requests with unknown fields
  transform: true,
  ...
});
```

**Removing a field from a DTO is a breaking change** for clients still sending it. They get HTTP 400 with `"property X should not exist"`.

**Convention:** when removing a field, leave it in the DTO as `@IsOptional()` for ~30 days as a deprecation shim. The handler ignores it. See `UpdateFlagsDto.enableGoogleAuth` for an example. Remove after one full release cycle.

---

## 6. Security headers (Helmet)

Configured in `src/security/helmet.config.ts`. Applied via `applyHelmet(app)` in BOTH `main.ts` and `worker.ts` — do not let them drift.

### Current CSP

| Directive | Value |
|---|---|
| `default-src` | `'self'` |
| `script-src` | `'self'` (no `unsafe-inline`, no `unsafe-eval`) |
| `style-src` | `'self' 'unsafe-inline'` (React style props need this) |
| `img-src` | `'self' data: blob: https:` |
| `font-src` | `'self' data: https:` |
| `media-src` | `'self' https:` |
| `connect-src` | `'self' https:` |
| `frame-ancestors` | `'none'` (clickjacking) |
| `object-src` | `'none'` |

### Other Helmet headers
- HSTS: 1 year, includeSubDomains, preload
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- hidePoweredBy

### Adding a route that serves HTML with inline scripts
- Add the path prefix to `PATHS_WITHOUT_CSP` in `helmet.config.ts`
- This relaxes CSP for that path only — other headers (HSTS, X-Frame-Options, nosniff, etc.) still apply
- Currently Swagger UI is the only entry: `/mrshady/api/docs`

---

## 7. Authentication

### Password hashing
- Use `bcryptjs` with the default cost (10). Already done in the User entity's `@BeforeInsert` / `@BeforeUpdate` hooks.

### JWT
- Issued via `JwtService.sign()` in `AuthService.generateToken()`
- Payload: `{ sub: userId, email, role }`
- Verified via `JwtStrategy`
- Token blocklist on logout: `blocklist:${token}` in Redis with TTL = remaining token lifetime

### Logout
- Backend: `AuthService.logout()` adds to blocklist
- Frontend: must use the context-aware `useUser().logout()`, not the standalone `utils/auth.ts` helper, when the logout is triggered by a button click (SPA navigation). The standalone is fine for hard-redirect paths like the axios 401 interceptor.

### Legacy Google users
- The `User.googleId`, `User.authProvider`, `User.hasLocalPassword` columns are kept for data continuity
- Existing Google-only users (`hasLocalPassword=false`) must use **Forgot Password → reset → log in normally**
- Don't restore the Google OAuth flow without implementing CSRF `state` protection

---

## 8. Open-redirect prevention

When taking a URL from a user (admin settings, redirects, etc.), always validate:

```ts
// Pattern from AdminController.validateMaintenanceRedirectUrl
const parsed = new URL(input);
if (parsed.protocol !== 'https:') throw new BadRequestException(...);
if (!allowedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
  throw new BadRequestException(...);
}
```

Never trust `startsWith('/')` alone — `//evil.com` also starts with `/`. The frontend has equivalent protection in `AdminGatePage`.

---

## 9. Worker vs Main bootstrap

| | `main.ts` | `worker.ts` |
|---|---|---|
| Environment | local dev | Cloudflare Workers prod |
| Helmet | ✓ | ✓ |
| CORS | throws on missing in prod | always throws on missing |
| Validation pipe | ✓ | ✓ |
| Swagger | localhost-gated | never mounted |
| `appPromise` caching | n/a | sticky failure if bootstrap throws |

**When adding new bootstrap-time wiring (middleware, CORS rules, etc.), do it in BOTH files.** Drift between them was the root cause of multiple bugs during the audit.

---

## 10. Encryption interceptor

`src/encryption/encryption.interceptor.ts` wraps every JSON response in `{ enc: true, v: "..." }` using AES-256-GCM with a JWT-derived key. The frontend decrypts via `src/utils/crypto.ts`.

- Don't bypass this for new endpoints — global interceptor.
- Don't add other interceptors that mutate the response body AFTER the encryption interceptor without thinking about whether the wrapper still works.
- Unauthenticated routes (no JWT) skip encryption (no derived key) — that's intentional.

---

## 11. Quick-fire checklist for new endpoints

- [ ] Returns expected status codes (200/201/400/401/403/404 etc.)
- [ ] DTO uses `@IsOptional()` for optional fields and proper validators
- [ ] If state-changing on a public/lightly-protected route: add `@Throttle()` with the right named bucket
- [ ] If admin-only: stacked `@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)` + `@Roles(...)`
- [ ] If accepting a URL: validated with `new URL(...)` + allowlist
- [ ] If accepting HTML: stored sanitized (frontend renders through `safeHtml`)
- [ ] No `Math.random()` for any secret, token, or ID — `crypto.randomInt` / `crypto.randomBytes`
- [ ] Logs don't include password / token / OTP / PII
- [ ] If returning user objects: explicitly select fields, don't leak `passwordHash`
- [ ] If touching `users` table: invalidate `authUserCacheKey(userId)` after writes

---

## 12. Settings service usage

For values you want admins to tune at runtime without a redeploy:

```ts
// Reading (with safe fallback)
const max = await this.settingsService.getNumber('FOO_MAX', 10);

// Writing (with audit trail)
await this.settingsService.setString('FOO_MAX', '20', req.user.email);
```

- Keys are stored as strings in the `settings` table
- The fallback default in code SHOULD match the entry in `security.constants.ts` so the admin UI default matches runtime behavior
- Cache is short-lived; updates propagate within seconds

---

## 13. Cache invalidation rules

| When | Invalidate |
|---|---|
| User updates profile / password | `authUserCacheKey(userId)` |
| Admin edits a question | `static_questions:${id}:content` AND `question_keys:${id}:answer` (use `invalidateQuestionCaches`) |
| Admin updates feature flags | The settings cache (handled by `SettingsService` internally) |
| User completes/fails a test | per-user performance cache keys |

Missing invalidation produced the question-mismatch bug investigated earlier in the audit. When you cache new data, also write the invalidation path.

---

## TL;DR for new contributors

1. **Read `rate-limit.config.ts`, `helmet.config.ts`, `email.service.ts` before touching auth/rate-limit code.**
2. **`@Throttle()` does nothing if the throttler isn't registered in `rate-limit.config.ts`.**
3. **All four rate-limit files must stay in sync.**
4. **Never use `Math.random` for security-relevant values.**
5. **CORS_ORIGIN must be set in prod — the worker won't boot without it.**
6. **Swagger is only reachable from localhost. Don't try to "fix" the 404 you get from a public IP.**
7. **DTO field removals need a 30-day deprecation shim because of `forbidNonWhitelisted`.**
8. **`main.ts` and `worker.ts` must agree on middleware/security config.**
