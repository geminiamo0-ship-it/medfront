import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SettingsService } from '../settings/settings.service';
import { TelegramService } from '../integrations/telegram.service';

@Injectable()
export class AdminEmailOtpService {
  private readonly logger = new Logger(AdminEmailOtpService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly settingsService: SettingsService,
    private readonly telegramService: TelegramService,
  ) {}

  private getDateKeys() {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
    const thisMonth = now.toISOString().slice(0, 7);
    return { today, yesterday, thisMonth };
  }

  /**
   * Increment global OTP send counter and check thresholds.
   * Called by EmailService every time an OTP email is dispatched.
   */
  async trackOtpSend(type: 'verification' | 'reset'): Promise<void> {
    const { today, thisMonth } = this.getDateKeys();

    const dailyKey = `otp_global_daily:${today}`;
    const monthlyKey = `otp_global_monthly:${thisMonth}`;
    const typeKey = `otp_global_${type}_daily:${today}`;

    // Increment counters
    const [daily] = await Promise.all([
      this.cacheManager.get<number>(dailyKey),
      this.cacheManager.get<number>(monthlyKey),
      this.cacheManager.get<number>(typeKey),
    ]);

    const newDailyCount = (daily ?? 0) + 1;

    await Promise.all([
      this.cacheManager.set(dailyKey, newDailyCount, 48 * 60 * 60 * 1000),   // 48h
      this.cacheManager.set(monthlyKey,
        ((await this.cacheManager.get<number>(monthlyKey)) ?? 0) + 1,
        32 * 24 * 60 * 60 * 1000,  // 32 days
      ),
      this.cacheManager.set(typeKey,
        ((await this.cacheManager.get<number>(typeKey)) ?? 0) + 1,
        48 * 60 * 60 * 1000,
      ),
    ]);

    // Check thresholds and fire alerts
    await this.checkThresholds(newDailyCount, today);
  }

  private async checkThresholds(dailyCount: number, today: string): Promise<void> {
    const [medium, high, highest] = await Promise.all([
      this.settingsService.getNumber('EMAIL_OTP_THRESHOLD_MEDIUM', 50),
      this.settingsService.getNumber('EMAIL_OTP_THRESHOLD_HIGH', 75),
      this.settingsService.getNumber('EMAIL_OTP_THRESHOLD_HIGHEST', 100),
    ]);

    const thresholds = [
      { level: 'medium', value: medium, emoji: '🟡' },
      { level: 'high', value: high, emoji: '🟠' },
      { level: 'highest', value: highest, emoji: '🔴' },
    ];

    for (const threshold of thresholds) {
      if (dailyCount >= threshold.value) {
        const alertKey = `otp_threshold_alert:${today}:${threshold.level}`;
        const alreadyAlerted = await this.cacheManager.get(alertKey);
        if (!alreadyAlerted) {
          await this.cacheManager.set(alertKey, true, 48 * 60 * 60 * 1000);
          await this.telegramService.sendOtpThresholdAlert({
            dailyCount,
            thresholdLevel: threshold.level,
            thresholdValue: threshold.value,
          });
          this.logger.warn(`OTP threshold alert fired: ${threshold.level} at ${dailyCount} sends`);
        }
      }
    }
  }

  async getStats() {
    const { today, yesterday, thisMonth } = this.getDateKeys();

    const [
      todayTotal,
      todayVerification,
      todayReset,
      yesterdayTotal,
      monthTotal,
      thresholdMedium,
      thresholdHigh,
      thresholdHighest,
      enabledRaw,
    ] = await Promise.all([
      this.cacheManager.get<number>(`otp_global_daily:${today}`),
      this.cacheManager.get<number>(`otp_global_verification_daily:${today}`),
      this.cacheManager.get<number>(`otp_global_reset_daily:${today}`),
      this.cacheManager.get<number>(`otp_global_daily:${yesterday}`),
      this.cacheManager.get<number>(`otp_global_monthly:${thisMonth}`),
      this.settingsService.getNumber('EMAIL_OTP_THRESHOLD_MEDIUM', 50),
      this.settingsService.getNumber('EMAIL_OTP_THRESHOLD_HIGH', 75),
      this.settingsService.getNumber('EMAIL_OTP_THRESHOLD_HIGHEST', 100),
      this.settingsService.getString('EMAIL_OTP_ENABLED', 'true'),
    ]);

    const total = todayTotal ?? 0;
    const highest = Math.max(thresholdMedium, thresholdHigh, thresholdHighest);

    return {
      success: true,
      data: {
        today: {
          total,
          verification: todayVerification ?? 0,
          reset: todayReset ?? 0,
          percentOfHighest: highest > 0 ? Math.round((total / highest) * 100) : 0,
        },
        yesterday: yesterdayTotal ?? 0,
        thisMonth: monthTotal ?? 0,
        thresholds: {
          medium: thresholdMedium,
          high: thresholdHigh,
          highest: thresholdHighest,
        },
        alertLevel: this.getAlertLevel(total, thresholdMedium, thresholdHigh, thresholdHighest),
        enabled: enabledRaw.toLowerCase() === 'true',
      },
    };
  }

  private getAlertLevel(count: number, medium: number, high: number, highest: number): string {
    if (count >= highest) return 'highest';
    if (count >= high) return 'high';
    if (count >= medium) return 'medium';
    return 'normal';
  }

  async updateSettings(dto: {
    thresholdMedium?: number;
    thresholdHigh?: number;
    thresholdHighest?: number;
    enabled?: boolean;
  }, adminEmail: string) {
    const ops: Promise<any>[] = [];

    if (dto.thresholdMedium !== undefined) {
      ops.push(this.settingsService.setNumber('EMAIL_OTP_THRESHOLD_MEDIUM', dto.thresholdMedium, adminEmail));
    }
    if (dto.thresholdHigh !== undefined) {
      ops.push(this.settingsService.setNumber('EMAIL_OTP_THRESHOLD_HIGH', dto.thresholdHigh, adminEmail));
    }
    if (dto.thresholdHighest !== undefined) {
      ops.push(this.settingsService.setNumber('EMAIL_OTP_THRESHOLD_HIGHEST', dto.thresholdHighest, adminEmail));
    }
    if (dto.enabled !== undefined) {
      ops.push(this.settingsService.setString('EMAIL_OTP_ENABLED', String(dto.enabled), adminEmail));
    }

    await Promise.all(ops);
    return this.getStats();
  }
}
