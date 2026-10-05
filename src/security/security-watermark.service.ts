import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "crypto";
import { SecurityPolicyService } from "./security-policy.service";

@Injectable()
export class SecurityWatermarkService {
  constructor(
    private readonly configService: ConfigService,
    private readonly policyService: SecurityPolicyService,
  ) {}

  async watermarkHtml(
    html: string | null | undefined,
    payload: { userId?: number | null; email?: string | null; contentId: string; kind: string },
  ) {
    if (!html) return html ?? "";

    const policy = await this.policyService.getConfig();
    if (!policy.enabled || !policy.watermarkingEnabled) {
      return html;
    }

    const bucket = new Date().toISOString().slice(0, 13);
    const secret =
      this.configService.get<string>("SECURITY_WATERMARK_SECRET") ||
      this.configService.get<string>("JWT_SECRET") ||
      "medpark-security";
    const raw = `${payload.kind}|${payload.contentId}|${payload.userId || 0}|${payload.email || ""}|${bucket}`;
    const digest = createHmac("sha256", secret).update(raw).digest("hex").slice(0, 24);
    const marker = `<!-- mpwm:${payload.kind}:${payload.contentId}:${payload.userId || 0}:${digest} -->`;
    const hidden = `<span data-mpwm="${digest}" style="display:none !important; visibility:hidden !important;">${digest}</span>`;
    return `${html}${marker}${hidden}`;
  }
}
