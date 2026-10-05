import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserActivityLog } from "../entities/user-activity-log.entity";
import { RequestRateLimitAlert } from "../entities/request-rate-limit-alert.entity";
import { SettingsService } from "../settings/settings.service";
import { AdminNotificationsService } from "../admin/admin-notifications.service";
import { NotificationType } from "../entities/notification.entity";
import { User } from "../entities/user.entity";
import { SecurityIncident } from "../entities/security-incident.entity";
import { SecurityActorState } from "../entities/security-actor-state.entity";

export interface ActivityEventInput {
  feature: string;
  action: string;
  entityType?: string;
  entityId?: string | number;
  metadata?: any;
  createdAt?: string;
}

export interface ActivityRequestContext {
  ipAddress?: string;
  userAgent?: string;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  timezone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(UserActivityLog)
    private readonly activityRepo: Repository<UserActivityLog>,
    @InjectRepository(RequestRateLimitAlert)
    private readonly rateLimitAlertRepo: Repository<RequestRateLimitAlert>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(SecurityIncident)
    private readonly securityIncidentRepo: Repository<SecurityIncident>,
    @InjectRepository(SecurityActorState)
    private readonly securityActorStateRepo: Repository<SecurityActorState>,
    private readonly settingsService: SettingsService,
    private readonly adminNotificationsService: AdminNotificationsService,
  ) {}

  async bulkInsert(
    userId: number,
    events: ActivityEventInput[],
    context?: ActivityRequestContext,
  ) {
    if (!events?.length) {
      return { success: true, inserted: 0 };
    }

    /**
     * Defensive truncation helper. The user_activity_logs table has fixed
     * varchar column widths and Postgres rejects (code 22001) any insert
     * whose value exceeds the declared length. In-app browsers on mobile
     * (Instagram, Facebook, TikTok, etc.) routinely produce user-agent
     * strings well over 255 characters — bug seen in prod from the
     * Instagram Android client (UA = 269 chars).
     *
     * Truncating server-side here is the right defense regardless of
     * schema: we keep the leading high-signal portion of the UA (browser
     * + OS + device) and drop the in-app-browser tail. Same protection
     * for ipAddress/country/region/city/timezone in case GeoIP ever
     * returns an unexpectedly long value.
     */
    const cap = (
      value: string | null | undefined,
      max: number,
    ): string | null => {
      if (value === null || value === undefined) return null;
      const str = String(value);
      if (str.length === 0) return null;
      return str.length > max ? str.slice(0, max) : str;
    };

    const sanitized = events
      .filter((event) => event && event.feature && event.action)
      .slice(0, 500)
      .map((event) => {
        const record: Partial<UserActivityLog> = {
          userId,
          feature: String(event.feature).slice(0, 64),
          action: String(event.action).slice(0, 64),
          entityType: event.entityType
            ? String(event.entityType).slice(0, 64)
            : null,
          entityId:
            event.entityId !== undefined && event.entityId !== null
              ? String(event.entityId).slice(0, 64)
              : null,
          metadata: event.metadata ?? null,
          // Caps match the entity column widths in user-activity-log.entity.ts.
          // If those change, update both here and the entity in the same PR.
          // userAgent is capped at 255 here — even though the column was
          // widened to `text` in migration 1803000000009, this cap stays
          // at 255 so the code is safe to deploy BEFORE the migration runs
          // (zero-downtime deploys). Once the migration is universally
          // applied, this cap can be raised to 1024 in a follow-up.
          ipAddress: cap(context?.ipAddress, 64),
          userAgent: cap(context?.userAgent, 255),
          country: cap(context?.country, 64),
          region: cap(context?.region, 64),
          city: cap(context?.city, 128),
          timezone: cap(context?.timezone, 64),
          latitude:
            typeof context?.latitude === "number" ? context.latitude : null,
          longitude:
            typeof context?.longitude === "number" ? context.longitude : null,
        };
        if (event.createdAt) {
          const createdAt = new Date(event.createdAt);
          if (!Number.isNaN(createdAt.getTime())) {
            record.createdAt = createdAt;
          }
        }
        return record;
      });

    if (!sanitized.length) {
      return { success: true, inserted: 0 };
    }

    await this.activityRepo.insert(sanitized);
    return { success: true, inserted: sanitized.length };
  }

  private resolveRange(from?: string, to?: string, defaultDays = 30) {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate);
    if (!from) {
      fromDate.setDate(toDate.getDate() - defaultDays);
    }
    return { fromDate, toDate };
  }

  private severityRank(value?: string | null) {
    switch (String(value || "").toLowerCase()) {
      case "critical":
        return 4;
      case "high":
        return 3;
      case "medium":
        return 2;
      default:
        return 1;
    }
  }

  private scoreIncidentWeight(row: {
    severity?: string | null;
    actionTaken?: string | null;
    incidentType?: string | null;
    hitCountInWindow?: number | null;
    distinctTargetCountInWindow?: number | null;
  }) {
    const severity = this.severityRank(row.severity);
    const action = String(row.actionTaken || "").toLowerCase();
    const incidentType = String(row.incidentType || "").toLowerCase();
    let score = severity * 12;
    if (action === "content_lock") score += 18;
    else if (action === "content_cooldown") score += 10;
    else if (action === "soft_throttle") score += 4;
    if (incidentType === "distinct_target_crawl") score += 10;
    if (incidentType === "daily_hard_cap_explanation") score += 14;
    if (incidentType === "exact_endpoint_spam") score += 8;
    score += Math.min(Number(row.hitCountInWindow || 0), 12);
    score += Math.min(Number(row.distinctTargetCountInWindow || 0), 12);
    return score;
  }

  private async augmentPath(pathStr: string) {
    if (!pathStr || !pathStr.includes("/library/article/")) return pathStr;
    const parts = pathStr.split("/");
    const possibleId = parts[parts.length - 1];
    if (/^\d+$/.test(possibleId)) {
      try {
        const article = await this.activityRepo.query(
          `SELECT name, source, qbank FROM library_articles WHERE id = $1`,
          [Number(possibleId)],
        );
        if (article && article.length > 0) {
          const src = article[0].qbank || article[0].source || "usmle";
          return `${pathStr} \n[${src}] ${article[0].name}`;
        }
      } catch {
        return pathStr;
      }
    }
    return pathStr;
  }

  private buildInvestigationKey(input: {
    userId?: number | null;
    ip?: string | null;
  }) {
    return input.userId ? `user:${input.userId}` : `ip:${input.ip || "unknown"}`;
  }

  private formatSecurityLabel(value?: string | null) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  private matchesSecuritySearch(
    searchTerm: string,
    parts: Array<string | number | null | undefined>,
  ) {
    if (!searchTerm) {
      return true;
    }
    return parts
      .filter((part) => part !== null && part !== undefined && String(part).trim() !== "")
      .join(" ")
      .toLowerCase()
      .includes(searchTerm);
  }

  private paginateRows<T>(items: T[], limit: number, offset: number) {
    return {
      total: items.length,
      rows: items.slice(offset, offset + limit),
      limit,
      offset,
    };
  }

  async getGlobalOverview(params: {
    from?: string;
    to?: string;
    tzOffsetMinutes?: number;
    feature?: string;
  }) {
    const { from, to, tzOffsetMinutes = 0, feature } = params;
    const { fromDate, toDate } = this.resolveRange(from, to, 30);
    const tzOffset = Number(tzOffsetMinutes) || 0;

    const baseQuery = this.activityRepo
      .createQueryBuilder("log")
      .where("log.createdAt BETWEEN :from AND :to", {
        from: fromDate,
        to: toDate,
      });

    if (feature) {
      baseQuery.andWhere("log.feature = :feature", { feature });
    }

    const dailyRows = await baseQuery
      .clone()
      .select(
        `DATE(log.createdAt + make_interval(mins => :tzOffset))`,
        "day",
      )
      .addSelect("COUNT(*)::int", "events")
      .addSelect("COUNT(DISTINCT log.userId)::int", "uniqueUsers")
      .setParameter("tzOffset", tzOffset)
      .groupBy("day")
      .orderBy("day", "ASC")
      .getRawMany();

    const hourlyRows = await baseQuery
      .clone()
      .select(
        `EXTRACT(HOUR FROM log.createdAt + make_interval(mins => :tzOffset))::int`,
        "hour",
      )
      .addSelect("COUNT(*)::int", "events")
      .setParameter("tzOffset", tzOffset)
      .groupBy("hour")
      .orderBy("hour", "ASC")
      .getRawMany();

    const totalsRow = await baseQuery
      .clone()
      .select("COUNT(*)::int", "totalEvents")
      .addSelect("COUNT(DISTINCT log.userId)::int", "totalUsers")
      .getRawOne();

    const featuresRaw = await this.activityRepo
      .createQueryBuilder("log")
      .select("DISTINCT log.feature", "feature")
      .orderBy("log.feature", "ASC")
      .getRawMany();

    return {
      success: true,
      data: {
        dailyCounts: dailyRows.map((row: any) => ({
          date: row.day,
          events: Number(row.events || 0),
          uniqueUsers: Number(row.uniqueUsers || 0),
        })),
        hourlyCounts: hourlyRows.map((row: any) => ({
          hour: Number(row.hour),
          events: Number(row.events || 0),
        })),
        totals: {
          totalEvents: Number(totalsRow?.totalEvents || 0),
          totalUsers: Number(totalsRow?.totalUsers || 0),
        },
        availableFeatures: featuresRaw.map((row: any) => row.feature),
      },
    };
  }

  async getDailyAlerts(params: {
    date?: string;
    from?: string;
    to?: string;
    tzOffsetMinutes?: number;
  }) {
    const { date, from, to, tzOffsetMinutes = 0 } = params;
    const tzOffset = Number(tzOffsetMinutes) || 0;

    if (!from && !to && !date) {
      const targetDate = new Date(
        Date.now() + tzOffset * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10);
      return this.getDailyAlerts({ date: targetDate, tzOffsetMinutes: tzOffset });
    }

    const mediumThreshold = await this.settingsService.getNumber(
      "SECURITY_ALERT_MEDIUM",
      100,
    );
    const highThreshold = await this.settingsService.getNumber(
      "SECURITY_ALERT_HIGH",
      150,
    );
    const highestThreshold = await this.settingsService.getNumber(
      "SECURITY_ALERT_HIGHEST",
      200,
    );

    if (date) {
      const rows = await this.activityRepo.query(
        `
        SELECT
          DATE(log.created_at + make_interval(mins => $2)) AS "day",
          log.user_id AS "userId",
          u.name AS "name",
          u.email AS "email",
          COUNT(*)::int AS "events"
        FROM user_activity_logs log
        JOIN users u ON u.id = log.user_id
        WHERE DATE(log.created_at + make_interval(mins => $2)) = $1
        GROUP BY "day", log.user_id, u.name, u.email
        HAVING COUNT(*) >= $3
        ORDER BY "events" DESC
        `,
        [date, tzOffset, mediumThreshold],
      );

      const alerts = rows.map((row: any) => {
        const count = Number(row.events || 0);
        let level: "medium" | "high" | "highest" = "medium";
        if (count >= highestThreshold) level = "highest";
        else if (count >= highThreshold) level = "high";
        return {
          userId: Number(row.userId),
          name: row.name,
          email: row.email,
          events: count,
          level,
        };
      });

      return {
        success: true,
        data: {
          date,
          days: [{ date, alerts }],
        },
      };
    }

    const { fromDate, toDate } = this.resolveRange(from, to, 7);
    const rangeRows = await this.activityRepo.query(
      `
      SELECT
        DATE(log.created_at + make_interval(mins => $3)) AS "day",
        log.user_id AS "userId",
        u.name AS "name",
        u.email AS "email",
        COUNT(*)::int AS "events"
      FROM user_activity_logs log
      JOIN users u ON u.id = log.user_id
      WHERE log.created_at BETWEEN $1 AND $2
      GROUP BY "day", log.user_id, u.name, u.email
      HAVING COUNT(*) >= $4
      ORDER BY "day" DESC, "events" DESC
      `,
      [fromDate, toDate, tzOffset, mediumThreshold],
    );

    const dayMap = new Map<string, any[]>();
    rangeRows.forEach((row: any) => {
      const count = Number(row.events || 0);
      let level: "medium" | "high" | "highest" = "medium";
      if (count >= highestThreshold) level = "highest";
      else if (count >= highThreshold) level = "high";
      const alert = {
        userId: Number(row.userId),
        name: row.name,
        email: row.email,
        events: count,
        level,
      };
      const dayKey = row.day;
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, []);
      }
      dayMap.get(dayKey)?.push(alert);
    });

    const days = Array.from(dayMap.entries()).map(([day, alerts]) => ({
      date: day,
      alerts,
    }));

    return {
      success: true,
      data: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        days,
      },
    };
  }

  async recordRateLimitAlert(payload: {
    userId?: number | null;
    ip: string;
    path: string;
    method: string;
    userAgent?: string | null;
    limit: number;
    totalHits: number;
    ttlSeconds: number;
  }) {
    const normalizedAgent =
      payload.userAgent !== undefined && payload.userAgent !== null
        ? String(payload.userAgent)
        : null;

    const alert = this.rateLimitAlertRepo.create({
      userId: payload.userId ?? null,
      ip: payload.ip,
      path: payload.path.slice(0, 255),
      method: payload.method.slice(0, 12).toUpperCase(),
      userAgent: normalizedAgent ? normalizedAgent.slice(0, 500) : null,
      limit: payload.limit,
      totalHits: payload.totalHits,
      ttlSeconds: payload.ttlSeconds,
    });

    await this.rateLimitAlertRepo.save(alert);

    let userLabel = payload.userId ? `User #${payload.userId}` : null;
    if (payload.userId) {
      const user = await this.userRepo.findOne({
        where: { id: payload.userId },
        select: ["id", "email", "name"],
      });
      if (user?.email) {
        userLabel = user.email;
      } else if (user?.name) {
        userLabel = `${user.name} (ID ${user.id})`;
      }
    }

    const actorLabel = userLabel || `IP ${payload.ip}`;
    await this.adminNotificationsService.createAdminNotification({
      title: "Rate limit blocked",
      message: `${actorLabel} was blocked on ${payload.method.toUpperCase()} ${payload.path}`,
      type: NotificationType.WARNING,
      metadata: {
        category: "security",
        alertType: "rate_limit",
        userId: payload.userId ?? null,
        ip: payload.ip,
        path: payload.path,
        method: payload.method.toUpperCase(),
        totalHits: payload.totalHits,
        limit: payload.limit,
      },
    });

    return alert;
  }

  async getSecurityAlerts(params: {
    from?: string;
    to?: string;
    tzOffsetMinutes?: number;
    search?: string;
    severity?: string;
    incidentType?: string;
    actionTaken?: string;
    endpointFamily?: string;
    source?: string;
    breakLimit?: number;
    breakOffset?: number;
    rateLimitLimit?: number;
    rateLimitOffset?: number;
  }) {
    const {
      from,
      to,
      tzOffsetMinutes = 0,
      search,
      severity,
      incidentType,
      actionTaken,
      endpointFamily,
      source,
    } = params;
    const { fromDate, toDate } = this.resolveRange(from, to, 7);
    const tzOffset = Number(tzOffsetMinutes) || 0;
    const breakLimit = Math.max(1, Math.min(500, params.breakLimit ?? 20));
    const breakOffset = Math.max(0, params.breakOffset ?? 0);
    const rateLimitLimit = Math.max(1, Math.min(500, params.rateLimitLimit ?? 20));
    const rateLimitOffset = Math.max(0, params.rateLimitOffset ?? 0);
    const searchTerm = String(search || "").trim().toLowerCase();
    const severityFloor = severity && severity !== "all" ? severity : undefined;
    const incidentFilter = incidentType && incidentType !== "all" ? incidentType : undefined;
    const actionFilter = actionTaken && actionTaken !== "all" ? actionTaken : undefined;
    const endpointFilter =
      endpointFamily && endpointFamily !== "all" ? endpointFamily : undefined;
    const sourceFilter = source && source !== "all" ? source : undefined;

    const rateLimitRows = await this.rateLimitAlertRepo.query(
      `
      SELECT
        r.user_id AS "userId",
        u.name AS "name",
        u.email AS "email",
        r.ip AS "ip",
        COUNT(*)::int AS "count",
        MAX(r.created_at) AS "lastSeenAt",
        MAX(r.path) AS "lastPath",
        MAX(r.method) AS "lastMethod"
      FROM request_rate_limit_alerts r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.created_at BETWEEN $1 AND $2
      GROUP BY r.user_id, u.name, u.email, r.ip
      ORDER BY "count" DESC, "lastSeenAt" DESC
      `,
      [fromDate, toDate],
    );

    const rateLimitEvents = await this.rateLimitAlertRepo.query(
      `
      SELECT
        r.id AS "id",
        r.user_id AS "userId",
        u.name AS "name",
        u.email AS "email",
        r.ip AS "ip",
        r.path AS "path",
        r.method AS "method",
        r.total_hits AS "totalHits",
        r.limit AS "limit",
        r.ttl_seconds AS "ttlSeconds",
        r.user_agent AS "userAgent",
        r.created_at AS "createdAt"
      FROM request_rate_limit_alerts r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.created_at BETWEEN $1 AND $2
      ORDER BY r.created_at DESC
      `,
      [fromDate, toDate],
    );

    for (let i = 0; i < rateLimitRows.length; i++) {
      rateLimitRows[i].lastPath = await this.augmentPath(
        String(rateLimitRows[i].lastPath),
      );
    }
    for (let i = 0; i < rateLimitEvents.length; i++) {
      rateLimitEvents[i].path = await this.augmentPath(String(rateLimitEvents[i].path));
    }

    const incidentRows = await this.securityIncidentRepo.query(
      `
      SELECT
        s.id AS "id",
        s.user_id AS "userId",
        u.name AS "name",
        u.email AS "email",
        s.ip AS "ip",
        s.endpoint_family AS "endpointFamily",
        s.incident_type AS "incidentType",
        s.severity AS "severity",
        s.action_taken AS "actionTaken",
        s.exact_endpoint_key AS "exactEndpointKey",
        s.normalized_route AS "normalizedRoute",
        s.hit_count_in_window AS "hitCountInWindow",
        s.distinct_target_count_in_window AS "distinctTargetCountInWindow",
        s.lock_duration_seconds AS "lockDurationSeconds",
        s.created_at AS "createdAt"
      FROM security_incidents s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.created_at BETWEEN $1 AND $2
      ORDER BY s.created_at DESC
      `,
      [fromDate, toDate],
    );

    const testCreationThreshold = await this.settingsService.getNumber(
      "SECURITY_TEST_CREATE_THRESHOLD",
      3,
    );

    const testCreationRows = await this.activityRepo.query(
      `
      SELECT
        DATE(t."createdAt" + make_interval(mins => $3)) AS "day",
        t."userId" AS "userId",
        u.name AS "name",
        u.email AS "email",
        COUNT(*)::int AS "count"
      FROM tests t
      JOIN users u ON u.id = t."userId"
      WHERE t."createdAt" BETWEEN $1 AND $2
        AND (t."isBlock" IS NULL OR t."isBlock" = false)
      GROUP BY "day", t."userId", u.name, u.email
      HAVING COUNT(*) >= $4
      ORDER BY "day" DESC, "count" DESC
      `,
      [fromDate, toDate, tzOffset, testCreationThreshold],
    );

    const activityAlerts = await this.getDailyAlerts({
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      tzOffsetMinutes: tzOffset,
    });

    const flattenedActivityAlerts =
      activityAlerts?.data?.days?.flatMap((day: any) =>
        (day.alerts || []).map((alert: any) => ({
          date: day.date,
          userId: Number(alert.userId),
          name: alert.name,
          email: alert.email,
          events: Number(alert.events || 0),
          level: alert.level,
        })),
      ) || [];

    const allBreakMoments = [
      ...incidentRows.map((row: any) => ({
        key: `incident-${row.id}`,
        source: "protected",
        kind: "security_incident",
        createdAt: row.createdAt,
        userId: row.userId ? Number(row.userId) : null,
        name: row.name || null,
        email: row.email || null,
        ip: row.ip,
        severity: row.severity,
        actionTaken: row.actionTaken || null,
        endpointFamily: row.endpointFamily,
        incidentType: row.incidentType,
        title: this.formatSecurityLabel(row.incidentType),
        subtitle: this.formatSecurityLabel(row.endpointFamily),
        endpoint: row.exactEndpointKey,
        normalizedRoute: row.normalizedRoute,
        hits: Number(row.hitCountInWindow || 0),
        distinct: Number(row.distinctTargetCountInWindow || 0),
        limit: null,
        ttlSeconds: Number(row.lockDurationSeconds || 0),
        details: `${this.formatSecurityLabel(row.incidentType)} on ${this.formatSecurityLabel(row.endpointFamily)}`,
      })),
      ...rateLimitEvents.map((row: any) => ({
        key: `rate-${row.id}`,
        source: "rateLimit",
        kind: "rate_limit_event",
        createdAt: row.createdAt,
        userId: row.userId ? Number(row.userId) : null,
        name: row.name || null,
        email: row.email || null,
        ip: row.ip,
        severity: "medium",
        actionTaken: "rate_limit_block",
        endpointFamily: "rate_limit",
        incidentType: "rate_limit_block",
        title: "Rate Limit Block",
        subtitle: `${row.method} ${row.path}`,
        endpoint: row.path,
        normalizedRoute: row.path,
        hits: Number(row.totalHits || 0),
        distinct: 0,
        limit: Number(row.limit || 0),
        ttlSeconds: Number(row.ttlSeconds || 0),
        details: `Blocked after ${Number(row.totalHits || 0)} hits against limit ${Number(row.limit || 0)}`,
      })),
      ...flattenedActivityAlerts.map((row: any) => ({
        key: `activity-${row.date}-${row.userId}`,
        source: "activity",
        kind: "activity_alert",
        createdAt: `${row.date}T00:00:00.000Z`,
        userId: row.userId,
        name: row.name,
        email: row.email,
        ip: null,
        severity: row.level,
        actionTaken: null,
        endpointFamily: "activity",
        incidentType: "activity_threshold_alert",
        title: "Activity Threshold Alert",
        subtitle: row.level,
        endpoint: null,
        normalizedRoute: null,
        hits: Number(row.events || 0),
        distinct: 0,
        limit: null,
        ttlSeconds: 0,
        details: `${Number(row.events || 0)} events on ${row.date}`,
      })),
      ...testCreationRows.map((row: any) => ({
        key: `test-create-${row.day}-${row.userId}`,
        source: "testCreation",
        kind: "test_creation_alert",
        createdAt: `${row.day}T00:00:00.000Z`,
        userId: Number(row.userId),
        name: row.name,
        email: row.email,
        ip: null,
        severity: "medium",
        actionTaken: null,
        endpointFamily: "test_creation",
        incidentType: "test_creation_threshold",
        title: "Test Creation Alert",
        subtitle: "Daily threshold",
        endpoint: null,
        normalizedRoute: "/tests",
        hits: Number(row.count || 0),
        distinct: 0,
        limit: Number(testCreationThreshold || 0),
        ttlSeconds: 0,
        details: `${Number(row.count || 0)} tests created on ${row.day}`,
      })),
    ].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const filteredBreakMoments = allBreakMoments.filter((row: any) => {
      if (sourceFilter && row.source !== sourceFilter) {
        return false;
      }
      if (
        severityFloor &&
        this.severityRank(row.severity) < this.severityRank(severityFloor)
      ) {
        return false;
      }
      if (incidentFilter && (row.incidentType || "none") !== incidentFilter) {
        return false;
      }
      if (actionFilter && (row.actionTaken || "none") !== actionFilter) {
        return false;
      }
      if (endpointFilter && (row.endpointFamily || "none") !== endpointFilter) {
        return false;
      }
      return this.matchesSecuritySearch(searchTerm, [
        row.name,
        row.email,
        row.userId,
        row.ip,
        row.title,
        row.subtitle,
        row.endpointFamily,
        row.incidentType,
        row.endpoint,
        row.normalizedRoute,
        row.details,
      ]);
    });

    const filteredRateLimitEvents = rateLimitEvents
      .filter((row: any) => {
        if (
          severityFloor &&
          this.severityRank("medium") < this.severityRank(severityFloor)
        ) {
          return false;
        }
        if (incidentFilter && incidentFilter !== "rate_limit_block") {
          return false;
        }
        if (actionFilter && actionFilter !== "rate_limit_block") {
          return false;
        }
        if (endpointFilter && endpointFilter !== "rate_limit") {
          return false;
        }
        if (sourceFilter && sourceFilter !== "rateLimit") {
          return false;
        }
        return this.matchesSecuritySearch(searchTerm, [
          row.name,
          row.email,
          row.userId,
          row.ip,
          row.path,
          row.method,
          row.userAgent,
        ]);
      })
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    const visibleBreakKeys = new Set(filteredBreakMoments.map((row: any) => row.key));
    const offenderMap = new Map<string, any>();
    const ensureOffender = (input: {
      userId?: number | null;
      ip?: string | null;
      name?: string | null;
      email?: string | null;
    }) => {
      const key = this.buildInvestigationKey(input);
      if (!offenderMap.has(key)) {
        offenderMap.set(key, {
          key,
          userId: input.userId ?? null,
          ip: input.ip ?? null,
          name: input.name ?? null,
          email: input.email ?? null,
          totalAlerts: 0,
          weightedScore: 0,
          protectedIncidentCount: 0,
          rateLimitCount: 0,
          activityAlertDays: 0,
          testCreationAlertDays: 0,
          lastSeenAt: null,
          lastPath: null,
          lastMethod: null,
          dominantEndpointFamily: null,
          dominantIncidentType: null,
          highestSeverity: "low",
          latestActionTaken: null,
          isAnonymous: !input.userId,
          repeatOffender: false,
          _familyCounts: {} as Record<string, number>,
          _incidentCounts: {} as Record<string, number>,
          _days: new Set<string>(),
        });
      }
      return offenderMap.get(key);
    };

    for (const row of incidentRows) {
      if (!visibleBreakKeys.has(`incident-${row.id}`)) {
        continue;
      }
      const offender = ensureOffender({
        userId: row.userId ? Number(row.userId) : null,
        ip: row.ip,
        name: row.name || null,
        email: row.email || null,
      });
      offender.totalAlerts += 1;
      offender.protectedIncidentCount += 1;
      offender.weightedScore += this.scoreIncidentWeight(row);
      offender.lastSeenAt =
        !offender.lastSeenAt || new Date(row.createdAt) > new Date(offender.lastSeenAt)
          ? row.createdAt
          : offender.lastSeenAt;
      offender.latestActionTaken = offender.latestActionTaken || row.actionTaken || null;
      offender._familyCounts[row.endpointFamily] =
        (offender._familyCounts[row.endpointFamily] || 0) + 1;
      offender._incidentCounts[row.incidentType] =
        (offender._incidentCounts[row.incidentType] || 0) + 1;
      if (this.severityRank(row.severity) > this.severityRank(offender.highestSeverity)) {
        offender.highestSeverity = row.severity;
      }
      offender._days.add(String(row.createdAt).slice(0, 10));
    }

    const filteredRateLimitSummary = rateLimitRows.filter((row: any) => {
      const hasVisibleBreak = filteredBreakMoments.some(
        (item: any) =>
          item.source === "rateLimit" &&
          ((row.userId && item.userId === Number(row.userId)) || item.ip === row.ip),
      );
      return hasVisibleBreak;
    });

    for (const row of filteredRateLimitSummary) {
      const offender = ensureOffender({
        userId: row.userId ? Number(row.userId) : null,
        ip: row.ip,
        name: row.name || null,
        email: row.email || null,
      });
      const count = Number(row.count || 0);
      offender.totalAlerts += count;
      offender.rateLimitCount += count;
      offender.weightedScore += count * 2 + (row.userId ? 4 : 2);
      offender.lastSeenAt =
        !offender.lastSeenAt || new Date(row.lastSeenAt) > new Date(offender.lastSeenAt)
          ? row.lastSeenAt
          : offender.lastSeenAt;
      offender.lastPath = row.lastPath || offender.lastPath;
      offender.lastMethod = row.lastMethod || offender.lastMethod;
      offender._days.add(String(row.lastSeenAt).slice(0, 10));
    }

    for (const alert of flattenedActivityAlerts) {
      if (!visibleBreakKeys.has(`activity-${alert.date}-${alert.userId}`)) {
        continue;
      }
      const offender = ensureOffender({
        userId: alert.userId,
        name: alert.name,
        email: alert.email,
      });
      offender.totalAlerts += 1;
      offender.activityAlertDays += 1;
      offender.weightedScore +=
        alert.level === "highest" ? 12 : alert.level === "high" ? 8 : 5;
      offender._days.add(String(alert.date));
    }

    for (const row of testCreationRows) {
      if (!visibleBreakKeys.has(`test-create-${row.day}-${row.userId}`)) {
        continue;
      }
      const offender = ensureOffender({
        userId: Number(row.userId),
        name: row.name,
        email: row.email,
      });
      offender.totalAlerts += 1;
      offender.testCreationAlertDays += 1;
      offender.weightedScore += Math.min(Number(row.count || 0), 10) + 3;
      offender._days.add(String(row.day));
    }

    const topOffenders = Array.from(offenderMap.values())
      .map((item) => {
        const dominantEndpointFamily = Object.entries(item._familyCounts).sort(
          (a, b) => Number(b[1]) - Number(a[1]),
        )[0]?.[0] || null;
        const dominantIncidentType = Object.entries(item._incidentCounts).sort(
          (a, b) => Number(b[1]) - Number(a[1]),
        )[0]?.[0] || null;
        return {
          key: item.key,
          userId: item.userId,
          ip: item.ip,
          name: item.name,
          email: item.email,
          totalAlerts: item.totalAlerts,
          weightedScore: item.weightedScore,
          protectedIncidentCount: item.protectedIncidentCount,
          rateLimitCount: item.rateLimitCount,
          activityAlertDays: item.activityAlertDays,
          testCreationAlertDays: item.testCreationAlertDays,
          lastSeenAt: item.lastSeenAt,
          lastPath: item.lastPath,
          lastMethod: item.lastMethod,
          dominantEndpointFamily,
          dominantIncidentType,
          highestSeverity: item.highestSeverity,
          latestActionTaken: item.latestActionTaken,
          isAnonymous: item.isAnonymous,
          repeatOffender: item._days.size > 1,
        };
      })
      .sort((a, b) => {
        if (b.weightedScore !== a.weightedScore) return b.weightedScore - a.weightedScore;
        if (
          this.severityRank(b.highestSeverity) !==
          this.severityRank(a.highestSeverity)
        ) {
          return this.severityRank(b.highestSeverity) - this.severityRank(a.highestSeverity);
        }
        if (a.isAnonymous !== b.isAnonymous) return a.isAnonymous ? 1 : -1;
        return (
          new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime()
        );
      })
      .slice(0, 12);

    const filteredIncidentRows = incidentRows.filter((row: any) =>
      visibleBreakKeys.has(`incident-${row.id}`),
    );

    const incidentBreakdown = {
      endpointFamilies: Object.entries(
        filteredIncidentRows.reduce((acc: Record<string, number>, row: any) => {
          acc[row.endpointFamily] = (acc[row.endpointFamily] || 0) + 1;
          return acc;
        }, {}),
      )
        .map(([label, count]) => ({ label, count: Number(count) }))
        .sort((a, b) => Number(b.count) - Number(a.count)),
      actionsTaken: Object.entries(
        filteredIncidentRows.reduce((acc: Record<string, number>, row: any) => {
          const key = row.actionTaken || "none";
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {}),
      )
        .map(([label, count]) => ({ label, count: Number(count) }))
        .sort((a, b) => Number(b.count) - Number(a.count)),
      severities: Object.entries(
        filteredIncidentRows.reduce((acc: Record<string, number>, row: any) => {
          acc[row.severity] = (acc[row.severity] || 0) + 1;
          return acc;
        }, {}),
      )
        .map(([label, count]) => ({ label, count: Number(count) }))
        .sort((a, b) => Number(b.count) - Number(a.count)),
      incidentTypes: Object.entries(
        filteredIncidentRows.reduce((acc: Record<string, number>, row: any) => {
          acc[row.incidentType] = (acc[row.incidentType] || 0) + 1;
          return acc;
        }, {}),
      )
        .map(([label, count]) => ({ label, count: Number(count) }))
        .sort((a, b) => Number(b.count) - Number(a.count)),
    };

    const recentHighSeverityIncidents = filteredIncidentRows
      .filter((row: any) => this.severityRank(row.severity) >= this.severityRank("high"))
      .slice(0, 8)
      .map((row: any) => ({
        id: Number(row.id),
        userId: row.userId ? Number(row.userId) : null,
        name: row.name || null,
        email: row.email || null,
        ip: row.ip,
        endpointFamily: row.endpointFamily,
        incidentType: row.incidentType,
        severity: row.severity,
        actionTaken: row.actionTaken || null,
        exactEndpointKey: row.exactEndpointKey,
        hitCountInWindow: Number(row.hitCountInWindow || 0),
        distinctTargetCountInWindow: Number(row.distinctTargetCountInWindow || 0),
        createdAt: row.createdAt,
      }));
    const breakMomentsPage = this.paginateRows(
      filteredBreakMoments,
      breakLimit,
      breakOffset,
    );
    const rateLimitPage = this.paginateRows(
      filteredRateLimitEvents,
      rateLimitLimit,
      rateLimitOffset,
    );
    const uniqueUsers = new Set(
      filteredBreakMoments
        .map((row: any) => row.userId)
        .filter((value: number | null | undefined) => Number(value) > 0),
    ).size;
    const uniqueIps = new Set(
      filteredBreakMoments
        .map((row: any) => row.ip)
        .filter((value: string | null | undefined) => Boolean(value)),
    ).size;

    return {
      success: true,
      data: {
        range: { from: fromDate.toISOString(), to: toDate.toISOString() },
        rateLimitAlerts: filteredRateLimitSummary.map((row: any) => ({
          userId: row.userId ? Number(row.userId) : null,
          name: row.name || null,
          email: row.email || null,
          ip: row.ip,
          count: Number(row.count || 0),
          lastSeenAt: row.lastSeenAt,
          lastPath: row.lastPath,
          lastMethod: row.lastMethod,
        })),
        rateLimitEvents: rateLimitPage.rows.map((row: any) => ({
          id: Number(row.id),
          userId: row.userId ? Number(row.userId) : null,
          name: row.name || null,
          email: row.email || null,
          ip: row.ip,
          path: row.path,
          method: row.method,
          totalHits: Number(row.totalHits || 0),
          limit: Number(row.limit || 0),
          ttlSeconds: Number(row.ttlSeconds || 0),
          userAgent: row.userAgent || null,
          createdAt: row.createdAt,
        })),
        rateLimitTotals: {
          totalEvents: rateLimitPage.total,
          uniqueUsers,
          uniqueIps,
          limit: rateLimitLimit,
          offset: rateLimitOffset,
        },
        activityAlerts: {
          ...activityAlerts.data,
          days:
            activityAlerts?.data?.days?.map((day: any) => ({
              ...day,
              alerts: (day.alerts || []).filter((alert: any) =>
                filteredBreakMoments.some(
                  (row: any) =>
                    row.key === `activity-${day.date}-${Number(alert.userId)}`,
                ),
              ),
            })) || [],
        },
        topOffenders,
        incidentBreakdown,
        recentHighSeverityIncidents,
        breakMoments: breakMomentsPage.rows,
        breakMomentsTotal: breakMomentsPage.total,
        breakMomentsLimit: breakLimit,
        breakMomentsOffset: breakOffset,
        summary: {
          totalProtectedIncidents: filteredBreakMoments.filter(
            (row: any) => row.source === "protected",
          ).length,
          totalRateLimitEvents: filteredBreakMoments.filter(
            (row: any) => row.source === "rateLimit",
          ).length,
          totalActivityAlertDays: filteredBreakMoments.filter(
            (row: any) => row.source === "activity",
          ).length,
          totalTestCreationAlertDays: filteredBreakMoments.filter(
            (row: any) => row.source === "testCreation",
          ).length,
          totalBreakMoments: filteredBreakMoments.length,
          uniqueUsers,
          uniqueIps,
        },
        testCreationAlerts: testCreationRows
          .filter((row: any) =>
            filteredBreakMoments.some(
              (item: any) => item.key === `test-create-${row.day}-${row.userId}`,
            ),
          )
          .map((row: any) => ({
          date: row.day,
          userId: Number(row.userId),
          name: row.name,
          email: row.email,
          count: Number(row.count || 0),
          })),
        testCreationThreshold,
      },
    };
  }

  async getSecurityInvestigation(params: {
    userId?: number;
    ip?: string;
    from?: string;
    to?: string;
    tzOffsetMinutes?: number;
    incidentType?: string;
    incidentLimit?: number;
    incidentOffset?: number;
    rateLimitLimit?: number;
    rateLimitOffset?: number;
  }) {
    const {
      userId,
      ip,
      from,
      to,
      tzOffsetMinutes = 0,
      incidentType,
      incidentLimit = 25,
      incidentOffset = 0,
      rateLimitLimit = 25,
      rateLimitOffset = 0,
    } = params;
    const { fromDate, toDate } = this.resolveRange(from, to, 7);
    const tzOffset = Number(tzOffsetMinutes) || 0;
    const safeIncidentLimit = Math.max(1, Math.min(500, incidentLimit));
    const safeIncidentOffset = Math.max(0, incidentOffset);
    const safeRateLimitLimit = Math.max(1, Math.min(500, rateLimitLimit));
    const safeRateLimitOffset = Math.max(0, rateLimitOffset);

    if (!userId && !ip) {
      return {
        success: true,
        data: null,
      };
    }

    const user = userId
      ? await this.userRepo.findOne({
          where: { id: userId },
          select: ["id", "name", "email"],
        })
      : null;

    const incidentFilter = userId
      ? `s.user_id = $3`
      : `s.ip = $3`;
    const incidentTypeClause =
      incidentType && incidentType !== "all" ? ` AND s.incident_type = $4` : "";
    const incidentArgs =
      incidentType && incidentType !== "all"
        ? [fromDate, toDate, userId || ip, incidentType, safeIncidentLimit, safeIncidentOffset]
        : [fromDate, toDate, userId || ip, safeIncidentLimit, safeIncidentOffset];
    const rateLimitFilter = userId
      ? `r.user_id = $3`
      : `r.ip = $3`;

    const incidentTotalRow = await this.securityIncidentRepo.query(
      `
      SELECT COUNT(*)::int AS "total"
      FROM security_incidents s
      WHERE s.created_at BETWEEN $1 AND $2
        AND ${incidentFilter}
        ${incidentTypeClause}
      `,
      incidentType && incidentType !== "all"
        ? [fromDate, toDate, userId || ip, incidentType]
        : [fromDate, toDate, userId || ip],
    );
    const incidentRows = await this.securityIncidentRepo.query(
      `
      SELECT
        s.id AS "id",
        s.user_id AS "userId",
        u.name AS "name",
        u.email AS "email",
        s.ip AS "ip",
        s.endpoint_family AS "endpointFamily",
        s.incident_type AS "incidentType",
        s.severity AS "severity",
        s.action_taken AS "actionTaken",
        s.exact_endpoint_key AS "exactEndpointKey",
        s.normalized_route AS "normalizedRoute",
        s.hit_count_in_window AS "hitCountInWindow",
        s.distinct_target_count_in_window AS "distinctTargetCountInWindow",
        s.created_at AS "createdAt"
      FROM security_incidents s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.created_at BETWEEN $1 AND $2
        AND ${incidentFilter}
        ${incidentTypeClause}
      ORDER BY s.created_at DESC
      LIMIT $${incidentType && incidentType !== "all" ? "5" : "4"}
      OFFSET $${incidentType && incidentType !== "all" ? "6" : "5"}
      `,
      incidentArgs,
    );

    const rateLimitTotalRow = await this.rateLimitAlertRepo.query(
      `
      SELECT COUNT(*)::int AS "total"
      FROM request_rate_limit_alerts r
      WHERE r.created_at BETWEEN $1 AND $2
        AND ${rateLimitFilter}
      `,
      [fromDate, toDate, userId || ip],
    );

    const rateLimitEvents = await this.rateLimitAlertRepo.query(
      `
      SELECT
        r.id AS "id",
        r.user_id AS "userId",
        u.name AS "name",
        u.email AS "email",
        r.ip AS "ip",
        r.path AS "path",
        r.method AS "method",
        r.total_hits AS "totalHits",
        r.limit AS "limit",
        r.ttl_seconds AS "ttlSeconds",
        r.user_agent AS "userAgent",
        r.created_at AS "createdAt"
      FROM request_rate_limit_alerts r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.created_at BETWEEN $1 AND $2
        AND ${rateLimitFilter}
      ORDER BY r.created_at DESC
      LIMIT $4 OFFSET $5
      `,
      [fromDate, toDate, userId || ip, safeRateLimitLimit, safeRateLimitOffset],
    );

    for (let i = 0; i < rateLimitEvents.length; i++) {
      rateLimitEvents[i].path = await this.augmentPath(String(rateLimitEvents[i].path));
    }

    const mediumThreshold = await this.settingsService.getNumber(
      "SECURITY_ALERT_MEDIUM",
      100,
    );
    const highThreshold = await this.settingsService.getNumber(
      "SECURITY_ALERT_HIGH",
      150,
    );
    const highestThreshold = await this.settingsService.getNumber(
      "SECURITY_ALERT_HIGHEST",
      200,
    );

    const activityAlertRows = userId
      ? await this.activityRepo.query(
          `
          SELECT
            DATE(log.created_at + make_interval(mins => $3)) AS "date",
            COUNT(*)::int AS "events"
          FROM user_activity_logs log
          WHERE log.created_at BETWEEN $1 AND $2
            AND log.user_id = $4
          GROUP BY "date"
          HAVING COUNT(*) >= $5
          ORDER BY "date" DESC
          LIMIT 20
          `,
          [fromDate, toDate, tzOffset, userId, mediumThreshold],
        )
      : [];

    const testCreationThreshold = await this.settingsService.getNumber(
      "SECURITY_TEST_CREATE_THRESHOLD",
      3,
    );
    const testCreationAlerts = userId
      ? await this.activityRepo.query(
          `
          SELECT
            DATE(t."createdAt" + make_interval(mins => $3)) AS "date",
            COUNT(*)::int AS "count"
          FROM tests t
          WHERE t."createdAt" BETWEEN $1 AND $2
            AND t."userId" = $4
            AND (t."isBlock" IS NULL OR t."isBlock" = false)
          GROUP BY "date"
          HAVING COUNT(*) >= $5
          ORDER BY "date" DESC
          LIMIT 20
          `,
          [fromDate, toDate, tzOffset, userId, testCreationThreshold],
        )
      : [];

    const actorState = await this.securityActorStateRepo
      .createQueryBuilder("state")
      .where(userId ? "state.userId = :userId" : "state.ip = :ip", {
        userId,
        ip,
      })
      .orderBy("state.updatedAt", "DESC")
      .getOne();

    const latestIp =
      actorState?.ip ||
      incidentRows[0]?.ip ||
      rateLimitEvents[0]?.ip ||
      ip ||
      null;

    return {
      success: true,
      data: {
        target: {
          userId: user?.id ?? userId ?? null,
          name: user?.name || incidentRows[0]?.name || rateLimitEvents[0]?.name || null,
          email:
            user?.email || incidentRows[0]?.email || rateLimitEvents[0]?.email || null,
          ip: latestIp,
        },
        totals: {
          protectedIncidents: Number(incidentTotalRow?.[0]?.total || 0),
          rateLimitEvents: Number(rateLimitTotalRow?.[0]?.total || 0),
          activityAlertDays: activityAlertRows.length,
          testCreationAlertDays: testCreationAlerts.length,
          totalAlerts:
            Number(incidentTotalRow?.[0]?.total || 0) +
            Number(rateLimitTotalRow?.[0]?.total || 0) +
            activityAlertRows.length +
            testCreationAlerts.length,
        },
        pagination: {
          protectedIncidents: {
            total: Number(incidentTotalRow?.[0]?.total || 0),
            limit: safeIncidentLimit,
            offset: safeIncidentOffset,
          },
          rateLimitEvents: {
            total: Number(rateLimitTotalRow?.[0]?.total || 0),
            limit: safeRateLimitLimit,
            offset: safeRateLimitOffset,
          },
        },
        breakdown: {
          endpointFamilies: Object.entries(
            incidentRows.reduce((acc: Record<string, number>, row: any) => {
              acc[row.endpointFamily] = (acc[row.endpointFamily] || 0) + 1;
              return acc;
            }, {}),
          )
            .map(([label, count]) => ({ label, count: Number(count) }))
            .sort((a, b) => Number(b.count) - Number(a.count)),
          incidentTypes: Object.entries(
            incidentRows.reduce((acc: Record<string, number>, row: any) => {
              acc[row.incidentType] = (acc[row.incidentType] || 0) + 1;
              return acc;
            }, {}),
          )
            .map(([label, count]) => ({ label, count: Number(count) }))
            .sort((a, b) => Number(b.count) - Number(a.count)),
          actionsTaken: Object.entries(
            incidentRows.reduce((acc: Record<string, number>, row: any) => {
              const key = row.actionTaken || "none";
              acc[key] = (acc[key] || 0) + 1;
              return acc;
            }, {}),
          )
            .map(([label, count]) => ({ label, count: Number(count) }))
            .sort((a, b) => Number(b.count) - Number(a.count)),
        },
        actorState: actorState
          ? {
              id: actorState.id,
              actorKey: actorState.actorKey,
              currentScore: actorState.currentScore,
              strikeCount: actorState.strikeCount,
              cooldownUntil: actorState.cooldownUntil,
              contentLockUntil: actorState.contentLockUntil,
              lastIncidentAt: actorState.lastIncidentAt,
              lastExactEndpointKey: actorState.lastExactEndpointKey,
            }
          : null,
        protectedIncidents: incidentRows.map((row: any) => ({
          id: Number(row.id),
          userId: row.userId ? Number(row.userId) : null,
          name: row.name || null,
          email: row.email || null,
          ip: row.ip,
          endpointFamily: row.endpointFamily,
          incidentType: row.incidentType,
          severity: row.severity,
          actionTaken: row.actionTaken || null,
          exactEndpointKey: row.exactEndpointKey,
          normalizedRoute: row.normalizedRoute,
          hitCountInWindow: Number(row.hitCountInWindow || 0),
          distinctTargetCountInWindow: Number(row.distinctTargetCountInWindow || 0),
          createdAt: row.createdAt,
        })),
        rateLimitEvents: rateLimitEvents.map((row: any) => ({
          id: Number(row.id),
          userId: row.userId ? Number(row.userId) : null,
          name: row.name || null,
          email: row.email || null,
          ip: row.ip,
          path: row.path,
          method: row.method,
          totalHits: Number(row.totalHits || 0),
          limit: Number(row.limit || 0),
          ttlSeconds: Number(row.ttlSeconds || 0),
          userAgent: row.userAgent || null,
          createdAt: row.createdAt,
        })),
        activityAlerts: activityAlertRows.map((row: any) => ({
          date: row.date,
          events: Number(row.events || 0),
          level:
            Number(row.events || 0) >= highestThreshold
              ? "highest"
              : Number(row.events || 0) >= highThreshold
                ? "high"
                : "medium",
        })),
        testCreationAlerts: testCreationAlerts.map((row: any) => ({
          date: row.date,
          count: Number(row.count || 0),
        })),
      },
    };
  }

  async getTimeline(params: {
    userId: number;
    limit?: number;
    offset?: number;
    feature?: string;
    action?: string;
    from?: string;
    to?: string;
  }) {
    const {
      userId,
      limit = 50,
      offset = 0,
      feature,
      action,
      from,
      to,
    } = params;
    const { fromDate, toDate } = this.resolveRange(from, to, 30);

    const query = this.activityRepo
      .createQueryBuilder("log")
      .where("log.userId = :userId", { userId })
      .andWhere("log.createdAt BETWEEN :from AND :to", {
        from: fromDate,
        to: toDate,
      });

    if (feature) {
      query.andWhere("log.feature = :feature", { feature });
    }
    if (action) {
      query.andWhere("log.action = :action", { action });
    }

    const [data, total] = await query
      .orderBy("log.createdAt", "DESC")
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return {
      success: true,
      data,
      total,
      limit,
      offset,
    };
  }

  async getSummary(params: { userId: number; from?: string; to?: string }) {
    const { userId, from, to } = params;
    const { fromDate, toDate } = this.resolveRange(from, to, 30);

    const totalEventsResult = await this.activityRepo.query(
      `
      SELECT COUNT(*)::int AS count
      FROM user_activity_logs
      WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
    `,
      [userId, fromDate, toDate],
    );
    const totalEvents = totalEventsResult?.[0]?.count ?? 0;

    const dailyCounts = await this.activityRepo.query(
      `
      SELECT DATE_TRUNC('day', created_at) AS day, COUNT(*)::int AS count
      FROM user_activity_logs
      WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
      GROUP BY day
      ORDER BY day ASC
    `,
      [userId, fromDate, toDate],
    );

    const featureCountsByDay = await this.activityRepo.query(
      `
      SELECT DATE_TRUNC('day', created_at) AS day, feature, COUNT(*)::int AS count
      FROM user_activity_logs
      WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
      GROUP BY day, feature
      ORDER BY day ASC
    `,
      [userId, fromDate, toDate],
    );

    const actionCountsByFeature = await this.activityRepo.query(
      `
      SELECT feature, action, COUNT(*)::int AS count
      FROM user_activity_logs
      WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
      GROUP BY feature, action
      ORDER BY feature ASC, count DESC
    `,
      [userId, fromDate, toDate],
    );

    const hourlyActivity = await this.activityRepo.query(
      `
      SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS count
      FROM user_activity_logs
      WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
      GROUP BY hour
      ORDER BY hour ASC
    `,
      [userId, fromDate, toDate],
    );

    const topEntitiesRaw = await this.activityRepo.query(
      `
      SELECT
        feature,
        entity_type,
        entity_id,
        COUNT(*)::int AS count,
        MAX(metadata->>'qBankName') AS qbank_name,
        MAX(metadata->>'articleTitle') AS article_title,
        MAX(metadata->>'title') AS title
      FROM user_activity_logs
      WHERE user_id = $1
        AND created_at BETWEEN $2 AND $3
        AND entity_id IS NOT NULL
        AND entity_id <> ''
      GROUP BY feature, entity_type, entity_id
      ORDER BY count DESC
    `,
      [userId, fromDate, toDate],
    );

    const topEntitiesByFeature: Record<string, any[]> = {};
    topEntitiesRaw.forEach((row: any) => {
      const feature = row.feature || "Other";
      if (!topEntitiesByFeature[feature]) topEntitiesByFeature[feature] = [];
      if (topEntitiesByFeature[feature].length >= 5) return;

      const label =
        row.qbank_name ||
        row.article_title ||
        row.title ||
        (row.entity_type
          ? `${row.entity_type} #${row.entity_id}`
          : `#${row.entity_id}`);

      topEntitiesByFeature[feature].push({
        entityType: row.entity_type,
        entityId: row.entity_id,
        count: row.count,
        label,
      });
    });

    const activityTimes = await this.activityRepo
      .createQueryBuilder("log")
      .select("log.createdAt", "createdAt")
      .where("log.userId = :userId", { userId })
      .andWhere("log.createdAt BETWEEN :from AND :to", {
        from: fromDate,
        to: toDate,
      })
      .orderBy("log.createdAt", "ASC")
      .getRawMany();

    const sessionGapMs = 30 * 60 * 1000;
    let sessionCount = 0;
    let totalSessionDurationMs = 0;
    const totalEventsFromActivity = activityTimes.length;
    let sessionStart: number | null = null;
    let lastEventTime: number | null = null;
    let sessionEvents = 0;
    const sessionEventCounts: number[] = [];

    activityTimes.forEach((row: any) => {
      const time = new Date(row.createdAt).getTime();
      if (!lastEventTime || time - lastEventTime > sessionGapMs) {
        if (sessionStart !== null && lastEventTime !== null) {
          totalSessionDurationMs += lastEventTime - sessionStart;
          sessionEventCounts.push(sessionEvents);
        }
        sessionCount += 1;
        sessionStart = time;
        sessionEvents = 0;
      }
      sessionEvents += 1;
      lastEventTime = time;
    });

    if (sessionStart !== null && lastEventTime !== null) {
      totalSessionDurationMs += lastEventTime - sessionStart;
      sessionEventCounts.push(sessionEvents);
    }

    const avgSessionMinutes =
      sessionCount > 0 ? totalSessionDurationMs / sessionCount / 60000 : 0;
    const avgEventsPerSession =
      sessionCount > 0 ? totalEventsFromActivity / sessionCount : 0;

    const lastActiveAt =
      activityTimes.length > 0
        ? activityTimes[activityTimes.length - 1].createdAt
        : null;

    const ipRows = await this.activityRepo.query(
      `
      SELECT
        ip_address AS "ipAddress",
        country,
        region,
        city,
        timezone,
        COUNT(*)::int AS count,
        MAX(created_at) AS "lastSeenAt"
      FROM user_activity_logs
      WHERE user_id = $1
        AND created_at BETWEEN $2 AND $3
        AND ip_address IS NOT NULL
        AND ip_address <> ''
      GROUP BY ip_address, country, region, city, timezone
      ORDER BY "lastSeenAt" DESC
    `,
      [userId, fromDate, toDate],
    );

    const locationRows = await this.activityRepo.query(
      `
      SELECT
        country,
        region,
        city,
        timezone,
        COUNT(*)::int AS count,
        MAX(created_at) AS "lastSeenAt"
      FROM user_activity_logs
      WHERE user_id = $1
        AND created_at BETWEEN $2 AND $3
        AND (country IS NOT NULL OR region IS NOT NULL OR city IS NOT NULL)
      GROUP BY country, region, city, timezone
      ORDER BY "lastSeenAt" DESC
    `,
      [userId, fromDate, toDate],
    );

    const lastLocationRow = await this.activityRepo
      .createQueryBuilder("log")
      .select([
        "log.ipAddress AS ipAddress",
        "log.country AS country",
        "log.region AS region",
        "log.city AS city",
        "log.timezone AS timezone",
        "log.latitude AS latitude",
        "log.longitude AS longitude",
      ])
      .where("log.userId = :userId", { userId })
      .andWhere("log.createdAt BETWEEN :from AND :to", {
        from: fromDate,
        to: toDate,
      })
      .orderBy("log.createdAt", "DESC")
      .limit(1)
      .getRawOne();

    return {
      success: true,
      data: {
        range: {
          from: fromDate,
          to: toDate,
        },
        totalEvents,
        dailyCounts,
        featureCountsByDay,
        actionCountsByFeature,
        hourlyActivity,
        topEntitiesByFeature,
        sessionStats: {
          sessionCount,
          avgSessionMinutes,
          avgEventsPerSession,
          lastActiveAt,
          lastLocation: lastLocationRow ? lastLocationRow : null,
        },
        locationStats: {
          uniqueIpCount: ipRows.length,
          uniqueLocationCount: locationRows.length,
          ips: ipRows.map((row: any) => ({
            ipAddress: row.ipAddress,
            locationLabel: [row.city, row.region, row.country]
              .filter(Boolean)
              .join(", "),
            timezone: row.timezone,
            count: row.count,
            lastSeenAt: row.lastSeenAt,
          })),
          locations: locationRows.map((row: any) => ({
            label: [row.city, row.region, row.country]
              .filter(Boolean)
              .join(", "),
            timezone: row.timezone,
            count: row.count,
            lastSeenAt: row.lastSeenAt,
          })),
        },
      },
    };
  }
}
