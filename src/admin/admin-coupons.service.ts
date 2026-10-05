import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { AffiliateService } from "../affiliate/affiliate.service";
import { AffiliateReferral } from "../entities/affiliate-referral.entity";
import { User } from "../entities/user.entity";
import { UpdateAdminCouponDto } from "./dto/update-admin-coupon.dto";

@Injectable()
export class AdminCouponsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AffiliateReferral)
    private readonly affiliateReferralRepository: Repository<AffiliateReferral>,
    private readonly affiliateService: AffiliateService,
  ) {}

  async getUsersCouponAnalytics(limit = 50, offset = 0, search?: string) {
    const query = this.userRepository
      .createQueryBuilder("user")
      .orderBy("user.createdAt", "DESC")
      .take(limit)
      .skip(offset);

    if (search) {
      query.where(
        `
          user.name ILIKE :search
          OR user.email ILIKE :search
          OR user.nickname ILIKE :search
          OR user.affiliateCode ILIKE :search
        `,
        { search: `%${search}%` },
      );
    }

    const [users, total] = await query.getManyAndCount();
    const data = await this.buildUserAnalytics(users);

    return {
      success: true,
      total,
      limit,
      offset,
      data,
    };
  }

  async getUserCouponAnalytics(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const [data] = await this.buildUserAnalytics([user]);

    return {
      success: true,
      data,
    };
  }

  async updateCoupon(couponId: number, body: UpdateAdminCouponDto) {
    const user = await this.userRepository.findOne({
      where: { id: couponId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    user.affiliateCode = await this.ensureAffiliateCode(user);
    const before = this.serializeCoupon(user);
    const targetUser = this.serializeTargetUser(user);

    if (
      body.code === undefined &&
      body.discountPercent === undefined &&
      body.commissionPercent === undefined
    ) {
      return {
        success: true,
        message: "No coupon changes submitted",
        data: {
          targetUser,
          changes: {},
          before,
          after: before,
        },
      };
    }

    if (body.code !== undefined) {
      const normalizedCode = body.code.trim().toUpperCase();
      if (!normalizedCode) {
        throw new BadRequestException("Coupon code cannot be empty");
      }

      const existing = await this.userRepository.findOne({
        where: { affiliateCode: normalizedCode },
      });
      if (existing && existing.id !== couponId) {
        throw new BadRequestException("Coupon code already exists");
      }

      user.affiliateCode = normalizedCode;
    }

    if (body.discountPercent !== undefined) {
      user.affiliateDiscountPercent = body.discountPercent;
    }
    if (body.commissionPercent !== undefined) {
      user.affiliateCommissionPercent = body.commissionPercent;
    }
    const savedUser = await this.userRepository.save(user);
    const after = this.serializeCoupon(savedUser);

    return {
      success: true,
      message: "Coupon updated successfully",
      data: {
        targetUser: this.serializeTargetUser(savedUser),
        changes: this.buildCouponChanges(before, after),
        before,
        after,
      },
    };
  }

  private async buildUserAnalytics(users: User[]) {
    if (users.length === 0) {
      return [];
    }

    const usersWithCodes = await Promise.all(
      users.map(async (user) => {
        user.affiliateCode = await this.ensureAffiliateCode(user);
        return user;
      }),
    );

    const userIds = usersWithCodes.map((user) => user.id);
    const referrals = await this.affiliateReferralRepository.find({
      where: { referrerId: In(userIds) },
      relations: ["referredUser"],
      order: { createdAt: "DESC" },
    });

    const referralsByUser = new Map<number, AffiliateReferral[]>();
    referrals.forEach((referral) => {
      const bucket = referralsByUser.get(referral.referrerId) || [];
      bucket.push(referral);
      referralsByUser.set(referral.referrerId, bucket);
    });

    return usersWithCodes.map((user) => {
      const joinedReferrals = referralsByUser.get(user.id) || [];
      const paidReferrals = joinedReferrals.filter(
        (referral) => referral.hasPaid,
      );
      const referralCommissionEarned = joinedReferrals.reduce(
        (total, referral) => total + Number(referral.commissionAmount || 0),
        0,
      );

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          nickname: user.nickname,
          affiliateCode: user.affiliateCode,
        },
        couponStats: {
          totalCoupons: user.affiliateCode ? 1 : 0,
          totalConfirmedUses: paidReferrals.length,
          totalProfitGenerated: Number(referralCommissionEarned.toFixed(2)),
        },
        coupons: user.affiliateCode
          ? [
              {
                ...this.serializeCoupon(user),
                usedCount: joinedReferrals.length,
                totalConfirmedUses: paidReferrals.length,
                totalProfitGenerated: Number(
                  referralCommissionEarned.toFixed(2),
                ),
              },
            ]
          : [],
        referralStats: {
          joinedCount: joinedReferrals.length,
          totalPaid: paidReferrals.length,
          totalCommissionEarned: Number(referralCommissionEarned.toFixed(2)),
          joinedUsers: joinedReferrals.map((referral) => ({
            referralId: referral.id,
            joinedAt: referral.createdAt,
            hasPaid: referral.hasPaid,
            commissionAmount: Number(referral.commissionAmount || 0),
            paidAt: referral.paidAt,
            referredUser: referral.referredUser
              ? {
                  id: referral.referredUser.id,
                  name: referral.referredUser.name,
                  email: referral.referredUser.email,
                  nickname: referral.referredUser.nickname,
                  appliedReferralCode:
                    referral.referredUser.appliedReferralCode,
                }
              : null,
          })),
        },
      };
    });
  }

  private async ensureAffiliateCode(user: User) {
    if (user.affiliateCode) {
      return user.affiliateCode;
    }

    const code = await this.affiliateService.getOrCreateAffiliateCode(user.id);
    user.affiliateCode = code;
    return code;
  }

  private serializeCoupon(user: User) {
    return {
      id: user.id,
      ownerUserId: user.id,
      code: user.affiliateCode,
      discountPercent: Number(user.affiliateDiscountPercent ?? 5),
      commissionPercent: Number(user.affiliateCommissionPercent ?? 5),
      isActive: true,
      expiresAt: null,
      maxUses: null,
      usedCount: 0,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private serializeTargetUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      nickname: user.nickname,
      affiliateCode: user.affiliateCode,
    };
  }

  private buildCouponChanges(before: any, after: any) {
    const changes: Record<string, { from: any; to: any }> = {};

    if (before.code !== after.code) {
      changes.code = {
        from: before.code,
        to: after.code,
      };
    }

    if (before.discountPercent !== after.discountPercent) {
      changes.discountPercent = {
        from: before.discountPercent,
        to: after.discountPercent,
      };
    }

    return changes;
  }
}
