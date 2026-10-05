import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FinanceSetting } from "../entities/finance-setting.entity";

@Injectable()
export class FinanceSettingsService {
  constructor(
    @InjectRepository(FinanceSetting)
    private repo: Repository<FinanceSetting>,
  ) {}

  async getSettings(): Promise<FinanceSetting> {
    let setting = await this.repo.findOne({ where: {} });
    if (!setting) {
      setting = this.repo.create({ masterCurrency: "EGP", usdToEgpRate: 50, rateUpdatedAt: new Date() });
      await this.repo.save(setting);
    }
    return setting;
  }

  async updateSettings(
    masterCurrency?: string,
    usdToEgpRate?: number,
    adminId?: number,
  ): Promise<FinanceSetting> {
    let setting = await this.repo.findOne({ where: {} });
    if (!setting) {
      setting = this.repo.create({ masterCurrency: "EGP", usdToEgpRate: 50 });
    }
    if (masterCurrency !== undefined) setting.masterCurrency = masterCurrency.toUpperCase().trim();
    if (usdToEgpRate !== undefined) {
      setting.usdToEgpRate = usdToEgpRate;
      setting.rateUpdatedAt = new Date();
    }
    if (adminId !== undefined) setting.updatedByAdminId = adminId;
    return this.repo.save(setting);
  }
}
