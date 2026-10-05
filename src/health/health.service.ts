import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios from 'axios';
import { TelegramService } from '../integrations/telegram.service';

export interface ComponentStatus {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface HealthResult {
  status: 'ok' | 'degraded' | 'down';
  db: ComponentStatus;
  redis: ComponentStatus;
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  async checkDatabase(): Promise<ComponentStatus> {
    const t = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { ok: true, latencyMs: Date.now() - t };
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - t, error: err?.message ?? 'Unknown' };
    }
  }

  async checkRedis(): Promise<ComponentStatus> {
    // Fixed key with short TTL — no orphan risk, no timestamp noise
    const key = '__health__:probe';
    const t = Date.now();
    try {
      await this.cache.set(key, '1', 2000);
      return { ok: true, latencyMs: Date.now() - t };
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - t, error: err?.message ?? 'Unknown' };
    }
  }

  async checkAll(): Promise<HealthResult> {
    const [db, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    let status: HealthResult['status'];
    if (db.ok && redis.ok)        status = 'ok';
    else if (!db.ok && !redis.ok) status = 'down';
    else                          status = 'degraded';

    return { status, db, redis, timestamp: new Date().toISOString() };
  }

  /**
   * PRODUCTION cron (Railway) — every 5 min.
   * Checks DB + Redis on the live server and alerts if degraded/down.
   * Also called manually by the Cloudflare scheduled() handler as a bonus.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async runScheduledCheck(): Promise<void> {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    if (!isProd) return; // dev uses pingProductionFromDev() below

    try {
      const result = await this.checkAll();

      if (result.status !== 'ok') {
        this.logger.warn(`Health check failed: ${JSON.stringify(result)}`);
        await this.telegram.sendHealthAlert(result);
      } else {
        this.logger.log(`Health OK — DB ${result.db.latencyMs}ms · Redis ${result.redis.latencyMs}ms`);
      }
    } catch (err: any) {
      this.logger.error(`Health check threw: ${err?.message}`);
    }
  }

  /**
   * DEV/STAGING cron — every 5 min.
   * Pings the production health endpoint from the dev machine,
   * acting as an external monitor for production.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async pingProductionFromDev(): Promise<void> {
    // Only run in local development — not in production, test, CI, or staging
    const env = this.config.get<string>('NODE_ENV');
    if (env !== 'development') return;

    const prodUrl = this.config.get<string>('PROD_HEALTH_URL')
      || 'https://api.medpark.io/api/health';

    try {
      const res  = await axios.get<HealthResult>(prodUrl, { timeout: 12_000 });
      const data = res.data;

      if (data.status !== 'ok') {
        this.logger.warn(`[prod-monitor] Production health ${data.status}`);
        await this.telegram.sendHealthAlert(data);
      } else {
        this.logger.log(`[prod-monitor] Production OK — DB ${data.db.latencyMs}ms · Redis ${data.redis.latencyMs}ms`);
      }
    } catch (err: any) {
      this.logger.error(`[prod-monitor] Production unreachable: ${err?.message}`);
      await this.telegram.sendHealthAlert({
        status:    'down',
        db:        { ok: false, latencyMs: 0, error: 'unreachable' },
        redis:     { ok: false, latencyMs: 0, error: 'unreachable' },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
