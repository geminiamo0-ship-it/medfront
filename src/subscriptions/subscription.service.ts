import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, SubscriptionPlan } from '../entities/user.entity';
import { QuestionBank, getStepLabel } from '../entities/question-bank.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SettingsService } from '../settings/settings.service';
import { authUserCacheKey, userSettingsCacheKey } from '../cache/cache-keys.util';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(QuestionBank)
    private questionBankRepository: Repository<QuestionBank>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    private readonly settingsService: SettingsService,
  ) {}

  async getTrialDays(): Promise<number> {
    return this.settingsService.getNumber('FREE_TRIAL_DAYS', 7);
  }

  async getSubscriptionStatus(user: User) {
    // ✅ No database query needed - user object is passed from controller
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const now = new Date();
    const trialDays = await this.getTrialDays();
    const trialStatus = this.checkTrialStatus(user, trialDays);
    const hasActiveSubscription = this.hasActiveSubscription(user);

    let subscriptionDaysLeft = 0;
    if (user.subscriptionExpiry) {
      const diffTime = user.subscriptionExpiry.getTime() - now.getTime();
      subscriptionDaysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    // Compute effective trial end from trialStartDate + current setting (retroactive)
    const effectiveTrialEnd = user.trialStartDate
      ? new Date(user.trialStartDate.getTime() + trialDays * 24 * 60 * 60 * 1000)
      : null;

    return {
      success: true,
      data: {
        plan: user.subscriptionPlan,
        expiryDate: user.subscriptionExpiry,
        subscriptionDaysLeft,
        isActive: hasActiveSubscription,
        trial: {
          isInTrial: trialStatus.isInTrial,
          hasExpired: trialStatus.hasExpired,
          daysLeft: trialStatus.daysLeft,
          startDate: user.trialStartDate,
          endDate: effectiveTrialEnd,
        },
      },
    };
  }

  /**
   * Compute trial status using effectiveTrialEnd = trialStartDate + trialDays.
   * trialDays comes from the DB setting (retroactive) so admin changes affect all users.
   * The stored user.trialEndDate is NOT used for access decisions.
   */
  checkTrialStatus(
    user: User,
    trialDays?: number,
  ): {
    isInTrial: boolean;
    daysLeft: number;
    hasExpired: boolean;
  } {
    const now = new Date();

    if (!user.trialStartDate) {
      return { isInTrial: false, daysLeft: 0, hasExpired: false };
    }

    // Use provided trialDays or fall back to stored trialEndDate for sync calls
    let effectiveTrialEnd: Date;
    if (trialDays !== undefined) {
      effectiveTrialEnd = new Date(
        user.trialStartDate.getTime() + trialDays * 24 * 60 * 60 * 1000,
      );
    } else if (user.trialEndDate) {
      // Synchronous fallback: use stored end date (won't be retroactive)
      effectiveTrialEnd = user.trialEndDate;
    } else {
      return { isInTrial: false, daysLeft: 0, hasExpired: false };
    }

    const isInTrial = now < effectiveTrialEnd;
    const hasExpired = now >= effectiveTrialEnd;

    let daysLeft = 0;
    if (isInTrial) {
      const diffTime = effectiveTrialEnd.getTime() - now.getTime();
      daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    return { isInTrial, daysLeft, hasExpired };
  }

  hasActiveSubscription(user: User): boolean {
    if (!user.subscriptionExpiry) return false;
    const now = new Date();
    return user.subscriptionExpiry > now && user.subscriptionPlan !== SubscriptionPlan.FREE;
  }
  async hasAccessToStep(
    user: User,
    stepNumber: number,
  ): Promise<{ hasAccess: boolean; reason: string; requiresUpgrade: boolean }> {
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hasActiveSubscription = this.hasActiveSubscription(user);

    // ✅ Subscribed users can access all steps
    if (hasActiveSubscription) {
      return { hasAccess: true, reason: 'Access granted by subscription', requiresUpgrade: false };
    }

    // 🆓 If the step has any free (isPremium=false) banks, allow through
    // Gate 2 (evaluateQuestionBankAccess) will enforce access per individual bank
    const freeBankCount = await this.questionBankRepository.count({
      where: { step: stepNumber as any, isPremium: false, isActive: true },
    });

    if (freeBankCount > 0) {
      return { hasAccess: true, reason: 'Step has free banks available', requiresUpgrade: false };
    }

    // 🚫 No subscription and no free banks in this step
    const trialDays = await this.getTrialDays();
    const trialStatus = this.checkTrialStatus(user, trialDays);
    const reason = this.buildStepAccessDeniedReason(stepNumber, trialStatus);
    return { hasAccess: false, reason, requiresUpgrade: true };
  }

  async hasAccessToQuestionBank(
    user: User,
    questionBankIdentifier: string | number,
  ): Promise<{ hasAccess: boolean; reason: string; requiresUpgrade: boolean }> {
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const where: any = { isActive: true };
    if (typeof questionBankIdentifier === 'number') {
      where.id = questionBankIdentifier;
    } else {
      where.code = questionBankIdentifier;
    }

    const bank = await this.questionBankRepository.findOne({ where });

    if (!bank) {
      return { hasAccess: false, reason: 'Question bank not found', requiresUpgrade: false };
    }

    const trialDays = await this.getTrialDays();
    return this.evaluateQuestionBankAccess(user, bank, trialDays);
  }

  evaluateQuestionBankAccess(
    user: User,
    bank: Pick<QuestionBank, 'name' | 'isPremium'>,
    trialDays?: number,
  ): { hasAccess: boolean; reason: string; requiresUpgrade: boolean } {
    const trialStatus = this.checkTrialStatus(user, trialDays);
    const hasActiveSubscription = this.hasActiveSubscription(user);

    if (bank.isPremium) {
      // Premium banks require an active subscription — trial does not grant premium access
      if (hasActiveSubscription) {
        return { hasAccess: true, reason: 'Access granted by subscription', requiresUpgrade: false };
      }

      if (trialStatus.hasExpired) {
        return {
          hasAccess: false,
          reason: 'Trial expired. Please subscribe to continue.',
          requiresUpgrade: true,
        };
      }

      return {
        hasAccess: false,
        reason: `${bank.name} requires a premium subscription.`,
        requiresUpgrade: true,
      };
    }

    // Free banks: accessible to all logged-in users (no trial or subscription required)
    return { hasAccess: true, reason: 'Access granted (Free Bank)', requiresUpgrade: false };
  }

  buildStepAccessDeniedReason(
    stepNumber: number,
    trialStatus: { isInTrial: boolean; daysLeft: number; hasExpired: boolean },
  ): string {
    const stepLabel = getStepLabel(stepNumber);
    if (trialStatus.hasExpired) {
      return 'Trial expired. Please subscribe to continue.';
    }
    return `${stepLabel} requires an active subscription.`;
  }

  /**
   * Centralized logic to get allowed question bank IDs for a user and step.
   * Dynamically fetches bank IDs based on user plan and bank isPremium status.
   * Non-premium (free) banks are accessible during an active trial.
   * Premium banks require an active subscription.
   */
  async getAllowedQuestionBankIds(user: User, step: number): Promise<number[]> {
    const trialDays = await this.getTrialDays();
    const trialStatus = this.checkTrialStatus(user, trialDays);
    const hasActiveSubscription = this.hasActiveSubscription(user);

    const query = this.questionBankRepository.createQueryBuilder('qb')
      .select('qb.id')
      .where('qb.isActive = :isActive', { isActive: true })
      .andWhere('qb.step = :step', { step });

    if (!hasActiveSubscription) {
      // Non-subscribers can only access free (isPremium=false) banks
      query.andWhere('qb.isPremium = :isPremium', { isPremium: false });
    }

    const banks = await query.getMany();
    return banks.map(b => b.id);
  }

  async activateSubscription(
    userId: number,
    plan: string,
    durationMonths: number,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const now = new Date();
    const expiryDate = new Date(now.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);

    user.subscriptionPlan = plan as SubscriptionPlan;
    user.subscriptionStartDate = now;
    user.subscriptionExpiry = expiryDate;
    user.hasUsedTrial = true; // Mark trial as used when they subscribe

    await this.userRepository.save(user);
    await this.refreshUserCache(userId);

    return {
      success: true,
      message: `${plan} subscription activated successfully until ${expiryDate.toISOString()}`,
    };
  }

  async cancelSubscription(userId: number): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Keep access until expiry, but set plan to FREE so it won't auto-renew
    user.subscriptionPlan = SubscriptionPlan.FREE;

    await this.userRepository.save(user);
    await this.refreshUserCache(userId);

    return {
      success: true,
      message: `Subscription cancelled. Access will continue until ${user.subscriptionExpiry?.toISOString() || 'expiry date'}`,
    };
  }

  /**
   * Admin override: set a user's subscription plan and expiry.
   * - If expiryDate is provided, it is used directly.
   * - If durationMonths === 0, a lifetime expiry (year 9999) is assigned.
   * - Otherwise, expiry = now + durationMonths months.
   */
  async adminUpdateSubscription(
    userId: number,
    plan: string,
    expiryDate?: string,
    durationMonths?: number,
  ): Promise<{ success: boolean; message: string; expiryDate: Date }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const now = new Date();
    let expiry: Date;

    if (expiryDate) {
      // Admin provided a specific expiry date
      expiry = new Date(expiryDate);
      if (isNaN(expiry.getTime())) {
        throw new Error('Invalid expiry date format');
      }
    } else if (durationMonths === 0) {
      // Lifetime: far future
      expiry = new Date('9999-12-31T23:59:59Z');
    } else {
      const months = durationMonths ?? 1;
      expiry = new Date(now);
      expiry.setMonth(expiry.getMonth() + months);
    }

    user.subscriptionPlan = plan as SubscriptionPlan;
    user.subscriptionStartDate = now;
    user.subscriptionExpiry = expiry;
    user.hasUsedTrial = true;

    await this.userRepository.save(user);
    await this.refreshUserCache(userId);

    return {
      success: true,
      message: `Subscription updated to ${plan} until ${expiry.toISOString()}`,
      expiryDate: expiry,
    };
  }

  /**
   * Admin revoke: immediately set the user back to Free with no expiry.
   */
  async adminRevokeSubscription(
    userId: number,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.subscriptionPlan = SubscriptionPlan.FREE;
    user.subscriptionExpiry = null;
    user.subscriptionStartDate = null;

    await this.userRepository.save(user);
    await this.refreshUserCache(userId);

    return {
      success: true,
      message: 'Subscription revoked. User is now on the Free plan.',
    };
  }

  async refreshUserCache(userId: number) {
    try {
      await Promise.all([
        this.cacheManager.del(authUserCacheKey(userId)),
        this.cacheManager.del(userSettingsCacheKey(userId)),
      ]);
    } catch (cacheError) {
      console.error('[SubscriptionService] Cache clear error:', cacheError);
    }
  }
}
