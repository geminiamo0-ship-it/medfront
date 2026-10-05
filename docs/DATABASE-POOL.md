# Database Connection Pool — Configuration & Monitoring

This document is the single source of truth for the Postgres connection pool
in the MedPark backend. Anyone editing pool settings, alert thresholds, or
the monitoring layer should read this first and update it after.

It covers:

1. [Current configuration](#1-current-configuration) — every value and why
2. [Monitoring](#2-monitoring) — what's watched, where alerts go
3. [Alert thresholds](#3-alert-thresholds) — the tiered system and tuning
4. [Scaling triggers](#4-scaling-triggers) — when to bump `max`, when to add instances
5. [Runbook](#5-runbook) — what to do when each alert fires
6. [How to safely change pool settings](#6-how-to-safely-change-pool-settings)

---

## 1. Current configuration

All pool settings live in
[`src/app.module.ts`](../src/app.module.ts), inside the `TypeOrmModule.forRootAsync`
factory's `extra` block. Reproducing them here so this doc is self-contained:

```ts
extra: {
  max: 25,
  min: 2,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000,
}
```

### Why each value

| Setting | Value | Rationale |
|---|---|---|
| `max` | **25** | Prod Postgres `max_connections = 100`. 25/instance allows 2 backend instances (50) + admin tooling + migrations + replication slots while still leaving the DB room to breathe. Was 10, which capped sustained throughput at ~10-15 RPS. |
| `min` | **2** | Keep two warm connections idle so the first request after a quiet period doesn't pay the 50-100ms TCP+TLS handshake cost. Was 0, which caused noticeable latency on the first request post-idle. |
| `idleTimeoutMillis` | **30 s** | Close connections that have been idle this long. 30s is the pg-pool default; longer wastes connection slots on the Postgres side, shorter just creates more reconnects with no benefit. |
| `connectionTimeoutMillis` | **10 s** | Wait up to 10s for a free pool slot before failing the request. Was 5s — too tight, would fail legitimate requests during brief saturation bursts and could break migrations running alongside live traffic. |
| `statement_timeout` | **30 s** | Postgres-level kill switch for runaway queries. Any single statement (analytics scan, missing-index full table scan) running longer than this is terminated by Postgres, freeing the pool slot. Without this, one slow query could lock up a slot indefinitely. |

### The three-layer timeout cascade

The timeouts above are deliberately ordered so each layer protects the next:

```
1. connectionTimeoutMillis   10 s   "fail fast if pool is genuinely stuck"
2. statement_timeout          30 s   "kill genuinely runaway queries"
3. user patience             ~60 s+  "tab close, refresh"
```

If you change one, **check all three are still consistent**:
- `connection wait < query execution < user perception`
- If you bump `statement_timeout` to 90 s, also bump `connectionTimeoutMillis`
  proportionally, otherwise requests fail at the pool stage before queries
  even get a chance to run.

---

## 2. Monitoring

The monitoring layer has three pieces:

### 2.1 [`TypeOrmTimeoutLogger`](../src/health/typeorm-timeout-logger.ts)

A custom TypeORM logger registered at app bootstrap. It implements the
TypeORM `Logger` interface and intercepts every query error. When it sees
SQLSTATE `57014` (PostgreSQL's `query_canceled`, fired by `statement_timeout`),
it increments an in-memory counter. The monitor cron reads and resets that
counter every 30 s to compute a rolling per-minute rate.

- **Cost:** zero on healthy queries (`logQuery` is a no-op). On errors,
  a single integer increment.
- **Coverage:** sees every query that goes through TypeORM, including raw
  `dataSource.query()`, `queryRunner.query()` in transactions, and background
  cron jobs. Migrations are not counted as alert-worthy (intentional).
- **Singleton:** exported as `typeOrmTimeoutLogger` from
  [`src/health/typeorm-timeout-logger.ts`](../src/health/typeorm-timeout-logger.ts)
  and imported by both `app.module.ts` (to register on TypeORM) and the
  monitor service (to snapshot+reset).

### 2.2 [`DatabaseMonitorService`](../src/health/database-monitor.service.ts)

A `@Cron(EVERY_30_SECONDS)` service in production only. Each tick:

1. Reads pool stats via
   `dataSource.driver.master.{totalCount, idleCount, waitingCount}` — these
   are in-memory JS counters on node-postgres, so **the monitor never issues
   a query**. It cannot itself contribute to load.
2. Reads + resets the timeout counter from the logger.
3. Compares both against thresholds and fires Telegram alerts when breached.

The monitor is **read-only against the database**. If the pool is 100%
saturated and 50 requests are queued, the monitor still ticks normally
because it doesn't ask for a connection.

### 2.3 `GET /api/health/pool` admin endpoint

Admin-only. Returns the current pool snapshot for ad-hoc inspection without
waiting for the next cron tick:

```bash
curl https://api.medpark.io/api/health/pool \
  -H "Authorization: Bearer $ADMIN_JWT"
```

```json
{
  "ok": true,
  "timestamp": "2026-05-29T05:30:00.000Z",
  "pool": {
    "total": 25,
    "idle": 12,
    "active": 13,
    "waiting": 0,
    "max": 25,
    "utilizationPct": 52
  }
}
```

### Where alerts go

The Monitor bot's Telegram channel — same place that receives:

- 🟢 App startup notifications
- 🟠 Health degraded (DB / Redis up/down)
- 🔴 Server 500 errors

Configured via the `TELEGRAM_MONITOR_CHAT_ID` env variable / app-setting.
**No new channel needs to be set up** — if health alerts are already
working, database alerts will land in the same place.

---

## 3. Alert thresholds

Thresholds live as `private readonly` fields on
[`DatabaseMonitorService`](../src/health/database-monitor.service.ts). All
values are operational defaults — not business rules — so they live in code
rather than `app_settings`. If you want them admin-tunable later, lift them
into `SettingsService`.

### 3.1 Pool utilization — three-tier

| Tier | Threshold | Sustained for | Icon | Meaning |
|---|---|---|---|---|
| **Medium** | ≥ 50 % | 6 ticks (3 min) | 🟡 | "Heads-up — half the pool is busy. Not an emergency." |
| **Warning** | ≥ 80 % | 2 ticks (1 min) | ⚠️ | "Watch this. We're close to the line." |
| **Critical** | ≥ 95 % | 2 ticks (1 min) | 🚨 | "Act now — queueing/timeouts imminent." |

The tier cascade is **mutually exclusive per tick** — a pool at 96 % fires
only critical, not all three. Each tier has its own consecutive-tick counter
so escalation from medium → warning → critical happens cleanly without
flapping.

### 3.2 Queue waiting

| Tier | Threshold | Sustained for | Meaning |
|---|---|---|---|
| **Warning** | ≥ 1 queued | 2 ticks (1 min) | "Someone is waiting for a connection — slow query in flight." |
| **Critical** | ≥ 5 queued | 1 tick (immediate) | "Real users are queued. Pool is full." |

### 3.3 Statement timeouts

Counted as `(count_in_last_30s × 60 / 30)` → per-minute rate.

| Tier | Threshold | Meaning |
|---|---|---|
| **Warning** | ≥ 5/min | "Some queries are hitting the 30s ceiling — check for missing indexes." |
| **Critical** | ≥ 20/min | "Something is generating a lot of slow queries. Check `pg_stat_statements`." |

### 3.4 Alert cooldown

To prevent spam during sustained incidents, each alert is rate-limited:

- Cooldown key: `db:alert:{kind}:{severity}` in Redis
- TTL: 10 minutes
- Stored via `safeCacheSet` (fails open — if Redis is down, alerts still fire)

The cooldown is scoped per `(kind, severity)`, so an escalation from warning
→ critical fires the critical alert immediately even if the warning was
recent.

### 3.5 Tuning the thresholds

After 1-2 weeks of production traffic, you'll see real baseline patterns.
Likely retunes:

- **`UTIL_MEDIUM_PCT`** — bump to 60 if you're seeing routine medium alerts
  during normal traffic. The point of medium is to surface unusual sustained
  load; if it fires every morning at 9am, the threshold is too low.
- **`UTIL_WARNING_PCT`** — bump 80 → 85 if morning login bursts trigger
  false alarms.
- **`TIMEOUTS_WARNING_PER_MIN`** — bump 5 → 8 if legit analytics edge cases
  hit 30s timeout regularly.

**Process for tuning:**

1. Watch alerts and the daily `[DatabaseMonitorService] pool active=… ` log
   line for 1-2 weeks.
2. If a tier fires too often without action being needed → raise that tier.
3. If a tier fires only when it's already too late to react → lower the tier
   below it.
4. Commit the change with a comment referencing why (link to a chat or
   incident).

---

## 4. Scaling triggers

The pool config is sized for current traffic. As the platform grows, here's
the upgrade path in order:

### 4.1 First: raise `max` per instance (cheapest)

| When | Action |
|---|---|
| Medium alerts at 50 % fire 3+ times/day during off-peak | Bump `max` from 25 → 35. Verify `max_connections` on the Postgres side still has headroom. |
| Warning alerts at 80 % during peak | Bump to 50. |
| Critical alerts ever fire | Bump immediately and investigate slow queries in parallel. |

**Postgres-side check before raising `max`:**

```sql
-- Current connection limit
SHOW max_connections;

-- Currently used by all apps
SELECT count(*) FROM pg_stat_activity;
```

Leave at least 25 % headroom on `pg_stat_activity` for admin tooling and
migration windows.

### 4.2 Second: add a second backend instance (PM2 cluster mode)

Once a single instance is at `max: 50`, doubling it on the same process
hits CPU/event-loop limits. Switch to PM2 cluster mode in `package.json`:

```json
"start:prod": "pm2-runtime start ecosystem.config.js"
```

Two instances × 50 = 100 → equals prod `max_connections` exactly. Don't go
further without raising `max_connections` on Postgres first.

### 4.3 Third: read replicas (cost increase)

When the bottleneck is sustained read load (the heavy analytics queries),
configure TypeORM to route reads to a replica:

```ts
// Conceptual — actual config goes in app.module.ts
replication: {
  master: { host: 'pg-primary…', … },
  slaves: [{ host: 'pg-replica…', … }],
}
```

Caveat: writes go to primary, reads to replica, but TypeORM doesn't
automatically pick — you must call `.useTransaction(false)` or use
`@QueryDeepPartialEntity` patterns.

### 4.4 Fourth: PgBouncer (last resort)

Useful if connection setup latency becomes a bottleneck or if you're running
many small instances (serverless, autoscaling). Adds operational complexity
— a separate process to monitor, fail over, and tune. Not needed until
you've exhausted 4.1-4.3.

---

## 5. Runbook

What to do when each alert fires.

### 🟡 Medium — Pool ≥ 50 % utilized (sustained 3 min)

Not an emergency. Reasons it might fire:

- Real traffic growth — check user count, RPS in logs
- A new code path doing more queries than expected
- A long-running cron job
- Cache miss storm (e.g., Redis just restarted)

**Action:**

```bash
# How busy is the DB right now?
curl $API_URL/api/health/pool -H "Authorization: Bearer $ADMIN_JWT"

# What's the slow query distribution?
psql $DB_URL -c "
  SELECT query, calls, total_exec_time, mean_exec_time
  FROM pg_stat_statements
  WHERE mean_exec_time > 100
  ORDER BY total_exec_time DESC
  LIMIT 20;
"
```

If everything looks normal and 50 % is just the new baseline, raise
`UTIL_MEDIUM_PCT` per [§3.5](#35-tuning-the-thresholds).

### ⚠️ Warning — Pool ≥ 80 %

Take action within the hour.

- Run the pg_stat_statements query above to find slow queries.
- Check the `5 / 20 timeouts per min` alert — often fires alongside warning.
- If sustained, plan to bump `max` per [§4.1](#41-first-raise-max-per-instance-cheapest).

### 🚨 Critical — Pool ≥ 95 % or ≥ 5 waiting

Act now. Users are getting connection-wait failures.

1. **Get the snapshot:** hit `/api/health/pool`. See if utilization is still
   climbing or has stabilized.
2. **Kill the longest-running query** if you can identify a culprit:
   ```sql
   SELECT pid, now() - query_start AS duration, state, query
   FROM pg_stat_activity
   WHERE state = 'active'
   ORDER BY duration DESC
   LIMIT 10;
   -- Then: SELECT pg_cancel_backend(<pid>);
   ```
3. **Emergency-bump `max`:** edit `app.module.ts`, redeploy. Adds capacity
   immediately.
4. **Investigate the root cause** after the fire is out.

### ⚠️/🚨 Statement timeouts

Postgres killed N runaway queries in the last 30 s. The alert payload
includes `lastQuery` — use that as a starting point.

```sql
-- Find the slowest queries overall
SELECT query, calls, total_exec_time, mean_exec_time, rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

Common causes:

- **Missing index** — most common. Look at the query's `WHERE` clause and
  add a composite index.
- **Full table scan from an inefficient join** — `EXPLAIN ANALYZE` the
  query to confirm.
- **Lock contention** — check `pg_stat_activity` for blocked queries.

---

## 6. How to safely change pool settings

For any change to the pool config, alert thresholds, or monitoring code:

### 6.1 Editing pool config in `app.module.ts`

1. Read [§1](#1-current-configuration) above to understand the current
   reasoning.
2. **If raising `max`,** check Postgres-side `max_connections` and current
   `pg_stat_activity` count before deploying. Don't go past 25 % under the
   ceiling.
3. **If changing timeouts,** preserve the cascade
   ([§1](#the-three-layer-timeout-cascade)):
   `connection wait < query execution < user perception`.
4. Update the inline comment in `app.module.ts` to explain the new value.
5. Update [§1 of this doc](#1-current-configuration) so the table here stays
   accurate.
6. Update the corresponding text in the monitor alerts if a timeout value
   changed (the alert summary says `"10s wait limit"` etc. — keep them in
   sync).

### 6.2 Editing alert thresholds in `DatabaseMonitorService`

1. Read [§3](#3-alert-thresholds) above.
2. Change the `UTIL_*`, `WAITING_*`, `TIMEOUTS_*`, or
   `CONSECUTIVE_TICKS_REQUIRED*` field.
3. Update the alert text (title, summary) to reflect the new threshold.
4. Update [§3 of this doc](#3-alert-thresholds) tables.
5. Add a code comment explaining why the threshold changed (link to incident
   or chat where the decision was made).

### 6.3 Adding a new alert kind

Currently three `kind` values are recognised by `sendDatabaseAlert`:
`pool_saturation`, `pool_waiting`, `statement_timeouts`. To add a fourth:

1. Extend the `kind` type in
   [`TelegramService.sendDatabaseAlert`](../src/integrations/telegram.service.ts).
2. Add the threshold field and check logic in `DatabaseMonitorService.tick()`.
3. Add a row to [§3 of this doc](#3-alert-thresholds).
4. Add a runbook entry to [§5](#5-runbook).

### 6.4 Disabling the monitor (kill switch)

If the monitor itself misbehaves (e.g., spam alerts), three escape hatches:

| Method | Effect | When to use |
|---|---|---|
| Unset `TELEGRAM_MONITOR_CHAT_ID` env / app-setting | Cron still ticks, but `sendDatabaseAlert` returns early when no chat ID | Quickest, no redeploy |
| Set `NODE_ENV != 'production'` | Cron `tick()` skips entirely | Test environments only |
| Remove `DatabaseMonitorService` from `HealthModule.providers` | Cron never runs | Permanent removal |

### 6.5 Changing TypeORM logger

If you ever swap `typeOrmTimeoutLogger` for a different logger (e.g.,
shipping queries to a third-party APM):

1. Confirm the new logger increments `statementTimeoutCount` on 57014, OR
   provide a different mechanism for `DatabaseMonitorService.tick()` to read
   the timeout count.
2. Otherwise the statement-timeout alerts silently stop firing.

---

## Appendix: Quick reference

### Files involved

| File | Role |
|---|---|
| [`src/app.module.ts`](../src/app.module.ts) | Pool config + custom logger registration |
| [`src/health/typeorm-timeout-logger.ts`](../src/health/typeorm-timeout-logger.ts) | Counts 57014 errors |
| [`src/health/database-monitor.service.ts`](../src/health/database-monitor.service.ts) | Cron + threshold checks + alert dispatch |
| [`src/health/health.controller.ts`](../src/health/health.controller.ts) | `GET /api/health/pool` admin endpoint |
| [`src/health/health.module.ts`](../src/health/health.module.ts) | Wires the monitor service |
| [`src/integrations/telegram.service.ts`](../src/integrations/telegram.service.ts) | `sendDatabaseAlert` method |
| `docs/DATABASE-POOL.md` | This document |

### One-liner verification commands

```bash
# Live pool snapshot
curl $API_URL/api/health/pool -H "Authorization: Bearer $ADMIN_JWT"

# Postgres-side: who is using my connections
psql $DB_URL -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# Slowest queries right now
psql $DB_URL -c "
  SELECT pid, now() - query_start AS duration, query
  FROM pg_stat_activity
  WHERE state = 'active'
  ORDER BY duration DESC
  LIMIT 5;"

# Top 10 query patterns by total time consumed
psql $DB_URL -c "
  SELECT query, calls, total_exec_time, mean_exec_time
  FROM pg_stat_statements
  ORDER BY total_exec_time DESC
  LIMIT 10;"
```

### Whom to ping

- DB / infra changes: ops on-call
- Schema migrations: backend team
- Alert tuning: whoever last touched `DATABASE-POOL.md` §3.5

---

**Last updated:** 2026-05-29
