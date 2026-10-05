import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BlockedIp } from "../entities/blocked-ip.entity";
import { BlockedIpAttempt } from "../entities/blocked-ip-attempt.entity";
import { SettingsService } from "../settings/settings.service";
import { SECURITY_SETTINGS_DEFAULTS } from "./security.constants";

type BlockedScope = "all_requests" | "register_login" | "protected_routes";

@Injectable()
export class BlockedIpService {
  constructor(
    @InjectRepository(BlockedIp)
    private readonly blockedIpRepo: Repository<BlockedIp>,
    @InjectRepository(BlockedIpAttempt)
    private readonly blockedIpAttemptRepo: Repository<BlockedIpAttempt>,
    private readonly settingsService: SettingsService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async isBlockingEnabled() {
    return this.getBoolean("SECURITY_IP_BLOCKING_ENABLED");
  }

  async getScope(): Promise<BlockedScope> {
    const raw = await this.settingsService.getString(
      "SECURITY_BLOCKED_IP_SCOPE",
      SECURITY_SETTINGS_DEFAULTS.SECURITY_BLOCKED_IP_SCOPE,
    );
    if (
      raw === "all_requests" ||
      raw === "register_login" ||
      raw === "protected_routes"
    ) {
      return raw;
    }
    return "all_requests";
  }

  async isBlocked(ip: string) {
    if (!ip) {
      return null;
    }
    const cacheKey = this.cacheKey(ip);
    const cached = await this.cacheManager.get<BlockedIp | null>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const blocked = await this.blockedIpRepo.findOne({
      where: { ip, active: true },
      order: { updatedAt: "DESC" },
    });
    await this.cacheManager.set(cacheKey, blocked || null, 60_000);
    return blocked;
  }

  async assertAllowed(ip: string, action: string) {
    if (!(await this.isBlockingEnabled())) {
      return;
    }
    const scope = await this.getScope();
    if (!this.scopeApplies(scope, action)) {
      return;
    }
    const blocked = await this.isBlocked(ip);
    if (!blocked) {
      return;
    }
    throw new ForbiddenException({
      code: "SECURITY_IP_BLOCKED",
      message:
        "Your request has been blocked due to suspicious activity. If you believe this is an error, please contact support.",
      blockedIpId: blocked.id,
      ip,
    });
  }

  async recordBlockedAttempt(input: {
    ip: string;
    action: string;
    path: string;
    userAgent?: string | null;
    email?: string | null;
    nickname?: string | null;
    metadata?: Record<string, any> | null;
  }) {
    const attempt = this.blockedIpAttemptRepo.create({
      ip: input.ip,
      action: input.action,
      email: input.email || null,
      nickname: input.nickname || null,
      path: String(input.path || "").slice(0, 255),
      userAgent: input.userAgent || null,
      metadata: input.metadata || null,
    });
    return this.blockedIpAttemptRepo.save(attempt);
  }

  async blockIp(input: {
    ip: string;
    reason: string;
    linkedUserId?: number | null;
    sourceType?: string | null;
    sourceId?: number | null;
    blockedBy?: string | null;
    metadata?: Record<string, any> | null;
  }) {
    let blocked = await this.blockedIpRepo.findOne({ where: { ip: input.ip } });
    if (!blocked) {
      blocked = this.blockedIpRepo.create({
        ip: input.ip,
        reason: input.reason,
        linkedUserId: input.linkedUserId ?? null,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        blockedBy: input.blockedBy ?? null,
        metadata: input.metadata || null,
        active: true,
      });
    } else {
      blocked.active = true;
      blocked.reason = input.reason;
      blocked.linkedUserId = input.linkedUserId ?? blocked.linkedUserId ?? null;
      blocked.sourceType = input.sourceType ?? blocked.sourceType ?? null;
      blocked.sourceId = input.sourceId ?? blocked.sourceId ?? null;
      blocked.blockedBy = input.blockedBy ?? blocked.blockedBy ?? null;
      blocked.blockedAt = new Date();
      blocked.unblockedAt = null;
      blocked.unblockedBy = null;
      blocked.metadata = {
        ...(blocked.metadata || {}),
        ...(input.metadata || {}),
      };
    }
    const saved = await this.blockedIpRepo.save(blocked);
    await this.cacheManager.del(this.cacheKey(input.ip));
    return saved;
  }

  async unblockIp(id: number, adminEmail: string) {
    const blocked = await this.blockedIpRepo.findOne({ where: { id } });
    if (!blocked) {
      throw new ForbiddenException("Blocked IP record not found");
    }
    blocked.active = false;
    blocked.unblockedAt = new Date();
    blocked.unblockedBy = adminEmail;
    const saved = await this.blockedIpRepo.save(blocked);
    await this.cacheManager.del(this.cacheKey(blocked.ip));
    return saved;
  }

  async listBlockedIps(limit = 100, offset = 0, activeOnly = true) {
    const [rows, total] = await this.blockedIpRepo.findAndCount({
      where: activeOnly ? { active: true } : {},
      order: { updatedAt: "DESC" },
      take: Math.max(1, Math.min(limit, 500)),
      skip: Math.max(0, offset),
    });
    return { rows, total, limit, offset };
  }

  async listBlockedAttempts(limit = 100, offset = 0) {
    const [rows, total] = await this.blockedIpAttemptRepo.findAndCount({
      order: { createdAt: "DESC" },
      take: Math.max(1, Math.min(limit, 500)),
      skip: Math.max(0, offset),
    });
    return { rows, total, limit, offset };
  }

  async shouldBlockIpOnDeactivation() {
    return this.getBoolean("SECURITY_DEACTIVATE_ALSO_BLOCK_IP");
  }

  private scopeApplies(scope: BlockedScope, action: string) {
    if (scope === "all_requests") {
      return true;
    }
    if (scope === "register_login") {
      return action === "register" || action === "login";
    }
    return action === "protected_request";
  }

  private async getBoolean(key: keyof typeof SECURITY_SETTINGS_DEFAULTS) {
    const raw = await this.settingsService.getString(
      key,
      SECURITY_SETTINGS_DEFAULTS[key],
    );
    return String(raw).toLowerCase() === "true";
  }

  private cacheKey(ip: string) {
    return `security:blocked-ip:${ip}`;
  }
}
