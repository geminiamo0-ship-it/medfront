import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { User } from "../entities/user.entity";
import { AffiliateReferral } from "../entities/affiliate-referral.entity";
import {
  PendingPayment,
  PaymentStatus,
} from "../entities/pending-payment.entity";
import { PricingPlan } from "../entities/pricing-plan.entity";

@Injectable()
export class AffiliateService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AffiliateReferral)
    private referralRepository: Repository<AffiliateReferral>,
    @InjectRepository(PendingPayment)
    private pendingPaymentRepository: Repository<PendingPayment>,
    @InjectRepository(PricingPlan)
    private pricingPlanRepository: Repository<PricingPlan>,
  ) {}

  // ─────────────────────────────────────────────
  // Generate a unique affiliate code for a user
  // ─────────────────────────────────────────────
  private async generateUniqueCode(): Promise<string> {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code: string;
    let exists = true;

    while (exists) {
      const random = Array.from(
        { length: 6 },
        () => chars[Math.floor(Math.random() * chars.length)],
      ).join("");
      code = `MP-${random}`;
      const found = await this.userRepository.findOne({
        where: { affiliateCode: code },
      });
      exists = !!found;
    }
    return code!;
  }

  async getOrCreateAffiliateCode(userId: number): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    if (user.affiliateCode) return user.affiliateCode;

    const code = await this.generateUniqueCode();
    user.affiliateCode = code;
    await this.userRepository.save(user);
    return code;
  }

  async validateReferralCodeForRegistration(code: string) {
    const normalizedCode = code.toUpperCase().trim();
    if (!normalizedCode) {
      throw new BadRequestException("Referral code cannot be empty.");
    }

    const referrer = await this.userRepository.findOne({
      where: { affiliateCode: normalizedCode },
    });

    if (!referrer) {
      throw new BadRequestException(
        "Invalid referral code. Please check and try again.",
      );
    }

    return referrer;
  }
  // ─────────────────────────────────────────────
  // Get affiliate stats for a user
  // ─────────────────────────────────────────────
  async getMyAffiliateStats(userId: number, page = 1, pageSize = 20) {
    const affiliateCode = await this.getOrCreateAffiliateCode(userId);

    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const skip = (safePage - 1) * safePageSize;

    const [paidReferrals, totalPaid] =
      await this.referralRepository.findAndCount({
        where: { referrerId: userId, hasPaid: true },
        relations: ["referredUser"],
        order: { paidAt: "DESC", createdAt: "DESC" },
        take: safePageSize,
        skip,
      });

    const referredUserIds = paidReferrals
      .map((referral) => referral.referredUserId)
      .filter((id) => Number.isFinite(id));

    const confirmedPayments = referredUserIds.length
      ? await this.pendingPaymentRepository.find({
          where: {
            userId: In(referredUserIds),
            status: PaymentStatus.CONFIRMED,
          },
          order: { confirmedAt: "DESC", createdAt: "DESC" },
        })
      : [];

    const paymentByUserId = new Map<number, PendingPayment>();
    for (const payment of confirmedPayments) {
      if (!paymentByUserId.has(payment.userId)) {
        paymentByUserId.set(payment.userId, payment);
      }
    }

    const planCodes = Array.from(
      new Set(
        confirmedPayments
          .map((payment) => payment.planCode)
          .filter((code): code is string => !!code),
      ),
    );

    const plans = planCodes.length
      ? await this.pricingPlanRepository.find({
          where: { code: In(planCodes) },
        })
      : [];
    const planByCode = new Map(plans.map((plan) => [plan.code, plan]));

    const totalProfitRow = await this.referralRepository
      .createQueryBuilder("referral")
      .select("COALESCE(SUM(referral.commissionAmount), 0)", "totalProfit")
      .where("referral.referrer_id = :userId", { userId })
      .andWhere("referral.has_paid = true")
      .getRawOne<{ totalProfit: string }>();

    const totalProfit = parseFloat(totalProfitRow?.totalProfit || "0");

    // Check if this user has an applied referral code (discount info)
    const user = await this.userRepository.findOne({ where: { id: userId } });
    let appliedCode = user?.appliedReferralCode || null;
    if (!appliedCode && user?.referredByUserId) {
      const referrer = await this.userRepository.findOne({
        where: { id: user.referredByUserId },
      });
      appliedCode = referrer?.affiliateCode || null;
    }

    const hasAppliedCode = !!(appliedCode || user?.referredByUserId);
    const activeDiscountPercent = hasAppliedCode
      ? await this.getReferralDiscountPercent(userId)
      : 0;
    const personalCouponDiscountPercent = Number(
      user?.affiliateDiscountPercent ?? 5,
    );
    const personalCommissionPercent = Number(
      user?.affiliateCommissionPercent ?? 5,
    );

    return {
      success: true,
      data: {
        affiliateCode,
        totalPaid,
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        referrals: {
          items: paidReferrals.map((referral) => {
            const payment = paymentByUserId.get(referral.referredUserId);
            const plan =
              payment?.planCode ? planByCode.get(payment.planCode) : null;
            const currency =
              payment?.currency || plan?.currency || "USD";

            return {
              id: referral.id,
              hasPaid: referral.hasPaid,
              commissionAmount:
                referral.commissionAmount !== null &&
                referral.commissionAmount !== undefined
                  ? Number(referral.commissionAmount)
                  : null,
              createdAt: referral.createdAt,
              paidAt: referral.paidAt,
              planCode: payment?.planCode || null,
              planName: payment?.planName || plan?.name || null,
              planOriginalPrice:
                plan?.realPrice !== undefined && plan?.realPrice !== null
                  ? Number(plan.realPrice)
                  : null,
              paidAmount:
                payment?.amount !== undefined && payment?.amount !== null
                  ? Number(payment.amount)
                  : null,
              paidCurrency: currency,
              referredUser: referral.referredUser
                ? {
                    id: referral.referredUser.id,
                    name: referral.referredUser.name,
                    email: referral.referredUser.email,
                    nickname: referral.referredUser.nickname,
                  }
                : null,
            };
          }),
          total: totalPaid,
          page: safePage,
          pageSize: safePageSize,
        },
        // Info about the referral code this user used (if any)
        appliedReferralCode: appliedCode,
        hasAppliedCode,
        discountPercent: activeDiscountPercent,
        isReferralDiscountEligible: hasAppliedCode,
        personalCouponDiscountPercent,
        commissionPercent: personalCommissionPercent,
      },
    };
  }

  // ─────────────────────────────────────────────
  // Handle new registration with an affiliate code
  // ─────────────────────────────────────────────
  async handleRegistrationWithCode(
    newUserId: number,
    affiliateCode: string,
  ): Promise<void> {
    try {
      const referrer = await this.userRepository.findOne({
        where: { affiliateCode: affiliateCode.toUpperCase() },
      });

      if (!referrer || referrer.id === newUserId) return; // Invalid code or self-referral

      // Update the new user with referral info
      await this.userRepository.update(newUserId, {
        referredByUserId: referrer.id,
        appliedReferralCode: affiliateCode.toUpperCase(),
      });

      // Create referral tracking row
      const existingReferral = await this.referralRepository.findOne({
        where: { referredUserId: newUserId },
      });
      if (!existingReferral) {
        const referral = this.referralRepository.create({
          referrerId: referrer.id,
          referredUserId: newUserId,
          hasPaid: false,
        });
        await this.referralRepository.save(referral);
      }
    } catch (err) {
      // Non-blocking — don't fail registration if affiliate logic errors
      console.error(
        "[AffiliateService] handleRegistrationWithCode error:",
        err,
      );
    }
  }

  // ─────────────────────────────────────────────
  // Apply a referral code post-registration
  // ─────────────────────────────────────────────
  async applyReferralCode(
    userId: number,
    code: string,
  ): Promise<{ success: boolean; message: string }> {
    const normalizedCode = code.toUpperCase().trim();

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    if (user.appliedReferralCode || user.referredByUserId) {
      throw new BadRequestException(
        "You have already applied a referral code to your account.",
      );
    }

    const referrer = await this.userRepository.findOne({
      where: { affiliateCode: normalizedCode },
    });

    if (!referrer) {
      throw new BadRequestException(
        "Invalid referral code. Please check and try again.",
      );
    }

    if (referrer.id === userId) {
      throw new BadRequestException("You cannot use your own referral code.");
    }

    // Update user
    await this.userRepository.update(userId, {
      referredByUserId: referrer.id,
      appliedReferralCode: normalizedCode,
    });

    // Create or update referral row
    const existingReferral = await this.referralRepository.findOne({
      where: { referredUserId: userId },
    });
    if (!existingReferral) {
      const referral = this.referralRepository.create({
        referrerId: referrer.id,
        referredUserId: userId,
        hasPaid: false,
      });
      await this.referralRepository.save(referral);
    }

    return {
      success: true,
      message: `Referral code applied! You'll receive a ${referrer.affiliateDiscountPercent ?? 5}% discount on your next premium subscription.`,
    };
  }

  // Safely link a referral when a promo code has an owner.
  // This should not throw or block payment flows.
  async linkReferralForPromoOwner(
    userId: number,
    referrerId: number,
    fallbackCode?: string | null,
  ): Promise<void> {
    if (!referrerId || referrerId === userId) return;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;

    if (user.appliedReferralCode || user.referredByUserId) return;

    const referrer = await this.userRepository.findOne({
      where: { id: referrerId },
    });
    if (!referrer) return;

    const appliedCode = referrer.affiliateCode || fallbackCode || null;
    await this.userRepository.update(userId, {
      referredByUserId: referrer.id,
      appliedReferralCode: appliedCode,
    });

    const existingReferral = await this.referralRepository.findOne({
      where: { referredUserId: userId },
    });
    if (!existingReferral) {
      const referral = this.referralRepository.create({
        referrerId: referrer.id,
        referredUserId: userId,
        hasPaid: false,
      });
      await this.referralRepository.save(referral);
    }
  }

  async clearReferralCode(userId: number): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    if (!user.appliedReferralCode && !user.referredByUserId) {
      return { success: true, message: "No referral code to clear." };
    }

    const referral = await this.referralRepository.findOne({
      where: { referredUserId: userId },
    });
    if (referral?.hasPaid) {
      throw new BadRequestException(
        "Referral cannot be removed after payment is approved.",
      );
    }

    if (referral) {
      await this.referralRepository.remove(referral);
    }

    await this.userRepository.update(userId, {
      referredByUserId: null,
      appliedReferralCode: null,
    });

    return { success: true, message: "Referral code cleared." };
  }

  // ─────────────────────────────────────────────
  // Called when a payment is confirmed — credit commission
  // ─────────────────────────────────────────────
  async handlePaymentConfirmed(
    paidUserId: number,
    amountPaid: number,
  ): Promise<void> {
    try {
      const referral = await this.referralRepository.findOne({
        where: { referredUserId: paidUserId },
      });

      if (!referral || referral.hasPaid) return; // No referral or already credited

      const referrer = await this.userRepository.findOne({
        where: { id: referral.referrerId },
      });
      const commissionPercent = Number(
        referrer?.affiliateCommissionPercent ?? 5,
      );
      const commission = parseFloat(
        (amountPaid * (commissionPercent / 100)).toFixed(2),
      );

      referral.hasPaid = true;
      referral.commissionAmount = commission;
      referral.paidAt = new Date();
      await this.referralRepository.save(referral);

      console.log(
        `[AffiliateService] Commission of $${commission} credited to referrer ID ${referral.referrerId}`,
      );
    } catch (err) {
      console.error("[AffiliateService] handlePaymentConfirmed error:", err);
    }
  }

  // ─────────────────────────────────────────────
  // Returns the referral discount % for a user (used at payment initiation)
  // ─────────────────────────────────────────────
  async getReferralDiscountPercent(userId: number): Promise<number> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.appliedReferralCode) {
      return 0;
    }

    if (user.referredByUserId) {
      const referrer = await this.userRepository.findOne({
        where: { id: user.referredByUserId },
      });
      if (referrer) {
        return Number(referrer.affiliateDiscountPercent ?? 5);
      }
    }

    const referrer = await this.userRepository.findOne({
      where: { affiliateCode: user.appliedReferralCode },
    });
    return Number(referrer?.affiliateDiscountPercent ?? 5);
  }
}
