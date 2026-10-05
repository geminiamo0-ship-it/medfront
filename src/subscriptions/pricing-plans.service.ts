import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PricingPlan } from '../entities/pricing-plan.entity';
import { CreatePricingPlanDto, UpdatePricingPlanDto } from './dto/pricing-plan.dto';

@Injectable()
export class PricingPlansService {
  constructor(
    @InjectRepository(PricingPlan)
    private pricingPlanRepository: Repository<PricingPlan>,
  ) {}

  async getActivePlans() {
    return this.pricingPlanRepository.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC', discountedPrice: 'ASC' },
    });
  }

  async getAllPlans() {
    return this.pricingPlanRepository.find({
      order: { displayOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async createPlan(dto: CreatePricingPlanDto) {
    await this.ensureCodeUnique(dto.code);
    this.validatePricing(dto.realPrice, dto.discountedPrice);
    this.validateBenefits(dto.benefits);

    const plan = this.pricingPlanRepository.create({
      ...dto,
      isActive: dto.isActive ?? true,
      isFeatured: dto.isFeatured ?? false,
      displayOrder: dto.displayOrder ?? 0,
    });

    return this.pricingPlanRepository.save(plan);
  }

  async updatePlan(id: number, dto: UpdatePricingPlanDto) {
    const plan = await this.pricingPlanRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    if (dto.code && dto.code !== plan.code) {
      await this.ensureCodeUnique(dto.code);
    }

    if (dto.realPrice !== undefined || dto.discountedPrice !== undefined) {
      const realPrice = dto.realPrice ?? Number(plan.realPrice);
      const discountedPrice = dto.discountedPrice ?? Number(plan.discountedPrice);
      this.validatePricing(realPrice, discountedPrice);
    }

    if (dto.benefits) {
      this.validateBenefits(dto.benefits);
    }

    Object.assign(plan, dto);
    return this.pricingPlanRepository.save(plan);
  }

  async getPlanByCode(code: string) {
    return this.pricingPlanRepository.findOne({
      where: { code, isActive: true },
    });
  }

  private async ensureCodeUnique(code: string) {
    const existing = await this.pricingPlanRepository.findOne({ where: { code } });
    if (existing) {
      throw new BadRequestException('Plan code already exists');
    }
  }

  private validatePricing(realPrice: number, discountedPrice: number) {
    if (realPrice < 0 || discountedPrice < 0) {
      throw new BadRequestException('Pricing values must be positive');
    }
    if (discountedPrice > realPrice) {
      throw new BadRequestException('Discounted price must be less than or equal to real price');
    }
  }

  private validateBenefits(benefits: string[]) {
    if (!Array.isArray(benefits) || benefits.length === 0) {
      throw new BadRequestException('Benefits list is required');
    }
  }
}
