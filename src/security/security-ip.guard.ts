import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { verifyJwtPayload } from "../auth/jwt-verify.util";
import { getClientIp } from "../rate-limit/rate-limit.utils";
import { UserRole } from "../entities/user.entity";
import { BlockedIpService } from "./ip-block.service";

@Injectable()
export class SecurityIpGuard implements CanActivate {
  constructor(
    private readonly blockedIpService: BlockedIpService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (context.getType() !== "http") {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request & Record<string, any>>();
    const currentUser = (req as any).user;
    if (
      currentUser?.role === UserRole.SUPER_ADMIN ||
      this.extractVerifiedRole(req) === UserRole.SUPER_ADMIN
    ) {
      return true;
    }
    const ip = getClientIp(req);
    const action = this.getAction(req);

    try {
      await this.blockedIpService.assertAllowed(ip, action);
      return true;
    } catch (error) {
      await this.blockedIpService.recordBlockedAttempt({
        ip,
        action,
        path: req.originalUrl || req.url || "",
        userAgent: String(req.headers?.["user-agent"] || ""),
        email: req.body?.email || null,
        nickname: req.body?.nickname || null,
        metadata: {
          method: req.method,
          query: req.query || null,
        },
      });
      throw error;
    }
  }

  private getAction(req: Request & Record<string, any>) {
    const path = String(req.originalUrl || req.url || "");
    if (path.includes("/auth/register")) {
      return "register";
    }
    if (path.includes("/auth/login")) {
      return "login";
    }
    return "protected_request";
  }

  private extractVerifiedRole(req: Request & Record<string, any>) {
    const header =
      (req.headers?.authorization as string) ||
      (req.headers?.Authorization as string) ||
      "";
    if (!header) {
      return null;
    }
    const token = header.startsWith("Bearer ") ? header.slice(7) : header;
    const secret = this.configService.get<string>("JWT_SECRET");
    if (!secret) {
      return null;
    }
    const payload = verifyJwtPayload(token, secret, {
      issuer: this.configService.get<string>("JWT_ISSUER") || "medpark.io",
      audience: this.configService.get<string>("JWT_AUDIENCE") || "api.medpark.io",
    });
    return payload?.role || null;
  }
}
