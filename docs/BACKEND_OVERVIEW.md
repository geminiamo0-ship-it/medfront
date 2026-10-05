# Backend Overview

## Canonical source

The **canonical/live MedPark backend** is:

```text
geminiamo0-ship-it/medhvgg
branch: main
```

The `backend` branch inside this `medfront` repository is a **reference-only imported snapshot** with a separate root history. It is useful for historical docs/code archaeology, but it must not be developed, deployed or treated as the source of current API truth.

When a frontend task depends on backend behavior, inspect current `medhvgg/main` controller/DTO/service/entity code.

## Stack

The current canonical backend uses NestJS 10, TypeORM 0.3, PostgreSQL (`pg`), JWT/Passport, Redis/cache infrastructure, Nest throttling/scheduling, Swagger, Helmet/security middleware, validation/transformation, email/AI integrations, import tooling, and deployment/build tooling including Cloudflare-related scripts.

## Architecture/modules

The canonical backend tree currently contains mature domain areas including:

- auth;
- users;
- tests/QBank/exam execution;
- library;
- notebook and question notes;
- flashcards;
- revision;
- contests;
- subscriptions/pricing/manual payments;
- messages;
- tickets/support;
- affiliate/coupons;
- careers;
- lab values/media;
- admin;
- finance;
- activity;
- settings;
- security/rate limit;
- health/database monitoring;
- encryption/caching/integrations;
- entities/migrations/import scripts.

`src/app.module.ts` wires global application concerns including throttling/roles/security guards and interceptors such as maintenance/encryption behavior. `src/main.ts` applies production bootstrap concerns such as environment validation, Helmet/CSP, CORS, global validation and API prefixing.

For a product-oriented map, see [`BACKEND_CAPABILITY_MAP.md`](BACKEND_CAPABILITY_MAP.md).

## Exam/test engine

`src/tests/` is a mature, multi-service domain rather than a CRUD controller. It separates responsibilities such as:

- creation and question selection;
- execution/submission/lifecycle;
- retrieval;
- metadata;
- analytics;
- analytics aggregation;
- AI explanations;
- block generation;
- question search;
- access/security handling.

The frontend should orchestrate this contract rather than recreate correctness, scoring, filtering, completion or result-locking rules.

See [`BACKEND_TESTS_MODULE.md`](BACKEND_TESTS_MODULE.md) plus current canonical backend code before Runner implementation.

## Database and migrations

The backend uses TypeORM/PostgreSQL with an extensive migration history. Backend schema/business changes belong in the backend repository and must use migrations rather than frontend workarounds or schema synchronization shortcuts.

The historical reference snapshot also contains database/caching/pooling/analytics docs that can be valuable context, but current `medhvgg/main` code remains authoritative when they disagree.

## Security/access

Current backend infrastructure includes authentication/role guards, throttling/rate limits, content-security checks, quotas, protected-content watermarking, response encryption and operational security/monitoring modules.

Frontend implications:
- do not infer access/entitlement as authority;
- preserve backend response/status semantics;
- do not strip watermarks;
- sanitize HTML client-side through the established path;
- treat old audit findings as items to re-test, not guaranteed present-day vulnerabilities.

## Reference snapshot documentation

The `medfront/backend` branch contains many useful historical documents such as older setup/roadmap/security/entity/import/deployment notes and newer operational notes around analytics, caching and database pools.

Use them for:
- discovering intended historical behavior;
- understanding old frontend features;
- identifying risks to re-check;
- recovering product intent.

Do **not** use them to override current canonical backend code.

## Frontend integration rule

For every active page:

1. inspect the exact current backend contract in `medhvgg/main`;
2. record required endpoints and authoritative rules in the page spec;
3. add typed frontend API helpers;
4. implement presentation/orchestration only;
5. verify real access/error/lifecycle behavior where applicable;
6. update API/page docs if the verified contract differs from existing documentation.
