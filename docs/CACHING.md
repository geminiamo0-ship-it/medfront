# Backend Caching Strategy

This document covers the Redis caching layers introduced to cut Postgres CPU,
RAM, and egress costs by ~80%. It is the primary reference when adding new
queries that touch high-traffic paths.

All cache keys and TTL constants live in
[`src/cache/cache-keys.util.ts`](../src/cache/cache-keys.util.ts) — do not
hard-code them anywhere else.

---

## Why this exists

The May 2 – Jun 2 billing window showed five queries dominating DB load:

| Query | Calls | Total DB time |
|---|---|---|
| Subject/system/topic exclusion-counts (filter availability) | ~10k | ~2,500 sec |
| `app_settings WHERE key = $1` | 1.36 M | 20 sec |
| `topics WHERE isActive` (full 12k rows per call) | 7.6k | 280 sec |
| `question_banks WHERE step = $2` | 16k | 1.8 sec |
| `getQuestionExplanation` (per-question lookups) | 21k | 10 sec |

Three were burning CPU; the rest were burning egress bandwidth. The fixes
below directly address each.

---

## Fix #1 — Filter availability counts

**Endpoint:** `POST /api/tests/counts`
**Method:** [`TestCreationService.getQuestionCounts`](../src/tests/services/test-creation.service.ts)
**Cache key:** `user_performance:{userId}:question_counts:v{epoch}:sub:{0|1}:step:{step}:filters:{hash}`
**TTL:** `FILTER_COUNTS_TTL_MS` = **60 s**
**Was previously:** 10 s, no invalidation, no epoch, no sub segment.

### The cache key has 4 user-scoped segments

- `{epoch}` — a per-user version timestamp. Stored at `user_performance:{userId}:counts_epoch`. Bumping the epoch in one Redis write orphans every variant we've cached for that user.
- `{sub}` — `1` if the user has an active subscription, `0` otherwise. Without this segment, a user whose subscription expires mid-window would keep seeing premium-bank counts they no longer have access to.
- `{step}` — step number from the request.
- `{hash}` — deterministic hash of the filter combination (subjects/systems/topics/banks/difficulty).

### What it caches
The full 8-filter availability object:
```json
{ "all": 500, "unused": 245, "used": 255, "incorrect": 80,
  "correct": 175, "marked": 32, "omitted": 25, "suspended": 18 }
```
All eight counts are cached as one unit. Partial reads are never possible.

### Invalidation hooks
Invalidate via `TestCreationService.invalidateUserCountsCache(userId, step)`
or the inline `invalidateFilterCountsCache` helper in `TestExecutionService`:

| Trigger | Location |
|---|---|
| Test created | `TestCreationService.createTest` |
| Test completed | `TestExecutionService.completeTest` |
| Test suspended | `TestExecutionService.suspendTest` |
| Test resumed | `TestExecutionService.resumeTest` |
| Test deleted | `TestExecutionService.removeTest` |
| Mark / unmark question | `TestExecutionService.toggleMark` |
| Timed-exam auto-expiry | folds into `completeTest` (called from `suspendTest`/`resumeTest` when the time limit lapses) |

### Deliberately NOT invalidated
- **Answer submit** during an in-progress test.
  Submitting writes to `question_submissions` immediately, so the cached
  "unused" / "used" counts can be off by 1 for up to 60 s while a test is
  active. The trade-off is intentional:
  - Test creation itself runs a *fresh* DB query (no cache), so users never
    get a broken or duplicate question set.
  - Invalidating per click would mean a Redis `del` for every answer in tutor
    mode (~25k extra Redis ops/day).

### Risks
- Display lag of up to 60 s in counters on the Create Custom Test page after
  an answer is submitted in another tab. Self-corrects on the next state
  change.

---

## Fix #2 — `app_settings` table

**Service:** [`SettingsService`](../src/settings/settings.service.ts)
**Cache key:** `app_settings:all`
**TTL:** `APP_SETTINGS_TTL_MS` = **12 h**
**Was previously:** per-key cache with 60 s TTL.

### What it caches
The entire `app_settings` table as a `Map<string, string>`, stored in Redis
as an array of `[key, value]` tuples (Maps don't survive JSON serialization).

### Read path
`getString(key, fallback)` and `getNumber(key, fallback)` both read from the
single cached map. A missing key returns `fallback` without any DB hit.

### Invalidation
`setString` / `setNumber` delete `app_settings:all` after every write. The
next read repopulates the cache.

`SettingsService.getAll()` (admin panel listing) intentionally bypasses the
cache so admins always see fresh values right after a save.

### Risks
- If `app_settings:all` is updated outside of `SettingsService` (e.g. a
  database migration or manual `psql` write), stale values can persist for up
  to 12 h. Manual fix: `redis-cli DEL medpark:app_settings:all`.

---

## Fix #3 — Static taxonomy

**Affected methods:**
- [`TestMetadataService.getSystems`](../src/tests/services/test-metadata.service.ts)
- [`TestMetadataService.getSystemsWithTopics`](../src/tests/services/test-metadata.service.ts)
- [`TestMetadataService.getTopics`](../src/tests/services/test-metadata.service.ts) (only the unfiltered call path)
- [`TestMetadataService.getQuestionBanksWithProgress`](../src/tests/services/test-metadata.service.ts) (the bank list portion)
- [`LabValuesService.findAllGroupedByCategory`](../src/lab-values/lab-values.service.ts)

**Cache keys:**
| Key | Cached value |
|---|---|
| `taxonomy:topics:active` | Full `Topic[]` (id, subjectId, systemId, name, description, displayOrder, isActive, createdAt, updatedAt) |
| `taxonomy:systems:active` | Full `System[]` |
| `taxonomy:banks:step:{step}:mainBank:{mainBankId}` | Full `QuestionBank[]` for that step+mainBank combination |
| `taxonomy:lab_values:grouped` | `Record<category, LabValue[]>` |

**TTL:** `TAXONOMY_TTL_MS` = **24 h**

### Why this is safe
These tables are populated by seed scripts and admin imports. They are not
edited at runtime by users. The only write path is admin actions, which
invalidate explicitly.

### Invalidation
| Source | Handler |
|---|---|
| Admin lab-value create/update/delete/bulk | `LabValuesService.invalidateCache` (called from each write method) |
| Admin question CRUD | `AdminQuestionsService.invalidateQuestionCaches` (also evicts bank totals — see Fix #4) |
| Topic / system bulk reload | `TestMetadataService.invalidateTaxonomyCache(scope)` — call from any new admin endpoint that mutates these tables |

If you add a new admin endpoint that writes to `topics`, `systems`,
`question_banks`, or `subjects`, **you must call
`testMetadataService.invalidateTaxonomyCache(...)` after the write**, or
users will see stale taxonomy for up to 24 h.

### Filtered `getTopics(subjectId?, systemId?)`
Only the unfiltered call (`getTopics()` with no args) hits the cache. The
filtered variants stay uncached because the (subject × system) keyspace would
explode and the call volume on filtered paths is far lower.

### Risks
- Up to 24 h staleness for taxonomy changes that bypass the invalidation hooks
  (e.g. a hand-run migration or seed re-import). Manual fix is a single
  `redis-cli DEL` of the affected keys.

---

## Fix #4 — Bank `totalQuestions` static counts

**Method:** [`TestMetadataService.getCachedBankTotals`](../src/tests/services/test-metadata.service.ts)
**Cache key:** `bank:totals:step:{step}:mainBank:{mainBankId}`
**TTL:** `BANK_TOTALS_TTL_MS` = **1 h**

### What it caches
A `Map<bankId, count>` of active-question totals per bank, shared across all
users. Stored in Redis as `Array<[bankId, count]>`.

### Critical: per-user data is NOT cached at this layer
`getQuestionBanksWithProgress` returns each bank with `totalQuestions` (from
this cache) **plus** `usedQuestions` (per-user, queried fresh on every call).
Splitting the layers keeps the user-specific data accurate while still cutting
the expensive total-count `GROUP BY` from ~7,500 calls/month down to ~24
(once per hour per step variant).

### Invalidation
Every admin question CRUD path
(`AdminQuestionsService.create/update/delete`) calls
`invalidateQuestionCaches`, which evicts the unfiltered key plus every step
variant (`step=1`…`step=5`). This is cheap (5 Redis `del`s per write) and
ensures totals are accurate after admin content changes.

If you add a code path that creates/deletes/deactivates questions outside of
`AdminQuestionsService`, you must invalidate `bankTotalsCacheKey(...)` for
every affected step.

### Risks
- A count can be off by 1 for up to 1 h if a question is created outside the
  hooked admin flow. Display-only effect.

---

## Fix #5 — Question explanations

**Endpoint:** `GET /api/tests/:id/questions/:questionId/explanation`
**Method:** [`TestExecutionService.getQuestionExplanation`](../src/tests/services/test-execution.service.ts)
**Cache key:** `question:explanation:{questionId}`
**TTL:** `QUESTION_EXPLANATION_TTL_MS` = **4 h**

### What it caches
The formatted explanation payload returned to the client:
```ts
{
  explanationHtml: string;
  updatedAt: Date;
  options: Array<{
    id: number;
    isCorrect: boolean;
    explanationHtml: string | null;
    uworldChosenBy: number | null;
  }>;
}
```

### Authorization is NOT cached
Test ownership, block-lock, and status checks all run on every request
before the cache lookup. Only the static explanation+option data is served
from cache. There is no way for one user to leak access to another user's
test via this cache.

### Invalidation
`AdminQuestionsService.invalidateQuestionCaches(questionId)` deletes the key
on every question create / update / delete.

### Why 4 h and not 24 h
Explanation HTML is typically 5–50 KB. With ~12k active questions, holding
everything in Redis simultaneously could push 300+ MB. The 4 h TTL lets cold
questions naturally evict so the working set stays bounded. Hot questions
(viewed often) effectively stay cached indefinitely because each view resets
the TTL on next read.

### Risks
- Admin fixes a typo in an explanation → users see the old text for up to 4 h
  if the admin write bypasses `AdminQuestionsService` (none currently do).

---

## Redis-failure tolerance

All cache reads, writes, and invalidations introduced in this work go through
the [`safe-cache.util.ts`](../src/cache/safe-cache.util.ts) wrappers:

```ts
safeCacheGet(cache, key)  // returns undefined on Redis error
safeCacheSet(cache, key, value, ttlMs)  // logs + swallows error
safeCacheDel(cache, key)  // logs + swallows error
```

If Redis is down, slow, or unreachable, every cached endpoint **falls through
to the source of truth (DB) instead of returning 500s to the user**. The site
is slower during a Redis outage but stays alive. Every error is logged once
via `Logger('SafeCache')` so ops can spot a degraded cache.

When adding any new cache call to the caching layer, **always use the safe
wrappers** instead of `cacheManager.get/set/del` directly. The only acceptable
exception is pre-existing code outside the caching work that already has its
own error handling.

## Cache infrastructure

- **Backend:** Redis via `@keyv/redis` + `@nestjs/cache-manager`
  ([`CacheConfigModule`](../src/cache/cache.module.ts)).
- **Production:** Redis is **required** — boot fails without `REDIS_HOST`.
- **Development:** falls back to in-memory Keyv if Redis is unavailable.
- **Namespace:** `REDIS_PREFIX` env var (default `medpark:`). All keys above
  are stored as `medpark:<key>` in Redis.
- **TTL units:** `cacheManager.set(key, value, ttl)` takes **milliseconds**.
  All TTL constants in `cache-keys.util.ts` are already in ms.

### Map serialization gotcha
`Map<K,V>` instances do **not** survive Redis serialization — they come back
as empty objects. When caching a Map, always convert via
`Array.from(map.entries())` on write and `new Map(cached)` on read. See
`getCachedBankTotals` and `getAllSettingsMap` for examples.

---

## Estimated impact

Based on the May 2 – Jun 2 production query stats, expected reduction:

| Resource | Before | After (projected) | Δ |
|---|---|---|---|
| `app_settings` DB calls | 1.36 M / month | ~2.5k / month | -99.8% |
| Topic full-table scans | 7.6k / month (92 M rows) | ~30 / month | -99.6% |
| Bank list queries | 16 k / month | ~60 / month | -99.6% |
| Bank total-count `GROUP BY` | 7.5 k / month (180 sec) | ~120 / month | -98% |
| Filter-availability heavy queries | 10 k / month (2,500 sec) | ~3 k / month (60 s TTL ≫ 10 s) | -70% |
| Question explanation DB hits | 21 k / month | ~3 k / month | -85% |

Expected billing impact: Postgres CPU + RAM + egress should drop to roughly
**40–50%** of the May baseline. Redis usage will grow modestly (≤ 400 MB
working set).

---

## How to add a new cached query

1. Add a key generator + TTL constant to `cache-keys.util.ts`.
2. In your service, inject `CACHE_MANAGER` (already a global module).
3. Read pattern:
   ```ts
   const cached = await this.cacheManager.get<T>(myKey());
   if (cached) return cached;
   const fresh = await /* DB query */;
   await this.cacheManager.set(myKey(), fresh, MY_TTL_MS);
   return fresh;
   ```
4. Identify every write path that could change what's cached, and add
   `this.cacheManager.del(myKey())` to each.
5. Document the cache here. If you don't document it, future invalidation
   bugs are your fault.

---

## Known limitations & accepted risks

These were surfaced during the post-implementation audit. None are blockers,
but every future maintainer should know they exist.

### 1. Bank totals: `mainBankId` variants not actively invalidated
Cache key shape: `bank:totals:step:{step}:mainBank:{mainBankId}`.
On admin question CRUD we evict only `mainBank:all` for each step. Entries
keyed by a specific `mainBankId` (e.g. `step=2, mainBank=42`) expire via the
1h TTL. Display-only impact; actual test creation always queries fresh.

### 2. Filter counts: non-`none` filter hashes self-expire
We evict only `:filters:none` on state changes. Specific filter combos
(`sub:1,2`, `bank:7|sys:3`, etc.) self-expire via the 60s TTL. Documented
in code at `TestCreationService.invalidateUserCountsCache`.

### 3. Settings write → cache invalidation race window
`SettingsService.setString` saves the DB row, then invalidates the cache.
A read sneaking in between those two steps can repopulate the cache with
the OLD value, and that stale value can persist for up to 12h. Admin
setting changes are very infrequent so this is left as an accepted risk.
If maintenance mode toggling ever becomes time-critical, swap the cache
delete to happen BEFORE the DB save (riskier — failed save leaves cache
empty), or shorten the TTL for security-critical keys.

### 4. Tables modified outside admin services bypass invalidation
- `ContestsService.createAndAddQuestion` was fixed to invalidate during the
  audit. Any *new* code that writes to `questions`, `question_options`,
  `topics`, `systems`, `question_banks`, `subjects`, or `lab_values` MUST
  trigger the matching invalidator, or users will see stale data.
- Admin endpoints that mutate taxonomy: call
  `TestMetadataService.invalidateTaxonomyCache(...)` after every write.

### 5. In-memory dev fallback shares object references
Production uses Redis, so every `cacheManager.get` returns a freshly
deserialized object (JSON round-trip via Keyv). The dev in-memory fallback
(no `REDIS_HOST`) can return the same object reference across requests,
which would corrupt the cached payload if a downstream caller mutates the
result. `getQuestionExplanation` already guards against this with a defensive
`JSON.parse(JSON.stringify(...))` deep clone on cache hit, because the
controller watermarks the HTML per-user. Apply the same guard to any
future cached payload that downstream callers mutate.

### 6. Cloudflare Worker compatibility (pre-existing)
`KeyvRedis` opens a raw TCP socket to Redis. Workers historically only
support HTTP, so if the production worker bundle is deployed without an
HTTP-Redis adapter (e.g. Upstash), the cache layer will fail to initialize
there. This is not introduced by these caching changes — verify the
production worker setup uses an HTTP-Redis-compatible store.
