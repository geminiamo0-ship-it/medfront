import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { UserRole } from "../entities/user.entity";
import { verifyJwtPayload } from "../auth/jwt-verify.util";
import { SecurityFamily } from "./security.constants";
import { SecurityService } from "./security.service";

@Injectable()
export class ContentSecurityGuard implements CanActivate {
  constructor(
    private readonly securityService: SecurityService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & Record<string, any>>();
    const currentUser = (req as any).user;
    if (
      currentUser?.role === UserRole.SUPER_ADMIN ||
      currentUser?.user?.role === UserRole.SUPER_ADMIN ||
      this.extractTokenRole(req) === UserRole.SUPER_ADMIN
    ) {
      return true;
    }
    const classification = this.classifyRequest(req);
    if (!classification) {
      return true;
    }

    const rawPath = String(req.originalUrl || req.url || "");
    const [pathOnly, queryString] = rawPath.split("?");
    const method = String(req.method || "GET").toUpperCase();
    const userId = this.extractUserId(req);
    const userEmail =
      currentUser?.email || currentUser?.user?.email || currentUser?.username || null;

    await this.securityService.evaluateContentRequest({
      family: classification.family,
      method,
      rawPath: pathOnly,
      normalizedRoute: classification.normalizedRoute,
      queryString: queryString || null,
      exactEndpointKey: `${method}:${pathOnly}`,
      targetType: classification.targetType,
      targetValue: classification.targetValue,
      userId,
      userEmail,
      ip: this.getIp(req),
      userAgent: String(req.headers["user-agent"] || ""),
    });

    return true;
  }

  private classifyRequest(
    req: Request & Record<string, any>,
  ):
    | {
        family: SecurityFamily;
        normalizedRoute: string;
        targetType: string | null;
        targetValue: string | null;
      }
    | null {
    const rawPath = String(req.originalUrl || req.url || "").split("?")[0] || "";
    const pathOnly = rawPath.startsWith("/api/") ? rawPath.slice(4) : rawPath;
    const method = String(req.method || "GET").toUpperCase();

    if (pathOnly === "/library/structure") {
      return {
        family: "library_structure",
        normalizedRoute: `${method}:/library/structure`,
        targetType: null,
        targetValue: null,
      };
    }

    const libraryArticleMatch = pathOnly.match(/^\/library\/article\/([^/]+)$/);
    if (libraryArticleMatch) {
      return {
        family: "library_article",
        normalizedRoute: `${method}:/library/article/:id`,
        targetType: "article",
        targetValue: libraryArticleMatch[1],
      };
    }

    if (pathOnly === "/library/search") {
      return {
        family: "library_search",
        normalizedRoute: `${method}:/library/search`,
        targetType: "query",
        targetValue: req.query?.q ? String(req.query.q).slice(0, 128) : null,
      };
    }

    if (pathOnly === "/library/tooltips") {
      return {
        family: "library_tooltip",
        normalizedRoute: `${method}:/library/tooltips`,
        targetType: "tooltip",
        targetValue: req.query?.eids ? String(req.query.eids).slice(0, 128) : null,
      };
    }

    const testExplanationMatch = pathOnly.match(
      /^\/tests\/([^/]+)\/questions\/([^/]+)\/explanation$/,
    );
    if (testExplanationMatch) {
      return {
        family: "test_explanation",
        normalizedRoute: `${method}:/tests/:id/questions/:questionId/explanation`,
        targetType: "question",
        targetValue: testExplanationMatch[2],
      };
    }

    if (pathOnly === "/tests/search/questions") {
      return {
        family: "test_search",
        normalizedRoute: `${method}:/tests/search/questions`,
        targetType: "search",
        targetValue: req.query?.value ? String(req.query.value).slice(0, 128) : null,
      };
    }

    if (
      pathOnly === "/tests/counts" ||
      pathOnly.startsWith("/tests/metadata/")
    ) {
      // Keep the test creation flow stable. The actual test creation limits
      // are enforced separately by SecurityQuotaService.
      return null;
    }

    const practiceMatch = pathOnly.match(/^\/tests\/practice\/([^/]+)$/);
    if (practiceMatch) {
      return {
        family: "test_practice",
        normalizedRoute: `${method}:/tests/practice/:questionId`,
        targetType: "question",
        targetValue: practiceMatch[1],
      };
    }

    const testPayloadMatch = pathOnly.match(/^\/tests\/([^/]+)$/);
    if (testPayloadMatch) {
      return {
        family: "test_payload",
        normalizedRoute: `${method}:/tests/:id`,
        targetType: "test",
        targetValue: testPayloadMatch[1],
      };
    }

    return null;
  }

  private extractUserId(req: Request & Record<string, any>) {
    const currentUser = (req as any).user;
    const direct =
      currentUser?.id ??
      currentUser?.userId ??
      currentUser?.sub ??
      currentUser?.user?.id;
    if (direct && Number.isFinite(Number(direct))) {
      return Number(direct);
    }
    const header =
      (req.headers?.authorization as string) ||
      (req.headers?.Authorization as string) ||
      "";
    if (!header) return null;
    const token = header.startsWith("Bearer ") ? header.slice(7) : header;
    const payload = this.verifyToken(token);
    if (!payload) return null;
    const candidate = payload?.sub ?? payload?.userId ?? payload?.id;
    return candidate && Number.isFinite(Number(candidate)) ? Number(candidate) : null;
  }

  private extractTokenRole(req: Request & Record<string, any>) {
    const header =
      (req.headers?.authorization as string) ||
      (req.headers?.Authorization as string) ||
      "";
    if (!header) return null;
    const token = header.startsWith("Bearer ") ? header.slice(7) : header;
    const payload = this.verifyToken(token);
    return payload?.role || null;
  }

  private verifyToken(token: string): Record<string, any> | null {
    const secret = this.configService.get<string>("JWT_SECRET");
    if (!secret) {
      return null;
    }
    return verifyJwtPayload(token, secret, {
      issuer: this.configService.get<string>("JWT_ISSUER") || "medpark.io",
      audience: this.configService.get<string>("JWT_AUDIENCE") || "api.medpark.io",
    });
  }

  private getIp(req: Request & Record<string, any>) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
      return forwarded.split(",")[0].trim();
    }
    return String(req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown").slice(0, 64);
  }
}
