import { Logger as NestLogger } from '@nestjs/common';
import { Logger as TypeOrmLogger, QueryRunner } from 'typeorm';

/**
 * Custom TypeORM logger whose only job is to count statement_timeout
 * cancellations (Postgres SQLSTATE 57014 — query_canceled). We register it
 * on the TypeORM DataSource in app.module.ts so it sees every query error
 * regardless of where it was issued (controllers, cron jobs, services).
 *
 * Why a logger and not an Exception Filter:
 *   - Filters only fire for errors that propagate to the HTTP layer.
 *   - Background jobs (cron, queue consumers) bypass filters.
 *   - The TypeORM logger sits below all of that and catches everything.
 *
 * The counter is in-memory per process (a `count` field). The
 * DatabaseMonitorService reads it once per cron tick, then resets it to
 * compute a per-window rate. Per-process is fine because the monitor cron
 * also runs in each process — every instance reports its own slice.
 */
export class TypeOrmTimeoutLogger implements TypeOrmLogger {
  // Renamed from `log` so it doesn't collide with the TypeORM Logger
  // interface's `log(level, message, qr?)` method we implement below.
  private readonly nestLogger = new NestLogger('TypeOrmTimeout');

  // Public counter. Mutated by logQueryError, read+reset by the monitor.
  public statementTimeoutCount = 0;
  public lastTimeoutQuery: string | null = null;
  public lastTimeoutAt: Date | null = null;

  logQuery(_query: string, _parameters?: any[], _qr?: QueryRunner): void {
    // Intentionally silent — we don't log every query.
  }

  logQueryError(
    error: string | Error,
    query: string,
    _parameters?: any[],
    _queryRunner?: QueryRunner,
  ): void {
    const code = this.extractPgCode(error);
    if (code === '57014') {
      this.statementTimeoutCount += 1;
      this.lastTimeoutQuery = this.truncate(query, 240);
      this.lastTimeoutAt = new Date();
      this.nestLogger.warn(
        `Statement timeout fired (count=${this.statementTimeoutCount}). Query: ${this.lastTimeoutQuery}`,
      );
      return;
    }
    // For non-timeout errors, defer to the default error path — but emit a
    // warn so query failures are still visible in logs.
    const msg = typeof error === 'string' ? error : error?.message ?? String(error);
    this.nestLogger.warn(`Query error (${code ?? 'unknown'}): ${msg}`);
  }

  logQuerySlow(
    time: number,
    query: string,
    _parameters?: any[],
    _queryRunner?: QueryRunner,
  ): void {
    this.nestLogger.warn(`Slow query (${time}ms): ${this.truncate(query, 200)}`);
  }

  logSchemaBuild(_message: string, _queryRunner?: QueryRunner): void {
    /* migrations / schema sync — no-op */
  }
  logMigration(_message: string, _queryRunner?: QueryRunner): void {
    /* no-op */
  }

  log(
    level: 'log' | 'info' | 'warn',
    message: any,
    _queryRunner?: QueryRunner,
  ): void {
    if (level === 'warn') this.nestLogger.warn(String(message));
    else this.nestLogger.log(String(message));
  }

  /**
   * Read the current counter and reset to zero. Called by the monitor cron
   * once per tick so each window represents `count / windowSeconds`.
   */
  snapshotAndReset(): {
    count: number;
    lastQuery: string | null;
    lastAt: Date | null;
  } {
    const snapshot = {
      count: this.statementTimeoutCount,
      lastQuery: this.lastTimeoutQuery,
      lastAt: this.lastTimeoutAt,
    };
    this.statementTimeoutCount = 0;
    return snapshot;
  }

  private extractPgCode(error: string | Error): string | undefined {
    if (typeof error === 'string') return undefined;
    const driverError = (error as any).driverError ?? error;
    return driverError?.code;
  }

  private truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n) + '…' : s;
  }
}

// Singleton instance — registered with TypeORM in app.module.ts and read by
// DatabaseMonitorService via constructor injection through a custom provider.
export const typeOrmTimeoutLogger = new TypeOrmTimeoutLogger();
