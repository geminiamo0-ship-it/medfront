import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SpecialBadgeType } from "../entities/special-badge-type.entity";
import { UserSpecialBadge } from "../entities/user-special-badge.entity";
import { SettingsService } from "../settings/settings.service";

const THRESHOLD_KEYS = {
  bronze:   "BADGE_THRESHOLD_BRONZE",
  silver:   "BADGE_THRESHOLD_SILVER",
  gold:     "BADGE_THRESHOLD_GOLD",
  platinum: "BADGE_THRESHOLD_PLATINUM",
} as const;

@Injectable()
export class AdminBadgesService {
  constructor(
    @InjectRepository(SpecialBadgeType)
    private readonly badgeTypeRepo: Repository<SpecialBadgeType>,
    @InjectRepository(UserSpecialBadge)
    private readonly userBadgeRepo: Repository<UserSpecialBadge>,
    private readonly settingsService: SettingsService,
  ) {}

  // ── Badge thresholds ──────────────────────────────────────────

  async getBadgeThresholds() {
    const [bronze, silver, gold] = await Promise.all([
      this.settingsService.getNumber(THRESHOLD_KEYS.bronze,   49),
      this.settingsService.getNumber(THRESHOLD_KEYS.silver,   149),
      this.settingsService.getNumber(THRESHOLD_KEYS.gold,     299),
    ]);
    return { bronze, silver, gold, platinum: "300+" };
  }

  async updateBadgeThresholds(
    dto: { bronze?: number; silver?: number; gold?: number },
    updatedBy: string,
  ) {
    const tasks: Promise<any>[] = [];
    if (dto.bronze !== undefined)
      tasks.push(this.settingsService.setNumber(THRESHOLD_KEYS.bronze, dto.bronze, updatedBy));
    if (dto.silver !== undefined)
      tasks.push(this.settingsService.setNumber(THRESHOLD_KEYS.silver, dto.silver, updatedBy));
    if (dto.gold !== undefined)
      tasks.push(this.settingsService.setNumber(THRESHOLD_KEYS.gold, dto.gold, updatedBy));
    await Promise.all(tasks);
    return this.getBadgeThresholds();
  }

  // ── Badge types ───────────────────────────────────────────────

  async listBadgeTypes(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    return this.badgeTypeRepo.find({ where, order: { label: "ASC" } });
  }

  async createBadgeType(dto: {
    key: string;
    label: string;
    description?: string;
    icon?: string;
    color?: string;
  }) {
    const exists = await this.badgeTypeRepo.findOne({ where: { key: dto.key } });
    if (exists) throw new ConflictException(`Badge key "${dto.key}" already exists`);

    const bt = this.badgeTypeRepo.create({
      key: dto.key,
      label: dto.label,
      description: dto.description ?? "",
      icon: dto.icon ?? "🏅",
      color: dto.color ?? "#6366f1",
    });
    return this.badgeTypeRepo.save(bt);
  }

  async updateBadgeType(
    id: number,
    dto: { label?: string; description?: string; icon?: string; color?: string; isActive?: boolean },
  ) {
    const bt = await this.badgeTypeRepo.findOne({ where: { id } });
    if (!bt) throw new NotFoundException("Badge type not found");
    Object.assign(bt, dto);
    return this.badgeTypeRepo.save(bt);
  }

  async deleteBadgeType(id: number) {
    const bt = await this.badgeTypeRepo.findOne({ where: { id } });
    if (!bt) throw new NotFoundException("Badge type not found");
    bt.isActive = false;
    await this.badgeTypeRepo.save(bt);
    return { success: true };
  }

  // ── User badges ───────────────────────────────────────────────

  async getUserBadges(userId: number) {
    return this.userBadgeRepo.find({
      where: { userId },
      order: { awardedAt: "DESC" },
    });
  }

  async awardBadge(
    userId: number,
    dto: { badgeTypeId: number; note?: string },
    awardedBy: string,
  ) {
    const bt = await this.badgeTypeRepo.findOne({ where: { id: dto.badgeTypeId, isActive: true } });
    if (!bt) throw new NotFoundException("Badge type not found or inactive");

    const badge = this.userBadgeRepo.create({
      userId,
      badgeTypeId: dto.badgeTypeId,
      awardedBy,
      note: dto.note ?? null,
    });
    return this.userBadgeRepo.save(badge);
  }

  async revokeBadge(userId: number, badgeId: number) {
    const badge = await this.userBadgeRepo.findOne({ where: { id: badgeId, userId } });
    if (!badge) throw new NotFoundException("Badge not found");
    await this.userBadgeRepo.remove(badge);
    return { success: true };
  }

  // ── Used by UsersService.getHomeStats ─────────────────────────

  async getThresholdValues(): Promise<{ bronze: number; silver: number; gold: number }> {
    const [bronze, silver, gold] = await Promise.all([
      this.settingsService.getNumber(THRESHOLD_KEYS.bronze, 49),
      this.settingsService.getNumber(THRESHOLD_KEYS.silver, 149),
      this.settingsService.getNumber(THRESHOLD_KEYS.gold,   299),
    ]);
    return { bronze, silver, gold };
  }
}
