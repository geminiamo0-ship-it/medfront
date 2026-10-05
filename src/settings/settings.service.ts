import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AppSetting } from '../entities/app-setting.entity';
import {
  appSettingsAllCacheKey,
  APP_SETTINGS_TTL_MS,
} from '../cache/cache-keys.util';
import { safeCacheGet, safeCacheSet, safeCacheDel } from '../cache/safe-cache.util';

// Fix #2: cache the entire app_settings table as a single key.
//
// Previously every getString(key) issued its own SELECT and cached for 60s,
// which produced 1.36M `SELECT * FROM app_settings WHERE key = $1` calls in
// the last billing period. We now load the whole table once, hold it for 12h,
// and only invalidate on write.

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSetting)
    private readonly settingsRepo: Repository<AppSetting>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  // Loads the full settings table once per 12h window. Stored as an array of
  // [key, value] tuples because Maps don't survive JSON serialization to Redis.
  private async getAllSettingsMap(): Promise<Map<string, string>> {
    const cached = await safeCacheGet<Array<[string, string]>>(
      this.cacheManager,
      appSettingsAllCacheKey(),
    );
    if (cached) return new Map(cached);

    const rows = await this.settingsRepo.find();
    const entries: Array<[string, string]> = rows.map((r) => [r.key, r.value]);

    await safeCacheSet(
      this.cacheManager,
      appSettingsAllCacheKey(),
      entries,
      APP_SETTINGS_TTL_MS,
    );
    return new Map(entries);
  }

  async getString(key: string, fallback = ''): Promise<string> {
    const map = await this.getAllSettingsMap();
    const value = map.get(key);
    return value === undefined ? fallback : value;
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    const raw = await this.getString(key, String(fallback));
    const parsed = Number(raw);
    return isNaN(parsed) ? fallback : parsed;
  }

  async setString(key: string, value: string, updatedBy?: string): Promise<AppSetting> {
    let setting = await this.settingsRepo.findOne({ where: { key } });
    if (!setting) {
      setting = this.settingsRepo.create({ key, value, updatedBy: updatedBy ?? null });
    } else {
      setting.value = value;
      setting.updatedBy = updatedBy ?? null;
    }
    const saved = await this.settingsRepo.save(setting);
    // Invalidate the whole-table cache. The next read repopulates it.
    await safeCacheDel(this.cacheManager, appSettingsAllCacheKey());
    return saved;
  }

  async setNumber(key: string, value: number, updatedBy?: string): Promise<AppSetting> {
    return this.setString(key, String(value), updatedBy);
  }

  async getAll(): Promise<AppSetting[]> {
    // Admin endpoint: bypass cache so the panel always shows the freshest values
    // right after an admin save. The latency is acceptable here — this isn't
    // on a user hot path.
    return this.settingsRepo.find();
  }
}
