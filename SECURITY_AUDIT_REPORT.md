# MedPark Backend Security Audit

**Date:** 2026-03-15
**Scope:** `C:\Users\shady\OneDrive\Desktop\MedPark\MedPark-Backend` (NestJS + TypeORM)
**Method:** Static code review + `npm audit` (no dynamic testing or infra review)

## Executive Summary
This audit identified multiple high-risk issues (access control and SSRF), several medium-risk platform gaps (CORS, rate limiting, logging, OAuth hardening, token handling, HTML sanitization), and a sizable dependency risk surface. The most critical items are a support-ticket IDOR and SSRF in flashcard export.

## High
1. **Support tickets IDOR (read and write by any authenticated user)**
   - **Impact:** Any logged-in user can read other users’ tickets and post messages into them.
   - **Evidence:** `src/tickets/tickets.controller.ts`, `src/tickets/tickets.service.ts` (`findOne` and `addMessage` do not enforce ownership).
   - **Fix:** Enforce `userId` on `findOne` and `addMessage`, or split user/admin routes and require admin role for cross-user access.

2. **Server-side request forgery (SSRF) in flashcard export**
   - **Impact:** Server fetches arbitrary external URLs provided in flashcard content during Anki export.
   - **Evidence:** `src/flashcards/flashcards.service.ts` (`normalizeMediaSource` accepts any `http(s)` URL; `ensureAnkiMediaAsset` fetches it server-side).
   - **Fix:** Allowlist domains (prefer your storage), block private IP ranges and metadata IPs, enforce timeouts + max size, or strip remote images on export.

3. **Database TLS verification effectively disabled + env mismatch**
   - **Impact:** TLS verification can be bypassed; SSL may be off unintentionally due to env mismatch.
   - **Evidence:** `src/app.module.ts` (`DB_SSL_MODE === "verify-full"` but `rejectUnauthorized: false`); `.env.example` documents `DB_SSL` while code uses `DB_SSL_MODE`.
   - **Fix:** Align env vars and set `rejectUnauthorized: true` with proper CA bundle.

## Medium
1. **CORS allows wildcard + credentials**
   - **Impact:** Overly permissive CORS may expose authenticated APIs.
   - **Evidence:** `src/main.ts`, `src/worker.ts` (`origin` becomes `'*'` if `CORS_ORIGIN` is unset, while `credentials: true`).
   - **Fix:** Require explicit allowlist in production; reject `*` when credentials are enabled.

2. **No global rate limiting / brute-force protection**
   - **Impact:** Auth and heavy endpoints are vulnerable to brute force and abuse.
   - **Evidence:** No throttler in `src/main.ts`; rate limit envs exist in `.env.example` but unused.
   - **Fix:** Add `@nestjs/throttler` with stricter limits for auth/media/AI endpoints.

3. **Sensitive request data logged on errors**
   - **Impact:** Possible leakage of passwords, tokens, and PII in logs.
   - **Evidence:** `src/filters/all-exceptions.filter.ts` logs full request `body`, `params`, `query`, and `user`.
   - **Fix:** Redact sensitive fields and avoid full body logging, especially for auth routes.

4. **OAuth CSRF protection disabled + token leakage risk**
   - **Impact:** OAuth flow lacks `state`, and JWT is placed in URL query string (leaks via logs/referrer/history).
   - **Evidence:** `src/auth/strategies/google.strategy.ts` (`state: false`), `src/auth/auth.controller.ts` (redirect includes token).
   - **Fix:** Enable `state` and use httpOnly cookie or a short-lived code exchange instead of query token.

5. **Swagger exposed in all environments**
   - **Impact:** API surface discovery in production.
   - **Evidence:** `src/main.ts` always sets up Swagger.
   - **Fix:** Limit to dev or protect behind admin auth/IP allowlist.

6. **Untrusted HTML not sanitized**
   - **Impact:** Potential stored XSS in clients if content is compromised or user-generated.
   - **Evidence:** `src/tests/services/test-retrieval.service.ts`, `src/tests/services/test-execution.service.ts`, `src/library/library.service.ts` return HTML directly.
   - **Fix:** Sanitize HTML on ingestion or at render time with allowlisted tags/attrs.

7. **Large payload limits with no safeguards**
   - **Impact:** Increased DoS risk.
   - **Evidence:** `src/main.ts` sets 50mb JSON; worker has no explicit limit.
   - **Fix:** Lower limits, set per-route limits, add rate limiting.

## Low
1. **Unauthenticated media proxy can be abused for bandwidth**
   - **Impact:** Public endpoint could be used for bandwidth abuse.
   - **Evidence:** `src/media/media-proxy.controller.ts`.
   - **Fix:** Add auth or rate limiting.

## Dependency Audit (`npm audit`)
**Run date:** 2026-03-15
**Summary:** 43 vulnerabilities total — 26 high, 10 moderate, 7 low, 0 critical.

Key runtime findings:
- `@nestjs/core` — High
- `@nestjs/platform-express` — High (transitive `multer` DoS)
- `@nestjs/swagger` — High (`lodash`/`js-yaml`)
- `@nestjs/typeorm` — High
- `@nestjs/common` — Moderate (`file-type`)
- `sqlite3` — High

Tooling/dev dependencies include additional high/moderate findings (e.g., `@nestjs/cli`, `wrangler`).

**Recommendation:** Plan a dependency upgrade cycle with a focus on runtime dependencies first; many fixes are semver-major and require regression testing.

## Recommended Next Steps (Priority)
1. Fix ticket ownership checks (IDOR).
2. Lock down SSRF paths in flashcard export.
3. Correct DB TLS configuration + env mismatch.
4. Add rate limiting + redact sensitive logging.
5. Harden OAuth (`state`, avoid token in URL).
6. Gate Swagger in prod; sanitize HTML content.
7. Schedule dependency upgrades based on audit.
