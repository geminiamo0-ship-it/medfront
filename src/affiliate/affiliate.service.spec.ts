import { BadRequestException } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import { Repository } from "typeorm";
import { AffiliateReferral } from "../entities/affiliate-referral.entity";
import { User } from "../entities/user.entity";
import { AffiliateService } from "./affiliate.service";

describe("AffiliateService", () => {
  let service: AffiliateService;
  let userRepository: jest.Mocked<Repository<User>>;
  let referralRepository: jest.Mocked<Repository<AffiliateReferral>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AffiliateService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AffiliateReferral),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AffiliateService);
    userRepository = moduleRef.get(getRepositoryToken(User));
    referralRepository = moduleRef.get(getRepositoryToken(AffiliateReferral));
  });

  it("validates a signup referral code against an existing affiliate owner", async () => {
    userRepository.findOne.mockResolvedValueOnce({
      id: 7,
      affiliateCode: "MP-REF123",
    } as User);

    const result =
      await service.validateReferralCodeForRegistration(" mp-ref123 ");

    expect(result.id).toBe(7);
    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { affiliateCode: "MP-REF123" },
    });
  });

  it("reports an active referral discount when only referredByUserId is stored", async () => {
    jest
      .spyOn(service, "getOrCreateAffiliateCode")
      .mockResolvedValue("MP-SELF12");
    jest.spyOn(service, "getReferralDiscountPercent").mockResolvedValue(12);

    referralRepository.find.mockResolvedValue([]);
    userRepository.findOne
      .mockResolvedValueOnce({
        id: 9,
        affiliateDiscountPercent: 5,
        appliedReferralCode: null,
        referredByUserId: 4,
      } as User)
      .mockResolvedValueOnce({
        id: 4,
        affiliateCode: "MP-REF123",
        affiliateDiscountPercent: 12,
      } as User);

    const result = await service.getMyAffiliateStats(9);

    expect(result.data.hasAppliedCode).toBe(true);
    expect(result.data.appliedReferralCode).toBe("MP-REF123");
    expect(result.data.discountPercent).toBe(12);
  });

  it("rejects applying another referral code when the user is already referred", async () => {
    userRepository.findOne.mockResolvedValueOnce({
      id: 15,
      appliedReferralCode: null,
      referredByUserId: 2,
    } as User);

    await expect(
      service.applyReferralCode(15, "MP-NEW123"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
