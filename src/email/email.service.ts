import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { randomInt, timingSafeEqual } from 'crypto';
import { SettingsService } from '../settings/settings.service';
import { TelegramService } from '../integrations/telegram.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;

  private static readonly OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private static readonly MAX_OTP_ATTEMPTS = 5;
  private static readonly RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds between resends

  // Unambiguous OTP alphabet — letters that look like digits (I/O/L) and
  // digits that look like letters (0/1) are excluded so users can read the
  // code from email and type it without confusion. 32 chars → 32^6 ≈ 1.07B
  // combinations, ~400 years to brute-force at 5 attempts/min.
  private static readonly OTP_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  private static readonly OTP_LENGTH = 6;

  constructor(
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
    private readonly telegramService: TelegramService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;

    // Trim and clean the from email to avoid format errors from .env whitespace/quotes
    const rawFrom = this.configService.get<string>('FROM_EMAIL', 'noreply@yourdomain.com');
    this.fromEmail = rawFrom.replace(/['"]/g, '').trim();

    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY is not configured. Email service will not send real emails.');
    }
  }

  /**
   * Generates a cryptographically secure 6-character alphanumeric OTP using
   * an unambiguous character set (no 0/O/1/I/L). 32^6 ≈ 1.07 billion possible
   * codes — brute-forcing at the rate limit (5/min/IP) would take centuries.
   *
   * `randomInt` (Node crypto, OS entropy) is used per character — NOT
   * Math.random — so output cannot be predicted from prior codes.
   *
   * Codes are case-insensitive on verification (we always uppercase both
   * sides), so a user typing "abc" or "ABC" both work. The stored canonical
   * form is uppercase.
   */
  private generateOtp(): string {
    const charset = EmailService.OTP_CHARSET;
    let result = '';
    for (let i = 0; i < EmailService.OTP_LENGTH; i++) {
      result += charset[randomInt(0, charset.length)];
    }
    return result;
  }

  /**
   * Normalize OTP input from the user before comparison: trim whitespace
   * (mobile keyboards add stray spaces on paste) and uppercase (codes are
   * case-insensitive). Returns empty string for nullish/non-string input.
   */
  private normalizeOtpInput(raw: string): string {
    return String(raw ?? '').trim().toUpperCase();
  }

  /**
   * Tracks global daily/monthly OTP sends and fires Telegram alerts at configured thresholds.
   */
  private async trackGlobalOtpSend(type: 'verification' | 'reset'): Promise<void> {
    try {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const thisMonth = now.toISOString().slice(0, 7);

      const dailyKey = `otp_global_daily:${today}`;
      const monthlyKey = `otp_global_monthly:${thisMonth}`;
      const typeKey = `otp_global_${type}_daily:${today}`;

      const currentDaily = (await this.cacheManager.get<number>(dailyKey)) ?? 0;
      const newDailyCount = currentDaily + 1;

      await Promise.all([
        this.cacheManager.set(dailyKey, newDailyCount, 48 * 60 * 60 * 1000),
        this.cacheManager.set(monthlyKey, ((await this.cacheManager.get<number>(monthlyKey)) ?? 0) + 1, 32 * 24 * 60 * 60 * 1000),
        this.cacheManager.set(typeKey, ((await this.cacheManager.get<number>(typeKey)) ?? 0) + 1, 48 * 60 * 60 * 1000),
      ]);

      // Check configurable thresholds
      const [tMedium, tHigh, tHighest] = await Promise.all([
        this.settingsService.getNumber('EMAIL_OTP_THRESHOLD_MEDIUM', 50),
        this.settingsService.getNumber('EMAIL_OTP_THRESHOLD_HIGH', 75),
        this.settingsService.getNumber('EMAIL_OTP_THRESHOLD_HIGHEST', 100),
      ]);

      const thresholds = [
        { level: 'medium', value: tMedium },
        { level: 'high', value: tHigh },
        { level: 'highest', value: tHighest },
      ];

      for (const t of thresholds) {
        if (newDailyCount >= t.value) {
          const alertKey = `otp_threshold_alert:${today}:${t.level}`;
          const alreadyAlerted = await this.cacheManager.get(alertKey);
          if (!alreadyAlerted) {
            await this.cacheManager.set(alertKey, true, 48 * 60 * 60 * 1000);
            this.telegramService.sendOtpThresholdAlert({
              dailyCount: newDailyCount,
              thresholdLevel: t.level,
              thresholdValue: t.value,
            }).catch(err => this.logger.warn(`OTP threshold alert failed: ${err}`));
            this.logger.warn(`Global OTP threshold reached: ${t.level} at ${newDailyCount} sends`);
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`trackGlobalOtpSend error: ${err?.message}`);
    }
  }

  /**
   * Sends OTP verification email and stores the code in Redis.
   * Includes per-email cooldown to prevent spam.
   */
  async sendVerificationOtp(email: string, isAutoTrigger = false): Promise<{ success: boolean; message: string }> {
    try {
      const normalizedEmail = email.toLowerCase();
      const otpKey = `otp:${normalizedEmail}`;

      // --- Smart Auto-Trigger: Don't resend if one is already active ---
      if (isAutoTrigger) {
        const existingOtp = await this.cacheManager.get(otpKey);
        if (existingOtp) {
          return { success: true, message: 'Existing OTP is still active, skipping new email.' };
        }
      }

      // --- Hourly Rate Limit Check ---
      const maxPerWindowStr = await this.settingsService.getString('SECURITY_OTP_MAX_PER_WINDOW', '3');
      const windowSecondsStr = await this.settingsService.getString('SECURITY_OTP_WINDOW_SECONDS', '3600');
      
      const maxPerWindow = parseInt(maxPerWindowStr, 10) || 3;
      const windowMs = (parseInt(windowSecondsStr, 10) || 3600) * 1000;

      const windowKey = `otp_window_count:${normalizedEmail}`;
      const requestCount = (await this.cacheManager.get<number>(windowKey)) || 0;
      if (requestCount >= maxPerWindow) {
        // Send alert once per block
        if (requestCount === maxPerWindow) {
           await this.telegramService.sendOtpLimitAlert({
             email: normalizedEmail,
             requestCount: requestCount + 1,
             limit: maxPerWindow,
             timeWindow: `${Math.round(windowMs / 60000)} minutes`,
           });
           await this.cacheManager.set(windowKey, requestCount + 1, windowMs);
        }
        return { success: false, message: 'Too many verification attempts. Please try again later.' };
      }

      // Track daily and monthly statistics for this account
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const thisMonth = now.toISOString().slice(0, 7);
      
      const dailyKey = `otp_daily_count:${today}:${normalizedEmail}`;
      const monthlyKey = `otp_monthly_count:${thisMonth}:${normalizedEmail}`;
      
      const dailyCount = (await this.cacheManager.get<number>(dailyKey)) || 0;
      const monthlyCount = (await this.cacheManager.get<number>(monthlyKey)) || 0;
      
      // TTLs for tracking
      await this.cacheManager.set(dailyKey, dailyCount + 1, 24 * 60 * 60 * 1000);
      await this.cacheManager.set(monthlyKey, monthlyCount + 1, 30 * 24 * 60 * 60 * 1000);

      // --- Cooldown check: prevent rapid resend spam ---
      const cooldownKey = `otp_cooldown:${normalizedEmail}`;
      const isOnCooldown = await this.cacheManager.get(cooldownKey);
      if (isOnCooldown) {
        return { success: false, message: 'Please wait before requesting a new code.' };
      }

      const otp = this.generateOtp();

      // Store OTP in cache with 10-minute TTL
      await this.cacheManager.set(otpKey, otp, EmailService.OTP_TTL_MS);
      // Reset attempt counter on new OTP
      await this.cacheManager.del(`otp_attempts:${normalizedEmail}`);
      // Set cooldown (60 seconds)
      await this.cacheManager.set(cooldownKey, true, EmailService.RESEND_COOLDOWN_MS);
      // Increment hourly window counter
      await this.cacheManager.set(windowKey, requestCount + 1, windowMs);

      // --- Block mock mode in production ---
      if (!this.resend) {
        if (process.env.NODE_ENV === 'production') {
          this.logger.error('RESEND_API_KEY is not configured in production! Cannot send OTP.');
          return { success: false, message: 'Email service is unavailable. Please contact support.' };
        }
        this.logger.warn(`[DEV] Mock OTP for ${normalizedEmail} (not logged in production)`);
        return { success: true, message: 'OTP generated (Mock mode)' };
      }

      const { data, error } = await this.resend.emails.send({
        from: `MedPark <${this.fromEmail}>`,
        to: normalizedEmail,
        subject: 'Verify Your Account - MedPark',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Verify Your Account</h2>
            <p>Thank you for registering with MedPark! Use the verification code below to confirm your email address. This code is valid for 10 minutes and is not case-sensitive.</p>
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <strong style="font-family: 'Courier New', Consolas, monospace; font-size: 28px; letter-spacing: 6px; color: #4f46e5;">${otp}</strong>
            </div>
            <p style="color: #6b7280; font-size: 14px;">If you did not request this verification, please ignore this email.</p>
          </div>
        `,
      });

      if (error) {
        this.logger.error(`Failed to send OTP via Resend to ${normalizedEmail}: ${error.message}`, error);
        return { success: false, message: 'Failed to send verification email' };
      }

      this.logger.log(`OTP sent successfully to ${normalizedEmail} (ID: ${data?.id})`);
      // Track global usage (fire-and-forget)
      this.trackGlobalOtpSend('verification').catch(() => {});
      return { success: true, message: 'Verification code sent successfully' };
    } catch (err: any) {
      this.logger.error(`Error sending OTP to ${email}: ${err.message}`, err.stack);
      return { success: false, message: 'An error occurred while sending the verification email' };
    }
  }

  /**
   * Verifies the OTP code for a given email.
   * Includes brute-force protection with attempt counter.
   * Uses timing-safe comparison.
   */
  async verifyOtp(email: string, code: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase();
    const otpKey = `otp:${normalizedEmail}`;
    const attemptsKey = `otp_attempts:${normalizedEmail}`;

    const storedOtp = await this.cacheManager.get<string>(otpKey);

    if (!storedOtp) {
      return false; // Expired or doesn't exist
    }

    // --- Brute-force protection: check failed attempt count ---
    const attempts = (await this.cacheManager.get<number>(attemptsKey)) || 0;
    if (attempts >= EmailService.MAX_OTP_ATTEMPTS) {
      // OTP burned after too many failures — user must request a new one
      await this.cacheManager.del(otpKey);
      await this.cacheManager.del(attemptsKey);
      this.logger.warn(`OTP burned for ${normalizedEmail} after ${EmailService.MAX_OTP_ATTEMPTS} failed attempts`);
      return false;
    }

    // --- Timing-safe comparison ---
    // Normalize user input: trim + uppercase. Stored OTP is already uppercase
    // (generateOtp uses the upper-case charset). This makes verification
    // case-insensitive so "abc23k" and "ABC23K" both work.
    const normalizedInput = this.normalizeOtpInput(code);
    const storedBuf = Buffer.from(storedOtp);
    const codeBuf = Buffer.from(normalizedInput);
    const isMatch =
      storedBuf.length === codeBuf.length &&
      timingSafeEqual(storedBuf, codeBuf);

    if (isMatch) {
      // Clean up the OTP and attempts after successful verification
      await this.cacheManager.del(otpKey);
      await this.cacheManager.del(attemptsKey);
      return true;
    }

    // Increment failed attempts
    await this.cacheManager.set(attemptsKey, attempts + 1, EmailService.OTP_TTL_MS);
    return false;
  }

  /**
   * Sends a password reset OTP.
   */
  async sendPasswordResetOtp(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const normalizedEmail = email.toLowerCase();
      const otpKey = `reset_otp:${normalizedEmail}`;
      const cooldownKey = `reset_otp_cooldown:${normalizedEmail}`;

      // Cooldown check (60s per request)
      const isOnCooldown = await this.cacheManager.get(cooldownKey);
      if (isOnCooldown) {
        return { success: false, message: 'Please wait before requesting another reset code.' };
      }

      // Hourly window rate limit (max 5 per hour)
      const maxPerWindowStr = await this.settingsService.getString('SECURITY_OTP_MAX_PER_WINDOW', '5');
      const windowSecondsStr = await this.settingsService.getString('SECURITY_OTP_WINDOW_SECONDS', '3600');
      const maxPerWindow = parseInt(maxPerWindowStr, 10) || 5;
      const windowMs = (parseInt(windowSecondsStr, 10) || 3600) * 1000;

      const windowKey = `reset_otp_window_count:${normalizedEmail}`;
      const requestCount = (await this.cacheManager.get<number>(windowKey)) || 0;
      if (requestCount >= maxPerWindow) {
        if (requestCount === maxPerWindow) {
          await this.telegramService.sendOtpLimitAlert({
            email: normalizedEmail,
            requestCount: requestCount + 1,
            limit: maxPerWindow,
            timeWindow: `${Math.round(windowMs / 60000)} minutes`,
          });
          await this.cacheManager.set(windowKey, requestCount + 1, windowMs);
        }
        return { success: false, message: 'Too many password reset attempts. Please try again later.' };
      }
      await this.cacheManager.set(windowKey, requestCount + 1, windowMs);

      const otp = this.generateOtp();
      await this.cacheManager.set(otpKey, otp, EmailService.OTP_TTL_MS);
      await this.cacheManager.set(cooldownKey, true, EmailService.RESEND_COOLDOWN_MS);

      if (!this.resend) {
        this.logger.warn(`[DEV] Mock Reset OTP for ${normalizedEmail}: ${otp}`);
        return { success: true, message: 'Reset code generated (Mock)' };
      }

      const { error } = await this.resend.emails.send({
        from: `MedPark <${this.fromEmail}>`,
        to: normalizedEmail,
        subject: 'Reset Your Password - MedPark',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password. Use the recovery code below to complete the process. This code is valid for 10 minutes and is not case-sensitive.</p>
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <strong style="font-family: 'Courier New', Consolas, monospace; font-size: 28px; letter-spacing: 6px; color: #ef4444;">${otp}</strong>
            </div>
            <p>If you did not request this, please ensure your account is secure. You can ignore this email.</p>
          </div>
        `,
      });

      if (error) {
        this.logger.error(`Failed to send reset email to ${normalizedEmail}: ${error.message}`);
        return { success: false, message: 'Failed to send reset email' };
      }

      this.trackGlobalOtpSend('reset').catch(() => {});
      return { success: true, message: 'Reset code sent successfully' };
    } catch (err: any) {
      this.logger.error(`Error sending reset email to ${email}: ${err.message}`);
      return { success: false, message: 'An error occurred' };
    }
  }

  /**
   * Verifies the password reset OTP.
   */
  async verifyResetOtp(email: string, code: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase();
    const otpKey = `reset_otp:${normalizedEmail}`;
    const attemptsKey = `reset_otp_attempts:${normalizedEmail}`;

    const storedOtp = await this.cacheManager.get<string>(otpKey);
    const attempts = (await this.cacheManager.get<number>(attemptsKey)) || 0;

    if (attempts >= EmailService.MAX_OTP_ATTEMPTS) {
      this.logger.warn(`Brute force attempt detected for reset code: ${normalizedEmail}`);
      return false;
    }

    if (!storedOtp) return false;

    // Case-insensitive + whitespace-tolerant comparison. See verifyOtp() for
    // the full rationale.
    const normalizedInput = this.normalizeOtpInput(code);
    const storedBuf = Buffer.from(storedOtp);
    const codeBuf = Buffer.from(normalizedInput);
    const isMatch =
      storedBuf.length === codeBuf.length &&
      timingSafeEqual(storedBuf, codeBuf);
    if (isMatch) {
      await this.cacheManager.del(otpKey);
      await this.cacheManager.del(attemptsKey);
      return true;
    }

    // Increment failed attempts
    await this.cacheManager.set(attemptsKey, attempts + 1, EmailService.OTP_TTL_MS);
    return false;
  }
}
