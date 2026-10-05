import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Notification,
  NotificationAudience,
  NotificationType,
} from "../entities/notification.entity";
import { NotificationRead } from "../entities/notification-read.entity";

type AdminNotificationPayload = {
  title: string;
  message: string;
  type?: NotificationType;
  metadata?: Record<string, any> | null;
  userId?: number | null;
};

@Injectable()
export class AdminNotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepo: Repository<Notification>,
    @InjectRepository(NotificationRead)
    private notificationReadsRepo: Repository<NotificationRead>,
  ) {}

  async createAdminNotification(payload: AdminNotificationPayload) {
    const notification = this.notificationsRepo.create({
      audience: NotificationAudience.ADMIN,
      userId: payload.userId ?? null,
      title: payload.title,
      message: payload.message,
      type: payload.type ?? NotificationType.INFO,
      metadata: payload.metadata ?? null,
      isRead: false,
      readAt: null,
    });

    await this.notificationsRepo.save(notification);
    return notification;
  }

  async getAdminNotifications(params: {
    adminId: number;
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    since?: Date;
  }) {
    const limit = Math.max(1, Math.min(50, params.limit ?? 10));
    const offset = Math.max(0, params.offset ?? 0);

    const qb = this.notificationsRepo
      .createQueryBuilder("n")
      .leftJoin(
        NotificationRead,
        "r",
        "r.notification_id = n.id AND r.admin_id = :adminId",
        { adminId: params.adminId },
      )
      .where("n.audience = :audience", {
        audience: NotificationAudience.ADMIN,
      })
      .addSelect("CASE WHEN r.id IS NULL THEN false ELSE true END", "is_read");

    if (params.since) {
      qb.andWhere("n.createdAt > :since", { since: params.since });
    }

    if (params.unreadOnly) {
      qb.andWhere("r.id IS NULL");
    }

    const total = await qb.getCount();

    const { entities, raw } = await qb
      .orderBy("n.createdAt", "DESC")
      .take(limit)
      .skip(offset)
      .getRawAndEntities();

    const data = entities.map((entity, index) => ({
      ...entity,
      isRead: raw[index]?.is_read === true || raw[index]?.is_read === "true",
    }));

    const unreadCount = await this.notificationsRepo
      .createQueryBuilder("n")
      .leftJoin(
        NotificationRead,
        "r",
        "r.notification_id = n.id AND r.admin_id = :adminId",
        { adminId: params.adminId },
      )
      .where("n.audience = :audience", {
        audience: NotificationAudience.ADMIN,
      })
      .andWhere("r.id IS NULL")
      .getCount();

    return {
      success: true,
      data,
      total,
      unreadCount,
    };
  }

  async markAdminNotificationsRead(params: {
    adminId: number;
    ids?: number[];
    all?: boolean;
  }) {
    if (params.all) {
      const unreadIds = await this.notificationsRepo
        .createQueryBuilder("n")
        .leftJoin(
          NotificationRead,
          "r",
          "r.notification_id = n.id AND r.admin_id = :adminId",
          { adminId: params.adminId },
        )
        .where("n.audience = :audience", {
          audience: NotificationAudience.ADMIN,
        })
        .andWhere("r.id IS NULL")
        .select("n.id", "id")
        .getRawMany<{ id: number }>();

      const ids = unreadIds.map((row) => row.id);
      if (!ids.length) {
        return { success: true, updated: 0 };
      }

      const payload = ids.map((id) => ({
        notificationId: id,
        adminId: params.adminId,
      }));

      await this.notificationReadsRepo
        .createQueryBuilder()
        .insert()
        .into(NotificationRead)
        .values(payload)
        .orIgnore()
        .execute();

      return { success: true, updated: ids.length };
    }

    const ids = (params.ids || []).filter((id) => Number.isFinite(id));
    if (!ids.length) {
      return {
        success: true,
        updated: 0,
      };
    }

    const payload = ids.map((id) => ({
      notificationId: id,
      adminId: params.adminId,
    }));

    const result = await this.notificationReadsRepo
      .createQueryBuilder()
      .insert()
      .into(NotificationRead)
      .values(payload)
      .orIgnore()
      .execute();

    return {
      success: true,
      updated: result.identifiers?.length ?? 0,
    };
  }
}
