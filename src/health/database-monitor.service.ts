import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TelegramService } from '../integrations/telegram.service';
import { typeOrmTimeoutLogger } from './typeorm-timeout-logger';

/**
 * Snapshot of the pg connection pool at a single point in time.
 *
 * Fields:
 *   - `total`: connections currently held by the pool (idle + active).
 *   - `idle`: connections currently doing nothing.
 *   - `active`: `total - idle` — connections with a query in flight.
 *   - `waiting`: requests that wanted a connection but the pool was at
 *     `max`, so they're queued. Anything > 0 here means real users are
 *     waiting for someone else's query to finish.
 *   - `max`: configured upper bound from app.module.ts.
 *   - `utilizationPct`: `active / max`. The alerting threshold lives here.
 */
export interface PoolSnapshot {
  total: number;
  idle: number;
  active: number;
  waiting: number;
  max: number;
  utilizationPct: number;
}

@Injectable()
export class DatabaseMonitorService {
  private readonly logger = new Logger(DatabaseMonitorService.name);

  // Threshold tuning — kept inline because these are operational defaults,
  // not business rules. If you want to make them admin-tunable later, lift
  // them into SettingsService. See docs/DATABASE-POOL.md for the playbook
  // on retuning these after observing real traffic.
  //
  // Three tiers of pool-utilization alerts:
  //   medium   (50%) → "FYI, half the pool is in use" — informational
  //   warning  (80%) → "watch this, we're getting close"
  //   critical (95%) → "act now, queueing/timeouts imminent"
  private readonly UTIL_MEDIUM_PCT = 50;
  private readonly UTIL_WARNING_PCT = 80;
  private readonly UTIL_CRITICAL_PCT = 95;
  private readonly WAITING_WARNING = 1; // any queued request is interesting
  private readonly WAITING_CRITICAL = 5; // 5+ queued = users are waiting

  // Statement-timeout (PG 57014) rate alerting — counted in a rolling window
  // of one monitor tick (30s).
  private readonly TIMEOUTS_WARNING_PER_MIN = 5;
  private readonly TIMEOUTS_CRITICAL_PER_MIN = 20;

  // Flapping protection: an alert only fires after the threshold is breached
  // for N consecutive ticks. Prevents one-off spikes (cache stampede, brief
  // GC pause, etc.) from paging ops every 30s.
  private readonly CONSECUTIVE_TICKS_REQUIRED = 2;
  // Medium alerts use a longer window — at 50% we don't care about a 1-minute
  // burst; we care about sustained "things are heating up" patterns. Six ticks
  // = 3 minutes, which is the smallest interval that filters routine spikes.
  private readonly CONSECUTIVE_TICKS_REQUIRED_MEDIUM = 6;

  private consecutiveOverUtilTicks = 0;
  private consecutiveMediumUtilTicks = 0;
  private consecutiveOverWaitingTicks = 0;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Read the underlying pg-pool from the TypeORM DataSource. TypeORM exposes
   * the master connection pool on `driver.master` for the postgres driver.
   * The shape comes from node-postgres's `Pool` — `totalCount`, `idleCount`,
   * and `waitingCount` are all standard properties.
   */
  getPoolSnapshot(): PoolSnapshot | null {
    try {
      const driver: any = this.dataSource.driver as any;
      const pool: any = driver?.master ?? driver?.pool;
      if (!pool) return null;

      const total = Number(pool.totalCount ?? 0);
      const idle = Number(pool.idleCount ?? 0);
      const waiting = Number(pool.waitingCount ?? 0);
      const active = Math.max(0, total - idle);

      // `max` is in the pg-pool options, not always on the pool instance.
      // We fall back to the value we know we configured in app.module.ts.
      const max = Number(pool.options?.max ?? 25);

      return {
        total,
        idle,
        active,
        waiting,
        max,
        utilizationPct: max > 0 ? Math.round((active / max) * 100) : 0,
      };
    } catch (err: any) {
      this.logger.warn(`Failed to read pool stats: ${err?.message ?? err}`);
      return null;
    }
  }

  /**
   * Production monitor — runs every 30 seconds. Skipped in dev so local
   * machines don't spam the Telegram channel during testing.
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async tick(): Promise<void> {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    if (!isProd) return;

    const snapshot = this.getPoolSnapshot();
    if (!snapshot) return;

    // ── Pool utilization (tiered: medium → warning → critical)
    //
    // We use an if/else-if cascade so each tick only fires the highest tier
    // it currently breaches. A pool at 96% counts as critical, not as
    // critical + warning + medium all at once.
    //
    // Each tier has its own sustained-tick counter so escalating from one
    // tier into the next doesn't get short-circuited by flapping protection.
    if (snapshot.utilizationPct >= this.UTIL_CRITICAL_PCT) {
      this.consecutiveOverUtilTicks += 1;
      this.consecutiveMediumUtilTicks += 1;
      if (this.consecutiveOverUtilTicks >= this.CONSECUTIVE_TICKS_REQUIRED) {
        await this.telegram.sendDatabaseAlert({
          severity: 'critical',
          kind: 'pool_saturation',
          title: 'Pool ≥95% utilized',
          summary: `Active connections are at ${snapshot.utilizationPct}% of the ${snapshot.max}-slot pool. New requests will start queueing or timing out (10s wait limit).`,
          details: {
            active: snapshot.active,
            idle: snapshot.idle,
            waiting: snapshot.waiting,
            max: snapshot.max,
          },
        });
      }
    } else if (snapshot.utilizationPct >= this.UTIL_WARNING_PCT) {
      this.consecutiveOverUtilTicks += 1;
      this.consecutiveMediumUtilTicks += 1;
      if (this.consecutiveOverUtilTicks >= this.CONSECUTIVE_TICKS_REQUIRED) {
        await this.telegram.sendDatabaseAlert({
          severity: 'warning',
          kind: 'pool_saturation',
          title: 'Pool ≥80% utilized',
          summary: `Sustained high pool utilization (${snapshot.utilizationPct}% of ${snapshot.max}). Consider scaling out or investigating slow queries.`,
          details: {
            active: snapshot.active,
            idle: snapshot.idle,
            waiting: snapshot.waiting,
            max: snapshot.max,
          },
        });
      }
    } else if (snapshot.utilizationPct >= this.UTIL_MEDIUM_PCT) {
      // Medium tier — heads-up only. Half the pool in use isn't an emergency
      // but it's a signal that traffic is growing. Sustained for 3 min
      // (6 × 30s ticks) before firing to filter routine bursts like
      // morning login or end-of-day exam submissions.
      this.consecutiveOverUtilTicks = 0;
      this.consecutiveMediumUtilTicks += 1;
      if (this.consecutiveMediumUtilTicks >= this.CONSECUTIVE_TICKS_REQUIRED_MEDIUM) {
        await this.telegram.sendDatabaseAlert({
          severity: 'medium',
          kind: 'pool_saturation',
          title: 'Pool ≥50% utilized (sustained)',
          summary: `Pool utilization has held above 50% for 3+ minutes (currently ${snapshot.utilizationPct}% of ${snapshot.max}). Not an emergency — just a heads-up that traffic is climbing. Worth checking pg_stat_statements for unusually slow queries.`,
          details: {
            active: snapshot.active,
            idle: snapshot.idle,
            waiting: snapshot.waiting,
            max: snapshot.max,
          },
        });
      }
    } else {
      this.consecutiveOverUtilTicks = 0;
      this.consecutiveMediumUtilTicks = 0;
    }

    // ── Waiting queue
    if (snapshot.waiting >= this.WAITING_CRITICAL) {
      this.consecutiveOverWaitingTicks += 1;
      if (this.consecutiveOverWaitingTicks >= 1) {
        await this.telegram.sendDatabaseAlert({
          severity: 'critical',
          kind: 'pool_waiting',
          title: `${snapshot.waiting} requests waiting for a connection`,
          summary: `Real users are queued behind in-flight queries. Pool max is ${snapshot.max}; consider raising it or finding the slow queries holding connections.`,
          details: {
            waiting: snapshot.waiting,
            active: snapshot.active,
            max: snapshot.max,
            utilizationPct: `${snapshot.utilizationPct}%`,
          },
        });
      }
    } else if (snapshot.waiting >= this.WAITING_WARNING) {
      // Soft warn after a couple of ticks of sustained queueing
      this.consecutiveOverWaitingTicks += 1;
      if (this.consecutiveOverWaitingTicks >= this.CONSECUTIVE_TICKS_REQUIRED) {
        await this.telegram.sendDatabaseAlert({
          severity: 'warning',
          kind: 'pool_waiting',
          title: `${snapshot.waiting} request(s) queued for a connection`,
          summary: `Sustained queueing — the pool is just barely keeping up.`,
          details: {
            waiting: snapshot.waiting,
            active: snapshot.active,
            max: snapshot.max,
          },
        });
      }
    } else {
      this.consecutiveOverWaitingTicks = 0;
    }

    // ── Statement-timeout rate
    // The TypeORM logger increments a counter every time PG kills a query
    // for exceeding statement_timeout. We snapshot+reset every 30s, scale
    // up to per-minute, and alert if too high.
    const tickSeconds = 30;
    const timeouts = typeOrmTimeoutLogger.snapshotAndReset();
    const perMinute = Math.round((timeouts.count * 60) / tickSeconds);

    if (perMinute >= this.TIMEOUTS_CRITICAL_PER_MIN) {
      await this.telegram.sendDatabaseAlert({
        severity: 'critical',
        kind: 'statement_timeouts',
        title: `${perMinute} statement timeouts/min`,
        summary: `Postgres killed ${timeouts.count} runaway queries in the last 30s — that's ${perMinute}/min. Something is generating extremely slow queries; check pg_stat_statements.`,
        details: {
          lastTimeoutAt: timeouts.lastAt?.toISOString() ?? 'n/a',
          lastQuery: timeouts.lastQuery ?? 'n/a',
        },
      });
    } else if (perMinute >= this.TIMEOUTS_WARNING_PER_MIN) {
      await this.telegram.sendDatabaseAlert({
        severity: 'warning',
        kind: 'statement_timeouts',
        title: `${perMinute} statement timeouts/min`,
        summary: `Some queries are exceeding the 30s statement timeout. Not catastrophic yet but worth a look.`,
        details: {
          lastTimeoutAt: timeouts.lastAt?.toISOString() ?? 'n/a',
          lastQuery: timeouts.lastQuery ?? 'n/a',
        },
      });
    }

    // Always log the current snapshot at debug level so ops can build
    // dashboards out of the loglines if they want.
    this.logger.debug(
      `pool active=${snapshot.active}/${snapshot.max} (${snapshot.utilizationPct}%) idle=${snapshot.idle} waiting=${snapshot.waiting} timeouts/min=${perMinute}`,
    );
  }
}
