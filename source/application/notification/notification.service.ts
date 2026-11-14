import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { FindOptionsWhere } from 'typeorm';

import type { NotificationQueryDto } from './dto/notification.dto.js';
import { RealtimeEvent, type RealtimeEventName } from '../realtime/realtime.event.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import type { Notification } from '../../database/model/notification.model.js';
import { NotificationRepository } from '../../database/repository/notification.repository.js';
import { CacheService, RedisKeys } from '../../dependency/service/cache.service.js';
import { NotificationTypeEnum } from '../../dependency/value/database.enum.js';

const UNREAD_COUNT_TTL_SECONDS = 10 * 60;

export interface NotifyInput {
  userId: string;
  type: NotificationTypeEnum;
  title: string;
  message: string;
  referenceId?: string | null;
  data?: Record<string, unknown>;
  /** Domain event to emit to the user's room as well (e.g. `order:shipped`). */
  event?: RealtimeEventName;
  eventPayload?: unknown;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notifications: NotificationRepository,
    private readonly realtime: RealtimeService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Saves the notification, then delivers it live. Saving comes first so a client that is offline
   * (or misses the socket event) still finds it in GET /notifications.
   * Never throws: a failed notification must not fail the business action that triggered it.
   */
  async notify(input: NotifyInput): Promise<void> {
    try {
      const notification = await this.notifications.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          referenceId: input.referenceId ?? null,
          data: input.data ?? null,
        },
      });
      await this.cache.deleteCache({ key: RedisKeys.unreadNotifications(input.userId) });

      if (input.event) this.realtime.emitToUser(input.userId, input.event, input.eventPayload ?? input.data ?? {});
      this.realtime.emitToUser(input.userId, RealtimeEvent.NOTIFICATION_NEW, notification);
      await this.pushUnreadCount(input.userId);
    } catch (error) {
      this.logger.error(`Notification for user ${input.userId} failed: ${(error as Error).message}`);
    }
  }

  list(userId: string, { page, limit, unreadOnly, type }: NotificationQueryDto) {
    const where: FindOptionsWhere<Notification> = { userId };
    if (unreadOnly) where.isRead = false;
    if (type) where.type = type;
    return this.notifications.paginate({ where, page, size: limit, options: { order: { createdAt: 'DESC' } } });
  }

  /** Served from Redis; recomputed from Postgres on a miss. */
  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.cache.getOrSet({
      key: RedisKeys.unreadNotifications(userId),
      ttl: UNREAD_COUNT_TTL_SECONDS,
      factory: () => this.notifications.countUnread(userId),
    });
    return { count: Number(count) };
  }

  async markRead(userId: string, notificationId: string): Promise<Notification> {
    const notification = await this.notifications.findOne({ where: { id: notificationId, userId } });
    if (!notification) throw new NotFoundException('Notification not found');

    if (!notification.isRead) {
      await this.notifications.updateMany({ where: { id: notification.id }, data: { isRead: true, readAt: new Date() } });
      notification.isRead = true;
      notification.readAt = new Date();
      await this.afterReadChange(userId, [notification.id]);
    }
    return notification;
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notifications.updateMany({ where: { userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
    await this.afterReadChange(userId, 'all');
    return { updated: result.affected ?? 0 };
  }

  async remove(userId: string, notificationId: string): Promise<{ deleted: true }> {
    const result = await this.notifications.deleteMany({ where: { id: notificationId, userId } });
    if (!result.affected) throw new NotFoundException('Notification not found');
    await this.cache.deleteCache({ key: RedisKeys.unreadNotifications(userId) });
    await this.pushUnreadCount(userId);
    return { deleted: true };
  }

  async removeAll(userId: string): Promise<{ deleted: number }> {
    const result = await this.notifications.deleteMany({ where: { userId } });
    await this.cache.deleteCache({ key: RedisKeys.unreadNotifications(userId) });
    await this.pushUnreadCount(userId);
    return { deleted: result.affected ?? 0 };
  }

  private async afterReadChange(userId: string, ids: string[] | 'all') {
    await this.cache.deleteCache({ key: RedisKeys.unreadNotifications(userId) });
    this.realtime.emitToUser(userId, RealtimeEvent.NOTIFICATION_READ, { ids });
    await this.pushUnreadCount(userId);
  }

  private async pushUnreadCount(userId: string) {
    this.realtime.emitToUser(userId, RealtimeEvent.NOTIFICATION_COUNT_UPDATED, await this.unreadCount(userId));
  }
}
