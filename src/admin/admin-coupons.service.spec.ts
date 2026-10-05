import { BadRequestException } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import { Repository } from "typeorm";
import { AffiliateService } from "../affiliate/affiliate.service";
import { AffiliateReferral } from "../entities/affiliate-referral.entity";
import { User } from "../entities/user.entity";
import { AdminCouponsService } from "./admin-coupons.service";

describe("AdminCouponsService", () => {
  let service: AdminCouponsService;
  let userRepository: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminCouponsService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AffiliateReferral),
          useValue: {},
        },
        {
          provide: AffiliateService,
          useValue: {
            getOrCreateAffiliateCode: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AdminCouponsService);
    userRepository = moduleRef.get(getRepositoryToken(User));
  });

  it("normalizes affiliate coupon code updates", async () => {
    userRepository.findOne
      .mockResolvedValueOnce({
        id: 1,
        affiliateCode: "MP-OLD123",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User)
      .mockResolvedValueOnce(null);
    userRepository.save.mockImplementation(async (user) => user as User);

    const result = await service.updateCoupon(1, {
      code: " spring20 ",
    });

    expect(result.data.after.code).toBe("SPRING20");
    expect(userRepository.save).toHaveBeenCalled();
  });

  it("rejects duplicate affiliate coupon code", async () => {
    userRepository.findOne
      .mockResolvedValueOnce({
        id: 1,
        affiliateCode: "MP-OLD123",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User)
      .mockResolvedValueOnce({
        id: 2,
        affiliateCode: "SPRING20",
      } as User);

    await expect(
      service.updateCoupon(1, { code: "SPRING20" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns current coupon when no code is submitted", async () => {
    userRepository.findOne.mockResolvedValueOnce({
      id: 1,
      affiliateCode: "MP-ABCD12",
      affiliateDiscountPercent: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User);

    const result = await service.updateCoupon(1, {});

    expect(result.message).toBe("No coupon changes submitted");
    expect(result.data.after.code).toBe("MP-ABCD12");
  });

  it("updates the affiliate coupon discount", async () => {
    userRepository.findOne.mockResolvedValueOnce({
      id: 1,
      affiliateCode: "MP-ABCD12",
      affiliateDiscountPercent: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User);
    userRepository.save.mockImplementation(async (user) => user as User);

    const result = await service.updateCoupon(1, { discountPercent: 12 });

    expect(result.data.after.discountPercent).toBe(12);
    expect(userRepository.save).toHaveBeenCalled();
  });
});
