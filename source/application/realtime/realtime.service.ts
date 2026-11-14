import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';

import { RealtimeRoom, type RealtimeEventName } from './realtime.event.js';
import { CacheService, RedisKeys } from '../../dependency/service/cache.service.js';

const PRESENCE_TTL_SECONDS = 24 * 60 * 60;

/**
 * The only way the rest of the app talks to Socket.IO clients.
 * Services persist state first, then call these methods (fire-and-forget).
 */
@Injectable()
export class RealtimeService {
  private server?: Namespace;

  constructor(private readonly cache: CacheService) {}

  attach(server: Namespace) {
    this.server = server;
  }

  emitToUser(userId: string, event: RealtimeEventName, payload: unknown) {
    this.server?.to(RealtimeRoom.user(userId)).emit(event, payload);
  }

  emitToAdmins(event: RealtimeEventName, payload: unknown) {
    this.server?.to(RealtimeRoom.admins).emit(event, payload);
  }

  emitToOrder(orderId: string, event: RealtimeEventName, payload: unknown) {
    this.server?.to(RealtimeRoom.order(orderId)).emit(event, payload);
  }

  emitToWatch(watchId: string, event: RealtimeEventName, payload: unknown) {
    this.server?.to(RealtimeRoom.watch(watchId)).emit(event, payload);
  }

  emitToInventory(event: RealtimeEventName, payload: unknown) {
    this.server?.to(RealtimeRoom.inventory).emit(event, payload);
  }

  disconnectSession(sessionId: string) {
    this.server?.in(RealtimeRoom.session(sessionId)).disconnectSockets(true);
  }

  disconnectUser(userId: string) {
    this.server?.in(RealtimeRoom.user(userId)).disconnectSockets(true);
  }

  // ── Presence (Redis): how many sockets a user has open ──

  async markOnline(userId: string): Promise<void> {
    await this.cache.incrementCache({ key: RedisKeys.socketPresence(userId), ttl: PRESENCE_TTL_SECONDS });
  }

  async markOffline(userId: string): Promise<void> {
    const remaining = await this.cache.decrementCache({ key: RedisKeys.socketPresence(userId) });
    if (remaining <= 0) await this.cache.deleteCache({ key: RedisKeys.socketPresence(userId) });
  }

  async isOnline(userId: string): Promise<boolean> {
    return Number((await this.cache.getCache<number>({ key: RedisKeys.socketPresence(userId) })) ?? 0) > 0;
  }
}
