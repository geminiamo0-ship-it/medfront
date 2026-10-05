import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, QueryFailedError, Repository } from "typeorm";
import { randomInt } from "crypto";
import {
  PendingPayment,
  PaymentStatus,
  SubscriptionDuration,
} from "../entities/pending-payment.entity";
import { PaymentApproval } from "../entities/payment-approval.entity";
import { User } from "../entities/user.entity";
import { PromoCode } from "../entities/promo-code.entity";
import { PricingPlan } from "../entities/pricing-plan.entity";
import { WalletLedgerEntry } from "../entities/wallet-ledger-entry.entity";
import { Wallet } from "../entities/wallet.entity";
import { SubscriptionService } from "../subscriptions/subscription.service";
import { AffiliateService } from "../affiliate/affiliate.service";
import { AdminNotificationsService } from "../admin/admin-notifications.service";
import { TelegramService } from "../integrations/telegram.service";

@Injectable()
export class ManualPaymentService {
  private readonly logger = new Logger(ManualPaymentService.name);
  private readonly approvalsRequired = 1;
  private readonly approvalTags = [
    "paid",
    "marketing",
    "partner",
    "internal",
    "other",
  ];

  constructor(
    @InjectRepository(PendingPayment)
    private pendingPaymentRepository: Repository<PendingPayment>,
    @InjectRepository(PaymentApproval)
    private paymentApprovalRepository: Repository<PaymentApproval>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(PromoCode)
    private promoCodeRepository: Repository<PromoCode>,
    @InjectRepository(PricingPlan)
    private pricingPlanRepository: Repository<PricingPlan>,
    @InjectRepository(WalletLedgerEntry)
    private walletLedgerRepository: Repository<WalletLedgerEntry>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    private subscriptionService: SubscriptionService,
    private affiliateService: AffiliateService,
    private adminNotificationsService: AdminNotificationsService,
    private telegramService: TelegramService,
  ) {}

  async initiatePayment(
    userId: number,
    planCode: string,
    telegramUsername?: string,
    promoCode?: string,
    currency?: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const pricingPlan = await this.pricingPlanRepository.findOne({
      where: { code: planCode, isActive: true },
    });

    if (!pricingPlan) {
      throw new BadRequestException("Selected plan is not available");
    }

    // Check if user already has a pending payment for the same plan + duration
    const existingPending = await this.pendingPaymentRepository.count({
      where: {
        userId,
        planCode: pricingPlan.code,
        status: PaymentStatus.PENDING,
      },
    });

    if (existingPending >= 1) {
      throw new BadRequestException(
        "You already have a pending payment request for this plan. Please cancel it before creating a new one.",
      );
    }

    // Validate promo code and get discount
    let discountPercent = 0;
    let promoSnapshot: {
      promoCodeId: number | null;
      promoCodeOwnerUserId: number | null;
      promoCodeValue: string | null;
      promoCodeDiscountPercent: number | null;
    } = {
      promoCodeId: null,
      promoCodeOwnerUserId: null,
      promoCodeValue: null,
      promoCodeDiscountPercent: null,
    };

    let promoOwnerEmail: string | null = null;

    if (promoCode) {
      const normalizedCode = promoCode.toUpperCase().trim();
      const promo = await this.promoCodeRepository.findOne({
        where: { code: normalizedCode },
      });
      if (promo) {
        if (!promo.isValid()) {
          throw new BadRequestException("Invalid or expired promo code");
        }
        discountPercent = promo.discountPercent;
        promoSnapshot = {
          promoCodeId: promo.id,
          promoCodeOwnerUserId: promo.ownerUserId,
          promoCodeValue: promo.code,
          promoCodeDiscountPercent: promo.discountPercent,
        };

        if (promo.ownerUserId) {
          const owner = await this.userRepository.findOne({ where: { id: promo.ownerUserId }, select: ["email"] });
          promoOwnerEmail = owner?.email ?? null;
        }

        // Increment used count
        await this.promoCodeRepository.increment(
          { id: promo.id },
          "usedCount",
          1,
        );

        if (promo.ownerUserId) {
          await this.affiliateService.linkReferralForPromoOwner(
            userId,
            promo.ownerUserId,
            promo.code,
          );
        }
      } else {
        // Not a promo code; try affiliate referral code (post-registration)
        const referrer = await this.userRepository.findOne({
          where: { affiliateCode: normalizedCode },
        });

        if (!referrer) {
          throw new BadRequestException("Invalid or expired promo code");
        }

        if (!user.appliedReferralCode) {
          await this.affiliateService.applyReferralCode(userId, normalizedCode);
        }
      }
    }

    // Base price comes from discounted price
    let amount = Number(pricingPlan.discountedPrice);
    let finalCurrency = pricingPlan.currency || "USD";

    if (currency && pricingPlan.regionalPrices && pricingPlan.regionalPrices.length > 0) {
      const regional = pricingPlan.regionalPrices.find(r => r.currency === currency);
      if (regional) {
        amount = Number(regional.discountedPrice);
        finalCurrency = regional.currency;
      }
    }

    // Apply promo code discount if any
    if (discountPercent > 0) {
      amount = parseFloat((amount * (1 - discountPercent / 100)).toFixed(2));
    }

    const referralDiscountPercent =
      await this.affiliateService.getReferralDiscountPercent(userId);
    if (referralDiscountPercent > 0) {
      amount = parseFloat(
        (amount * (1 - referralDiscountPercent / 100)).toFixed(2),
      );
    }

    // Save with a generated payment reference, retrying on UNIQUE-violation
    // (eliminates the prior TOCTOU race between the pre-check and the INSERT).
    const pendingPayment = await this.saveWithUniqueReference((paymentReference) =>
      this.pendingPaymentRepository.create({
        userId,
        plan: pricingPlan.tier,
        planCode: pricingPlan.code,
        planName: pricingPlan.name,
        duration: pricingPlan.durationLabel as SubscriptionDuration,
        amount,
        currency: finalCurrency,
        paymentReference,
        ...promoSnapshot,
        telegramUsername,
        status: PaymentStatus.PENDING,
      }),
    );
    const paymentReference = pendingPayment.paymentReference;

    await this.adminNotificationsService.createAdminNotification({
      title: "New payment request",
      message: `${user.email} requested ${pricingPlan.name} – ${finalCurrency} ${amount}`,
      metadata: {
        paymentId: pendingPayment.id,
        paymentReference,
        userId,
        planCode: pricingPlan.code,
        planName: pricingPlan.name,
        amount,
      },
    });

    // Fresh query to reliably get referral code (avoids TypeORM identity-map stale reads)
    const freshUser = await this.userRepository.findOne({ where: { id: userId }, select: ['id', 'appliedReferralCode'] });
    const appliedReferralCode = freshUser?.appliedReferralCode || null;
    void this.telegramService
      .sendAdminPaymentAlert({
        userEmail: user.email,
        telegramUsername: pendingPayment.telegramUsername || telegramUsername || null,
        planName: pricingPlan.name,
        amount,
        currency: finalCurrency,
        paymentReference,
        paymentId: pendingPayment.id,
        promoCodeValue: pendingPayment.promoCodeValue || null,
        promoCodeDiscountPercent: pendingPayment.promoCodeDiscountPercent || null,
        promoCodeOwnerEmail: promoOwnerEmail,
        referralCode: !pendingPayment.promoCodeValue ? appliedReferralCode : null,
      })
      .catch((err) => console.error('[TelegramAlert] Error:', err?.message));

    return {
      success: true,
      data: {
        paymentId: pendingPayment.id,
        paymentReference,
        amount,
        currency: finalCurrency,
        plan: pricingPlan.tier,
        planCode: pricingPlan.code,
        planName: pricingPlan.name,
        duration: pricingPlan.durationLabel,
        discountApplied: discountPercent > 0 ? `${discountPercent}%` : null,
        referralDiscountApplied:
          referralDiscountPercent > 0
            ? `${referralDiscountPercent}% (Referral Discount)`
            : null,
        telegramChannel:
          process.env.TELEGRAM_PAYMENT_CHANNEL || "@MedParkPayments",
        instructions: [
          "1. Contact our support via Telegram using the button below.",
          "2. Send your Payment Reference ID to the support agent.",
          `3. Complete the payment of ${amount} ${finalCurrency}.`,
          "4. Once verified, your premium access will be activated immediately.",
          "5. You can also upload a screenshot of your transaction here for faster processing.",
        ],
      },
    };
  }

  async verifyPromoCode(userId: number, code: string) {
    const normalizedCode = code.toUpperCase().trim();
    const promo = await this.promoCodeRepository.findOne({
      where: { code: normalizedCode },
    });

    if (promo) {
      if (!promo.isValid()) {
        throw new BadRequestException("Invalid or expired promo code");
      }
      return {
        success: true,
        discountPercent: promo.discountPercent,
        message: `Promo code applied: ${promo.discountPercent}% discount!`,
        type: "promo",
      };
    }

    const referrer = await this.userRepository.findOne({
      where: { affiliateCode: normalizedCode },
    });
    if (!referrer) {
      throw new BadRequestException("Invalid or expired promo code");
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (
      user.appliedReferralCode &&
      user.appliedReferralCode !== normalizedCode
    ) {
      throw new BadRequestException(
        "You already applied a referral code. Remove it before using another.",
      );
    }

    return {
      success: true,
      discountPercent: referrer.affiliateDiscountPercent ?? 5,
      message: `Referral code applied: ${referrer.affiliateDiscountPercent ?? 5}% discount!`,
      type: "referral",
    };
  }

  async getPendingPayments(userId: number) {
    const payments = await this.pendingPaymentRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });

    return {
      success: true,
      data: payments,
    };
  }

  async cancelPayment(userId: number, paymentId: number) {
    const payment = await this.pendingPaymentRepository.findOne({
      where: { id: paymentId, userId },
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException("Payment is not pending");
    }

    payment.status = PaymentStatus.CANCELLED;
    await this.pendingPaymentRepository.save(payment);

    try {
      await this.affiliateService.clearReferralCode(userId);
    } catch (err) {
      // Ignore if referral can't be cleared (e.g., already paid)
      console.warn("[ManualPayment] Referral clear skipped:", err?.message || err);
    }

    return {
      success: true,
      message: "Payment request cancelled",
    };
  }

  async uploadPaymentProof(
    userId: number,
    paymentId: number,
    proofImageUrl: string,
  ) {
    const payment = await this.pendingPaymentRepository.findOne({
      where: { id: paymentId, userId },
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException("Payment is not pending");
    }

    payment.proofImageUrl = proofImageUrl;
    await this.pendingPaymentRepository.save(payment);

    return {
      success: true,
      message: "Payment proof uploaded successfully",
    };
  }

  private normalizeApprovalTag(tag?: string) {
    if (!tag) return null;
    const normalized = tag.toLowerCase().trim();
    return this.approvalTags.includes(normalized) ? normalized : null;
  }

  async approvePayment(
    paymentId: number,
    adminId: number,
    approvalTag?: string,
    approvalNote?: string,
    walletId?: number,
    actualAmount?: number,
    approvalCurrency?: string,
    commissionAmount?: number,
  ) {
    const payment = await this.pendingPaymentRepository.findOne({
      where: { id: paymentId },
      relations: ["user"],
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    if (payment.status === PaymentStatus.REJECTED) {
      throw new BadRequestException("Payment has been rejected");
    }

    if (payment.status === PaymentStatus.CONFIRMED) {
      throw new BadRequestException("Payment is already confirmed");
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException("Payment is not pending");
    }

    const normalizedTag = this.normalizeApprovalTag(approvalTag);
    if (!normalizedTag) {
      throw new BadRequestException("Approval tag is required");
    }

    // Commission is required when the payment used a coupon or referral code
    const hasDiscount = !!(payment.promoCodeId || payment.user?.appliedReferralCode);
    const commissionMissing = commissionAmount === undefined || commissionAmount === null || !Number.isFinite(Number(commissionAmount));
    if (hasDiscount && commissionMissing) {
      const source = payment.promoCodeId
        ? `coupon "${payment.promoCodeValue}"`
        : `referral code "${payment.user?.appliedReferralCode}"`;
      throw new BadRequestException(
        `Commission amount is required because this payment used ${source}. Enter 0 if no commission applies.`,
      );
    }

    // Commission must not exceed the collected amount
    if (commissionAmount !== undefined && commissionAmount !== null && Number.isFinite(Number(commissionAmount))) {
      const collectedAmount = actualAmount !== undefined && Number.isFinite(actualAmount) ? actualAmount : Number(payment.amount);
      if (Number(commissionAmount) > collectedAmount + 0.001) {
        throw new BadRequestException(
          `Commission (${Number(commissionAmount).toFixed(2)}) cannot exceed the collected amount (${collectedAmount.toFixed(2)})`,
        );
      }
    }

    payment.approvalTag = normalizedTag;
    if (approvalNote !== undefined) {
      payment.approvalNote = approvalNote?.trim() || null;
    }
    // Store finance suite fields
    if (walletId !== undefined) payment.walletId = walletId;
    if (actualAmount !== undefined && Number.isFinite(actualAmount)) {
      payment.actualAmount = actualAmount;
      payment.actualAmountUpdatedBy = adminId;
      payment.actualAmountUpdatedAt = new Date();
    }
    if (approvalCurrency) payment.approvalCurrency = approvalCurrency.toUpperCase();
    if (commissionAmount !== undefined) payment.commissionAmount = commissionAmount;
    await this.pendingPaymentRepository.save(payment);

    const existingApproval = await this.paymentApprovalRepository.findOne({
      where: { paymentId, adminId },
    });

    if (!existingApproval) {
      const approval = this.paymentApprovalRepository.create({
        paymentId,
        adminId,
      });
      await this.paymentApprovalRepository.save(approval);
    }

    const approvalsSummary = await this.getApprovalSummary(paymentId);
    let confirmed = false;

    if (approvalsSummary.approvalsCount >= this.approvalsRequired) {
      await this.finalizePayment(payment, adminId);
      confirmed = true;
      // Create wallet ledger entry if wallet was assigned
      if (payment.walletId) {
        const wallet = await this.walletRepository.findOne({ where: { id: payment.walletId, isActive: true } });
        if (!wallet) {
          throw new BadRequestException(
            `Wallet ID ${payment.walletId} is inactive or does not exist. Cannot record ledger entry for confirmed payment.`,
          );
        }
        const ledgerAmount = payment.actualAmount !== null && payment.actualAmount !== undefined
          ? Number(payment.actualAmount)
          : Number(payment.amount);
        const ledgerCurrency = payment.approvalCurrency || payment.currency;
        const adminUser = await this.userRepository.findOne({ where: { id: adminId }, select: ["email"] });
        const entry = this.walletLedgerRepository.create({
          walletId: payment.walletId,
          paymentId: payment.id,
          amount: ledgerAmount,
          currency: ledgerCurrency,
          commissionAmount: payment.commissionAmount ?? null,
          approvedByAdminEmail: adminUser?.email ?? null,
        });
        await this.walletLedgerRepository.save(entry);
      }
    }

    const latestPayment = confirmed
      ? await this.pendingPaymentRepository.findOne({
          where: { id: paymentId },
          relations: ["user"],
        })
      : payment;

    const snapshot = this.buildPaymentSnapshot(latestPayment || payment);

    return {
      success: true,
      message: confirmed
        ? "Payment confirmed and subscription activated"
        : existingApproval
          ? "Approval already recorded"
          : "Approval recorded",
      data: {
        ...snapshot,
        approvalsCount: approvalsSummary.approvalsCount,
        approvals: approvalsSummary.approvals,
      },
      confirmed,
    };
  }

  async approvePaymentByReference(
    paymentReference: string,
    adminId: number,
    approvalTag?: string,
    approvalNote?: string,
  ) {
    const payment = await this.pendingPaymentRepository.findOne({
      where: { paymentReference },
      relations: ["user"],
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    return this.approvePayment(
      payment.id,
      adminId,
      approvalTag,
      approvalNote,
    );
  }

  async forceConfirmPayment(paymentId: number, adminId: number) {
    const payment = await this.pendingPaymentRepository.findOne({
      where: { id: paymentId },
      relations: ["user"],
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    if (payment.status === PaymentStatus.REJECTED) {
      throw new BadRequestException("Payment has been rejected");
    }

    if (payment.status === PaymentStatus.CONFIRMED) {
      throw new BadRequestException("Payment is already confirmed");
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException("Payment is not pending");
    }

    await this.finalizePayment(payment, adminId);

    const latestPayment = await this.pendingPaymentRepository.findOne({
      where: { id: paymentId },
      relations: ["user"],
    });

    const approvalsSummary = await this.getApprovalSummary(paymentId);
    const snapshot = this.buildPaymentSnapshot(latestPayment || payment);

    return {
      success: true,
      message: "Payment confirmed and subscription activated",
      data: {
        ...snapshot,
        approvalsCount: approvalsSummary.approvalsCount,
        approvals: approvalsSummary.approvals,
      },
      confirmed: true,
    };
  }

  async forceConfirmPaymentByReference(
    paymentReference: string,
    adminId: number,
  ) {
    const payment = await this.pendingPaymentRepository.findOne({
      where: { paymentReference },
      relations: ["user"],
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    return this.forceConfirmPayment(payment.id, adminId);
  }

  async confirmPayment(
    paymentId: number,
    adminId: number,
    approvalTag?: string,
    approvalNote?: string,
  ) {
    return this.approvePayment(
      paymentId,
      adminId,
      approvalTag,
      approvalNote,
    );
  }

  async confirmPaymentByReference(
    paymentReference: string,
    adminId: number,
    approvalTag?: string,
    approvalNote?: string,
  ) {
    return this.approvePaymentByReference(
      paymentReference,
      adminId,
      approvalTag,
      approvalNote,
    );
  }

  async rejectPayment(paymentId: number, adminId: number, reason: string) {
    const payment = await this.pendingPaymentRepository.findOne({
      where: { id: paymentId },
      relations: ["user"],
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException("Payment is not pending");
    }

    payment.status = PaymentStatus.REJECTED;
    payment.confirmedBy = adminId;
    payment.rejectionReason = reason;
    await this.pendingPaymentRepository.save(payment);

    const approvalsSummary = await this.getApprovalSummary(paymentId);

    return {
      success: true,
      message: "Payment rejected",
      data: {
        ...this.buildPaymentSnapshot(payment),
        approvalsCount: approvalsSummary.approvalsCount,
        approvals: approvalsSummary.approvals,
        rejectionReason: reason,
      },
    };
  }

  async getAllPendingPayments() {
    const payments = await this.pendingPaymentRepository.find({
      where: { status: PaymentStatus.PENDING },
      relations: ["user"],
      order: { createdAt: "DESC" },
    });

    const paymentIds = payments.map((p) => p.id);
    const approvalsByPayment =
      await this.getApprovalSummaryForPayments(paymentIds);

    return {
      success: true,
      data: payments.map((p) => {
        const approvalsSummary = approvalsByPayment[p.id] || {
          approvalsCount: 0,
          approvals: [],
        };

        return {
          ...this.buildPaymentSnapshot(p),
          approvalsCount: approvalsSummary.approvalsCount,
          approvals: approvalsSummary.approvals,
        };
      }),
    };
  }

  private async finalizePayment(payment: PendingPayment, adminId: number) {
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException("Payment is not pending");
    }

    const normalizedAmount = await this.ensureFinalAmount(payment);
    const durationMonths = await this.resolveDurationMonths(payment);

    await this.subscriptionService.activateSubscription(
      payment.userId,
      payment.plan,
      durationMonths,
    );

    await this.affiliateService.handlePaymentConfirmed(
      payment.userId,
      normalizedAmount,
    );

    payment.status = PaymentStatus.CONFIRMED;
    payment.confirmedBy = adminId;
    payment.confirmedAt = new Date();
    await this.pendingPaymentRepository.save(payment);
  }

  private async ensureFinalAmount(payment: PendingPayment): Promise<number> {
    const currentAmount = Number(payment.amount);
    if (!payment.planCode) {
      return Number.isFinite(currentAmount) ? currentAmount : 0;
    }

    const plan = await this.pricingPlanRepository.findOne({
      where: { code: payment.planCode },
    });
    if (!plan) {
      return Number.isFinite(currentAmount) ? currentAmount : 0;
    }

    let amount = Number(plan.discountedPrice);
    
    if (payment.currency && plan.regionalPrices && plan.regionalPrices.length > 0) {
      const regional = plan.regionalPrices.find(r => r.currency === payment.currency);
      if (regional) {
        amount = Number(regional.discountedPrice);
      }
    }

    if (!Number.isFinite(amount)) {
      amount = Number.isFinite(currentAmount) ? currentAmount : 0;
    }

    const promoDiscount = Number(payment.promoCodeDiscountPercent || 0);
    if (promoDiscount > 0) {
      amount = parseFloat((amount * (1 - promoDiscount / 100)).toFixed(2));
    }

    const referralDiscountPercent =
      await this.affiliateService.getReferralDiscountPercent(payment.userId);
    if (referralDiscountPercent > 0) {
      amount = parseFloat(
        (amount * (1 - referralDiscountPercent / 100)).toFixed(2),
      );
    }

    if (!Number.isFinite(currentAmount) || Math.abs(currentAmount - amount) > 0.009) {
      payment.amount = amount;
      await this.pendingPaymentRepository.save(payment);
    }

    return amount;
  }

  private async resolveDurationMonths(
    payment: PendingPayment,
  ): Promise<number> {
    if (payment.planCode) {
      const plan = await this.pricingPlanRepository.findOne({
        where: { code: payment.planCode },
      });
      if (plan?.durationMonths) {
        return plan.durationMonths;
      }
    }

    return this.getDurationInMonths(payment.duration);
  }

  private buildPaymentSnapshot(payment: PendingPayment) {
    return {
      id: payment.id,
      paymentReference: payment.paymentReference,
      userId: payment.user?.id || payment.userId,
      userName: payment.user?.name,
      userEmail: payment.user?.email,
      plan: payment.plan,
      planCode: payment.planCode || null,
      planName: payment.planName || null,
      duration: payment.duration,
      amount: payment.amount,
      actualAmount: payment.actualAmount ?? null,
      actualAmountNote: payment.actualAmountNote ?? null,
      currency: payment.currency,
      promoCodeId: payment.promoCodeId || null,
      promoCodeOwnerUserId: payment.promoCodeOwnerUserId || null,
      promoCodeValue: payment.promoCodeValue || null,
      promoCodeDiscountPercent: payment.promoCodeDiscountPercent || null,
      approvalTag: payment.approvalTag || null,
      approvalNote: payment.approvalNote || null,
      telegramUsername: payment.telegramUsername,
      proofImageUrl: payment.proofImageUrl,
      walletId: payment.walletId ?? null,
      commissionAmount: payment.commissionAmount ?? null,
      approvalCurrency: payment.approvalCurrency ?? null,
      referralCode: payment.user?.appliedReferralCode ?? null,
      createdAt: payment.createdAt,
      status: payment.status,
      confirmedBy: payment.confirmedBy || null,
      confirmedAt: payment.confirmedAt || null,
      rejectionReason: payment.rejectionReason || null,
    };
  }

  private async getApprovalSummary(paymentId: number) {
    const approvals = await this.paymentApprovalRepository.find({
      where: { paymentId },
      relations: ["admin"],
      order: { createdAt: "ASC" },
    });

    return {
      approvalsCount: approvals.length,
      approvals: approvals.map((approval) => ({
        adminId: approval.adminId,
        adminEmail: approval.admin?.email,
        createdAt: approval.createdAt,
      })),
    };
  }

  async getPaymentsByStatus(
    status: PaymentStatus,
    limit = 20,
    offset = 0,
    search?: string,
  ) {
    const query = this.pendingPaymentRepository
      .createQueryBuilder("payment")
      .leftJoinAndSelect("payment.user", "user")
      .where("payment.status = :status", { status });

    if (search) {
      query.andWhere(
        `(payment.paymentReference ILIKE :term OR user.email ILIKE :term OR user.name ILIKE :term)`,
        { term: `%${search}%` },
      );
    }

    query.orderBy("payment.createdAt", "DESC").skip(offset).take(limit);

    const [payments, total] = await query.getManyAndCount();
    const paymentIds = payments.map((p) => p.id);
    const approvalsByPayment =
      await this.getApprovalSummaryForPayments(paymentIds);

    return {
      success: true,
      total,
      limit,
      offset,
      data: payments.map((p) => {
        const approvalsSummary = approvalsByPayment[p.id] || {
          approvalsCount: 0,
          approvals: [],
        };

        return {
          ...this.buildPaymentSnapshot(p),
          approvalsCount: approvalsSummary.approvalsCount,
          approvals: approvalsSummary.approvals,
        };
      }),
    };
  }

  private async getApprovalSummaryForPayments(paymentIds: number[]) {
    if (paymentIds.length === 0) {
      return {} as Record<
        number,
        { approvalsCount: number; approvals: Array<any> }
      >;
    }

    const approvals = await this.paymentApprovalRepository.find({
      where: { paymentId: In(paymentIds) },
      relations: ["admin"],
      order: { createdAt: "ASC" },
    });

    const summary: Record<
      number,
      { approvalsCount: number; approvals: Array<any> }
    > = {};

    approvals.forEach((approval) => {
      if (!summary[approval.paymentId]) {
        summary[approval.paymentId] = { approvalsCount: 0, approvals: [] };
      }
      summary[approval.paymentId].approvalsCount += 1;
      summary[approval.paymentId].approvals.push({
        adminId: approval.adminId,
        adminEmail: approval.admin?.email,
        createdAt: approval.createdAt,
      });
    });

    return summary;
  }

  async getPremiumEarnings(limit = 20, offset = 0, search?: string, from?: string, to?: string) {
    const query = this.pendingPaymentRepository
      .createQueryBuilder("payment")
      .leftJoinAndSelect("payment.user", "user")
      .where("payment.status = :status", { status: PaymentStatus.CONFIRMED })
      .andWhere("LOWER(payment.plan) = :plan", { plan: "premium" });

    if (search) {
      query.andWhere(
        `(payment.paymentReference ILIKE :term OR user.email ILIKE :term OR user.name ILIKE :term)`,
        { term: `%${search}%` },
      );
    }
    
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) {
        query.andWhere('payment.confirmedAt >= :from', { from: fromDate });
      }
    }
    
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) {
        query.andWhere('payment.confirmedAt <= :to', { to: toDate });
      }
    }

    query.orderBy("payment.confirmedAt", "DESC").skip(offset).take(limit);

    const [payments, total] = await query.getManyAndCount();

    // Per-currency totals query
    const currencyTotalsQuery = this.pendingPaymentRepository
      .createQueryBuilder("payment")
      .select("UPPER(payment.currency)", "currency")
      .addSelect("SUM(COALESCE(payment.actual_amount, payment.amount))", "total")
      .where("payment.status = :status", { status: PaymentStatus.CONFIRMED })
      .andWhere("LOWER(payment.plan) = :plan", { plan: "premium" })
      .groupBy("UPPER(payment.currency)");

    if (search) {
      currencyTotalsQuery.leftJoin("payment.user", "user").andWhere(
        `(payment.paymentReference ILIKE :term OR user.email ILIKE :term OR user.name ILIKE :term)`,
        { term: `%${search}%` },
      );
    }
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) {
        currencyTotalsQuery.andWhere('payment.confirmedAt >= :from', { from: fromDate });
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) {
        currencyTotalsQuery.andWhere('payment.confirmedAt <= :to', { to: toDate });
      }
    }

    const currencyTotalsRaw = await currencyTotalsQuery.getRawMany<{ currency: string; total: string }>();
    const totalsPerCurrency = currencyTotalsRaw.map((row) => ({
      currency: row.currency || "USD",
      total: Number(row.total || 0),
    }));

    // Backward-compat flat total
    const totalAmount = totalsPerCurrency.reduce((acc, c) => acc + c.total, 0);

    return {
      success: true,
      total,
      limit,
      offset,
      totalAmount,
      totalsPerCurrency,
      data: payments.map((payment) => ({
        ...this.buildPaymentSnapshot(payment),
        user: payment.user
          ? {
              id: payment.user.id,
              name: payment.user.name,
              email: payment.user.email,
            }
          : null,
        confirmedAt: payment.confirmedAt,
        amountCollected:
          payment.actualAmount ?? Number(payment.amount ?? 0),
      })),
    };
  }


  async updateActualAmount(
    paymentId: number,
    actualAmount: number,
    note: string | undefined,
    adminId: number,
  ) {
    const payment = await this.pendingPaymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    if (!Number.isFinite(actualAmount) || actualAmount < 0) {
      throw new BadRequestException("Actual amount must be a positive number");
    }

    payment.actualAmount = Number(actualAmount.toFixed(2));
    payment.actualAmountNote = note?.trim() || null;
    payment.actualAmountUpdatedBy = adminId || null;
    payment.actualAmountUpdatedAt = new Date();

    await this.pendingPaymentRepository.save(payment);
    return {
      success: true,
      data: this.buildPaymentSnapshot(payment),
    };
  }

  async getPaymentKpi(from?: string, to?: string) {
    const baseQuery = () => {
      const q = this.pendingPaymentRepository.createQueryBuilder("p");
      if (from) {
        const d = new Date(from);
        if (!isNaN(d.getTime())) q.andWhere("p.confirmed_at >= :from", { from: d });
      }
      if (to) {
        const d = new Date(to);
        if (!isNaN(d.getTime())) q.andWhere("p.confirmed_at <= :to", { to: d });
      }
      return q;
    };

    const approvedQuery = baseQuery()
      .andWhere("p.status = :status", { status: PaymentStatus.CONFIRMED })
      .select("UPPER(p.currency)", "currency")
      .addSelect("SUM(p.amount)", "total")
      .addSelect("COUNT(*)", "cnt")
      .groupBy("UPPER(p.currency)");

    const collectedQuery = baseQuery()
      .andWhere("p.status = :status", { status: PaymentStatus.CONFIRMED })
      .select("UPPER(COALESCE(p.approval_currency, p.currency))", "currency")
      .addSelect("SUM(COALESCE(p.actual_amount, p.amount))", "total")
      .groupBy("UPPER(COALESCE(p.approval_currency, p.currency))");

    const commissionQuery = baseQuery()
      .andWhere("p.status = :status", { status: PaymentStatus.CONFIRMED })
      .andWhere("p.commission_amount IS NOT NULL")
      .select("UPPER(COALESCE(p.approval_currency, p.currency))", "currency")
      .addSelect("SUM(p.commission_amount)", "total")
      .groupBy("UPPER(COALESCE(p.approval_currency, p.currency))");

    const [approvedRows, collectedRows, commissionRows] = await Promise.all([
      approvedQuery.getRawMany<{ currency: string; total: string; cnt: string }>(),
      collectedQuery.getRawMany<{ currency: string; total: string }>(),
      commissionQuery.getRawMany<{ currency: string; total: string }>(),
    ]);

    const toMap = (rows: Array<{ currency: string; total: string }>) =>
      rows.reduce((acc, r) => ({ ...acc, [r.currency]: Number(r.total || 0) }), {} as Record<string, number>);

    const approvedMap = toMap(approvedRows);
    const collectedMap = toMap(collectedRows);
    const commissionMap = toMap(commissionRows);

    const approvedCount = approvedRows.reduce((s, r) => s + Number(r.cnt || 0), 0);

    const netProfitMap: Record<string, number> = {};
    const allCurrencies = new Set([...Object.keys(collectedMap), ...Object.keys(commissionMap)]);
    for (const cur of allCurrencies) {
      netProfitMap[cur] = (collectedMap[cur] || 0) - (commissionMap[cur] || 0);
    }

    return {
      success: true,
      data: {
        totalApproved: { count: approvedCount, byCurrency: approvedMap },
        totalCollected: { byCurrency: collectedMap },
        totalCommission: { byCurrency: commissionMap },
        netProfit: { byCurrency: netProfitMap },
      },
    };
  }

  async getPaymentAnalytics(
    from: string,
    to: string,
    tzOffsetMinutes = 0,
    tag?: string,
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException("Invalid date range");
    }

    const normalizedTag = tag ? tag.toLowerCase().trim() : null;
    const tagFilter =
      normalizedTag && normalizedTag !== "all" ? normalizedTag : null;

    const applyTagFilter = (qb: any) => {
      if (!tagFilter) return;
      if (tagFilter === "other") {
        qb.andWhere("(p.approval_tag IS NULL OR p.approval_tag = :tag)", {
          tag: "other",
        });
        return;
      }
      qb.andWhere("p.approval_tag = :tag", { tag: tagFilter });
    };

    const baseQuery = this.pendingPaymentRepository
      .createQueryBuilder("p")
      .where("p.status = :status", { status: PaymentStatus.CONFIRMED })
      .andWhere("p.confirmed_at BETWEEN :from AND :to", {
        from: fromDate,
        to: toDate,
      });

    const dailyQuery = baseQuery
      .clone()
      .select(
        `DATE(p.confirmed_at + make_interval(mins => :tzOffset))`,
        "day",
      )
      .addSelect("SUM(p.amount)", "revenue")
      .addSelect("COUNT(*)", "count")
      .setParameter("tzOffset", tzOffsetMinutes)
      .groupBy("day")
      .orderBy("day", "ASC");
    applyTagFilter(dailyQuery);

    const totalsQuery = baseQuery
      .clone()
      .select("SUM(p.amount)", "revenue")
      .addSelect("COUNT(*)", "count");
    applyTagFilter(totalsQuery);

      const byTagQuery = baseQuery
        .clone()
        .select(`COALESCE(p.approval_tag, 'other')`, "tag")
        .addSelect("COUNT(*)", "count")
        .addSelect("SUM(p.amount)", "revenue")
        .groupBy("tag")
        .orderBy("count", "DESC");

      const byPlanQuery = baseQuery
        .clone()
        .select(`COALESCE(p.duration, 'unknown')`, "plan")
        .addSelect("COUNT(*)", "count")
        .addSelect("SUM(p.amount)", "revenue")
        .groupBy(`COALESCE(p.duration, 'unknown')`)
        .orderBy("revenue", "DESC");
      applyTagFilter(byPlanQuery);

      const byAdminQuery = baseQuery
        .clone()
        .leftJoin(User, "admin", "admin.id = p.confirmed_by")
        .select("p.confirmed_by", "adminId")
        .addSelect("admin.email", "adminEmail")
      .addSelect("COUNT(*)", "count")
      .addSelect("SUM(p.amount)", "revenue")
      .groupBy("p.confirmed_by")
      .addGroupBy("admin.email")
      .orderBy("count", "DESC");
    applyTagFilter(byAdminQuery);

      const [dailyRows, totalsRow, byTagRows, byPlanRows, byAdminRows] = await Promise.all([
        dailyQuery.getRawMany(),
        totalsQuery.getRawOne(),
        byTagQuery.getRawMany(),
        byPlanQuery.getRawMany(),
        byAdminQuery.getRawMany(),
      ]);

    return {
      success: true,
      data: {
        dailyRevenue: dailyRows.map((row) => ({
          date: row.day,
          amount: Number(row.revenue || 0),
        })),
        dailyApprovals: dailyRows.map((row) => ({
          date: row.day,
          count: Number(row.count || 0),
        })),
        totals: {
          revenueSum: Number(totalsRow?.revenue || 0),
          approvalsCount: Number(totalsRow?.count || 0),
        },
          byTag: byTagRows.map((row) => ({
            tag: row.tag,
            count: Number(row.count || 0),
            revenue: Number(row.revenue || 0),
          })),
          byPlan: byPlanRows.map((row) => ({
            plan: row.plan,
            count: Number(row.count || 0),
            revenue: Number(row.revenue || 0),
          })),
          byAdmin: byAdminRows.map((row) => ({
            adminId: row.adminId ? Number(row.adminId) : null,
            adminEmail: row.adminEmail || null,
            approvalsCount: Number(row.count || 0),
          revenue: Number(row.revenue || 0),
        })),
      },
    };
  }

  /**
   * Generate a payment reference string. Uniqueness is NOT verified here —
   * we rely on the DB-level UNIQUE constraint on `payment_reference` and
   * retry the INSERT on a 23505 (unique_violation) inside saveWithUniqueReference.
   *
   * Why no pre-check:
   * - The previous implementation did `SELECT … WHERE paymentReference = ?`
   *   then `INSERT`. That's a classic TOCTOU race: two concurrent requests
   *   could pass the SELECT before either INSERT lands, and the second one
   *   would fail with a 500 to the user.
   * - Doing it atomically (rely on the constraint, retry on conflict) is
   *   the standard pattern.
   *
   * Keyspace: 900_000_000 distinct values per year. At 1M payments/year,
   * the per-generation collision probability is ~0.1% — effectively zero
   * with the retry loop on top.
   *
   * We use `crypto.randomInt` for a proper uniform distribution; `Math.random()`
   * is biased and predictable.
   */
  private generatePaymentReference(): string {
    const year = new Date().getFullYear();
    const random = randomInt(100_000_000, 1_000_000_000); // 9 digits
    return `MEDPARK-${year}-${random}`;
  }

  /**
   * Helper: PostgreSQL surfaces a unique-constraint violation as a
   * QueryFailedError with code '23505'. The `constraint` field carries the
   * specific index name when available — we filter on it so we don't swallow
   * unrelated unique violations (e.g. a separate composite index that just
   * happens to overlap).
   */
  private isPaymentReferenceUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = (error as any).driverError ?? error;
    const code = driverError?.code;
    const constraint: string | undefined = driverError?.constraint;
    if (code !== "23505") return false;
    // Be lenient about the constraint name (Postgres auto-names it like
    // `pending_payments_payment_reference_key`). If we can't read it, assume
    // it's the reference index — a second pending payment for the same user
    // would otherwise need its own filter anyway.
    if (!constraint) return true;
    return constraint.toLowerCase().includes("payment_reference");
  }

  /**
   * Save a freshly-built PendingPayment, retrying with a new reference if
   * we collide on the UNIQUE constraint. Bounded at 10 attempts — a genuine
   * 10-in-a-row 9-digit collision is astronomically unlikely (≤ 10^-90 at
   * any realistic payment volume), so reaching the limit means something
   * else is broken and we surface a clean 500.
   */
  private async saveWithUniqueReference(
    build: (reference: string) => PendingPayment,
  ): Promise<PendingPayment> {
    const MAX_ATTEMPTS = 10;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const reference = this.generatePaymentReference();
      const candidate = build(reference);
      try {
        return await this.pendingPaymentRepository.save(candidate);
      } catch (error) {
        if (this.isPaymentReferenceUniqueViolation(error)) {
          this.logger.warn(
            `Payment reference collision on attempt ${attempt} for ${reference} — retrying`,
          );
          continue;
        }
        throw error;
      }
    }
    throw new InternalServerErrorException(
      "Could not generate a unique payment reference after multiple attempts",
    );
  }

  private calculateAmount(
    plan: string,
    duration: SubscriptionDuration,
  ): number {
    switch (duration) {
      case SubscriptionDuration.YEARLY:
        return 47;
      case SubscriptionDuration.LIFETIME:
        return 59;
      case SubscriptionDuration.MONTHLY:
        return 29.99;
      case SubscriptionDuration.QUARTERLY:
        return 80.97;
      default:
        return 47;
    }
  }

  private getDurationInMonths(duration: SubscriptionDuration): number {
    switch (duration) {
      case SubscriptionDuration.MONTHLY:
        return 1;
      case SubscriptionDuration.QUARTERLY:
        return 3;
      case SubscriptionDuration.YEARLY:
        return 12;
      case SubscriptionDuration.LIFETIME:
        return 1200; // 100 years = Lifetime
      default:
        return 12;
    }
  }
}

/*
REQ PAYMENT
DONT DELETE!!!
-- Replace 'YOUR_REF_HERE' with the actual payment reference
DO $$
DECLARE
    v_ref TEXT := 'MEDPARK-2026-305397'; -- Your payment reference
    v_user_id INTEGER;
    v_duration TEXT;
    v_amount DECIMAL;
    v_expiry TIMESTAMP;
BEGIN
    -- 1. Get the details from the payment request (Now fetching amount too)
    SELECT user_id, duration, amount INTO v_user_id, v_duration, v_amount
    FROM "pending_payments" 
    WHERE payment_reference = v_ref;

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'Payment reference not found.';
        RETURN;
    END IF;

    -- 2. Calculate Expiry Date
    v_expiry := CASE 
        WHEN v_duration = 'yearly' THEN NOW() + INTERVAL '12 months'
        ELSE NOW() + INTERVAL '100 years' 
    END;

    -- 3. Grant access to the user
    UPDATE "users"
    SET "subscriptionPlan" = 'Premium',
        "subscription_start_date" = NOW(),
        "subscriptionExpiry" = v_expiry,
        "has_used_trial" = true
    WHERE id = v_user_id;

    -- 4. Mark the payment as confirmed
    UPDATE "pending_payments"
    SET status = 'confirmed',
        confirmed_at = NOW(),
        confirmed_by = 1 -- Manual Dev ID
    WHERE payment_reference = v_ref;

    -- 5. UPDATE AFFILIATE TRACKING (The Missing Step)
    UPDATE "affiliate_referrals"
    SET has_paid = true,
        commission_amount = (v_amount * 0.05), -- Calculates the 5% profit
        paid_at = NOW()
    WHERE referred_user_id = v_user_id 
      AND has_paid = false;

    RAISE NOTICE 'Payment % approved. Affiliate commission credited if applicable.', v_ref;

END $$;
*/
