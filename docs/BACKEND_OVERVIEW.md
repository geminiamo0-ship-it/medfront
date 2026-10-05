# Backend overview

Source lives on the **`backend`** branch of `geminiamo0-ship-it/medfront` (`medpark-backend` v1.0.0). This document describes that service; the frontend docs live on `main`.

## Stack

NestJS 10 · TypeORM 0.3 · PostgreSQL (`pg`) · Passport (JWT + local) · Redis (`ioredis`, `@keyv/redis`, `cache-manager`) · `@nestjs/throttler` (rate limiting) · `@nestjs/schedule` · `@nestjs/swagger` · Helmet · `class-validator` / `class-transformer` · `bcryptjs` · Resend (email) · OpenAI SDK + `@google/genai` (AI) · `geoip-lite` · `jszip` · `sqlite3` (import tooling) · `esbuild` + `wrangler` (Cloudflare Worker build)

## Modules

`activity` · `admin` · `affiliate` · `auth` · `cache` · `careers` · `contests` · `database` · `email` · `encryption` · `filters` · `finance` · `flashcards` · `health` · `integrations` · `lab-values` · `library` · `media` · `messages` · `notes` · `notebook` · `rate-limit` · `revision` · `scripts` · `security` · `settings` · `subscriptions` · `support` · `tests` · `tickets` · `users` · `utils`

Plus `src/entities/` (data model) and `src/migrations/` (~90 TypeORM migrations).

Cross-cutting subsystems: response-encryption interceptor, security guards (IP block, quotas, watermark, content-security), Helmet + CSP, Redis caching with a safe-cache wrapper, geoip activity logging, analytics snapshots/daily stats, wallets/ledger/payroll/finance, subscriptions and manual payments, contests, jobs & careers, tickets/support, notifications, admin tooling (gate, expenses, coupons, badges, notes).

## npm scripts

| Group | Scripts |
|---|---|
| Run | `start`, `start:dev`, `start:debug`, `start:prod`, `dev:worker`, `deploy` |
| Quality | `build`, `lint`, `format`, `test`, `test:watch`, `test:cov`, `test:debug`, `test:e2e` |
| DB | `typeorm`, `migration:run`, `migration:run:dev`, `migration:revert`, `migration:revert:dev`, `migration:generate`, `migration:create`, `migration:show`, `db:reset` |
| Seed | `seed`, `seed:profiles`, `seed:uworld-s1-order` |
| Import | `import:all`, `import:all:step1`, `import:all:step2`, `import:all:step3`, `import:step1`, `import:step2`, `import:step3`, `import:library-articles`, `import:amboss-library`, `import:pastest-library`, `import:pastest-library-2`, `import:passmedicine-library`, `import:passmed-library-part2`, `import:passmed-diagram-library`, `import:passmed-index-library`, `import:one-exam-library`, `import:mrcp1`, `import:mrcp2`, `import:question-groupings` |
| Maintenance | `list:question-banks`, `verify:question-groupings`, `gen:question-groupings-bank-map`, `cleanup:untouched-block-tests`, `health:watch` |

## Environment

Copy `.env.example` → `.env`. Key groups:

| Group | Keys |
|---|---|
| Core | `NODE_ENV`, `PORT`, `API_PREFIX`, `FRONTEND_URL`, `CORS_ORIGIN` |
| Database | `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SSL` |
| Auth | `JWT_SECRET`, `JWT_EXPIRATION`, `ADMIN_GATE_SECRET` |
| Rate limits | `RATE_LIMIT_BLOCK_DURATION`, `RATE_LIMIT_BACKOFF_*`, `AUTH_RATE_LIMIT_*`, `PUBLIC_RESOURCE_*`, `TEST_CREATE_*`, `MEDIA_*`, `AI_BURST_*`, `JOB_APPLICATION_*`, `CONTEST_RATE_LIMIT_MAX` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_PREFIX`, `REDIS_TTL` |
| OAuth | `GOOGLE_CALLBACK_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, `TELEGRAM_MONITOR_BOT_TOKEN`, `TELEGRAM_MONITOR_CHAT_ID` |
| Email | `RESEND_API_KEY`, `FROM_EMAIL` |
| Library | `LIBRARY_CACHE_WARM`, `LIBRARY_CACHE_WARM_SOURCE` |
| **Encryption** | `RESPONSE_ENCRYPTION_KEY` — must match the frontend's key or payloads cannot be read |

## Cloudflare Worker deployment

`wrangler.toml` (name `mdpark-back`, entry `dist/_worker.mjs`, `nodejs_compat`) contains **non-secret** `[vars]` only: `NODE_ENV`, `API_PREFIX`, `DB_PORT=26257`, `DB_SSL_MODE=verify-full`, `JWT_EXPIRATION=7d`, `CORS_ORIGIN`, rate limits, `TELEGRAM_MONITOR_CHAT_ID`. Real secrets (`DB_PASSWORD`, `JWT_SECRET`, `REDIS_PASSWORD`, `TELEGRAM_*_TOKEN`) are injected with `npx wrangler secret put <NAME>`.

## Documentation shipped with the backend

`README.md` · `QUICK_START.md` · `DATABASE_ARCHITECTURE.md` · `DATABASE_SETUP.md` · `SECURITY_AUDIT_REPORT.md` · `SECURITY_GUIDELINES.md` · `TEST_CREATION_API.md` · `FRONTEND_INTEGRATION.md` · `FRONTEND_REGISTRATION_GUIDE.md` · `FRONTEND_UPDATED.md` · `BACKEND_ROADMAP.md` · `BACKLOG_TEST_FEATURES.md` · `BEHAVIORAL_ANALYTICS_GUIDE.md` · `ENTITIES_COMPLETE_SUMMARY.md` · `SEEDING_GUIDE.md` · `SEEDING_PROFILES.md` · `NAVIGATION_ENHANCEMENTS.md` · `PASSMEDICINE_DEPLOYMENT.md` · `docs/ANALYTICS-DATA-SOURCES.md` · `docs/CACHING.md` · `docs/DATABASE-POOL.md` · `MedPark-API.postman_collection.json`

For the question/test engine specifically, see [BACKEND_TESTS_MODULE.md](BACKEND_TESTS_MODULE.md).