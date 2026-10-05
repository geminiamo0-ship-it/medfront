import { Body, Controller, Post, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ActivityService, ActivityEventInput } from "./activity.service";
import * as geoip from "geoip-lite";

const getClientIp = (req: any) => {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) {
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = String(raw).split(",")[0].trim();
    return ip.startsWith("::ffff:") ? ip.replace("::ffff:", "") : ip;
  }
  const fallback = req.ip || req.connection?.remoteAddress || null;
  if (!fallback) return null;
  return String(fallback).startsWith("::ffff:")
    ? String(fallback).replace("::ffff:", "")
    : fallback;
};

@Controller("activity")
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post("bulk")
  async bulk(@Body() body: { events?: ActivityEventInput[] }, @Request() req) {
    const userId = req.user?.id;
    const ipAddress = getClientIp(req);
    const lookup = ipAddress ? geoip.lookup(ipAddress) : null;
    const userAgent =
      typeof req.headers?.["user-agent"] === "string"
        ? req.headers["user-agent"]
        : null;

    return this.activityService.bulkInsert(userId, body?.events || [], {
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      country: lookup?.country || null,
      region: lookup?.region || null,
      city: lookup?.city || null,
      timezone: lookup?.timezone || null,
      latitude: lookup?.ll?.[0] ?? null,
      longitude: lookup?.ll?.[1] ?? null,
    });
  }
}
