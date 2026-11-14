import { ForbiddenException, Logger, NotFoundException, UnauthorizedException, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';

import { OrderRoomDto, WatchRoomDto } from './realtime.dto.js';
import { RealtimeEvent, RealtimeRoom } from './realtime.event.js';
import { RealtimeService } from './realtime.service.js';
import { OrderRepository } from '../../database/repository/order.repository.js';
import { WatchRepository } from '../../database/repository/watch.repository.js';
import { WsExceptionFilter } from '../../dependency/exception/ws-exception.filter.js';
import type { IAuthSocket } from '../../dependency/interface/ctx.interface.js';
import { TokenService } from '../../dependency/service/token.service.js';
import { UtilService } from '../../dependency/service/util.service.js';
import { WatchStatusEnum } from '../../dependency/value/database.enum.js';
import { SystemRoleEnum, TokenEnum } from '../../dependency/value/security.enum.js';

const ADMIN_ROLES = new Set<SystemRoleEnum>([SystemRoleEnum.ADMIN, SystemRoleEnum.SUPER_ADMIN]);

const wsValidation = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  exceptionFactory: (errors) => new WsException({ message: errors.flatMap((error) => Object.values(error.constraints ?? {})) }),
});

/**
 * Socket.IO `/realtime` namespace.
 * - The JWT from the handshake decides who the client is; nothing the client sends about itself is trusted.
 * - Every room join is authorized here. Clients can only subscribe; they never emit business events.
 */
@UseFilters(WsExceptionFilter)
@UsePipes(wsValidation)
@WebSocketGateway({ namespace: '/realtime', cors: { origin: process.env.FRONTEND_URL?.split(',') ?? true, credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly realtime: RealtimeService,
    private readonly tokens: TokenService,
    private readonly util: UtilService,
    private readonly orders: OrderRepository,
    private readonly watches: WatchRepository,
  ) {}

  afterInit(server: Namespace) {
    this.realtime.attach(server);
  }

  async handleConnection(client: Socket) {
    try {
      const raw = this.util.getAuthSocket(client)?.trim();
      const token = raw?.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : raw;
      if (!token) throw new UnauthorizedException('Missing authorization');

      const credentials = await this.tokens.decodeToken({ token, tokenType: TokenEnum.ACCESS });
      const { user, decoded } = credentials;
      (client as IAuthSocket).credentials = credentials;

      const rooms = [RealtimeRoom.user(user.id), RealtimeRoom.session(decoded.sid)];
      if (ADMIN_ROLES.has(user.role)) rooms.push(RealtimeRoom.admins, RealtimeRoom.admin(user.id));
      await client.join(rooms);
      await this.realtime.markOnline(user.id);

      client.emit(RealtimeEvent.READY, { userId: user.id, role: user.role });
    } catch (error) {
      const message = error instanceof UnauthorizedException ? error.message : 'Authentication failed';
      if (!(error instanceof UnauthorizedException)) this.logger.warn(`Socket auth failed: ${(error as Error).message}`);
      client.emit(RealtimeEvent.ERROR, { code: 'UNAUTHORIZED', message });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = (client as IAuthSocket).credentials?.user.id;
    if (userId) await this.realtime.markOffline(userId).catch(() => undefined);
  }

  // ── Order room: the owner or an admin ──

  @SubscribeMessage(RealtimeEvent.ORDER_SUBSCRIBE)
  async subscribeOrder(@ConnectedSocket() client: IAuthSocket, @MessageBody() { orderId }: OrderRoomDto) {
    const { user } = this.credentialsOf(client);
    const order = await this.orders.findOne({ where: { id: orderId }, options: { select: { id: true, userId: true } } });
    if (!order || (order.userId !== user.id && !ADMIN_ROLES.has(user.role))) throw new NotFoundException('Order not found');

    await client.join(RealtimeRoom.order(orderId));
    return { subscribed: true, room: RealtimeRoom.order(orderId) };
  }

  @SubscribeMessage(RealtimeEvent.ORDER_UNSUBSCRIBE)
  async unsubscribeOrder(@ConnectedSocket() client: IAuthSocket, @MessageBody() { orderId }: OrderRoomDto) {
    await client.leave(RealtimeRoom.order(orderId));
    return { subscribed: false };
  }

  // ── Inventory room: admins only ──

  @SubscribeMessage(RealtimeEvent.INVENTORY_SUBSCRIBE)
  async subscribeInventory(@ConnectedSocket() client: IAuthSocket) {
    if (!ADMIN_ROLES.has(this.credentialsOf(client).user.role)) throw new ForbiddenException('You do not have permission to perform this action');
    await client.join(RealtimeRoom.inventory);
    return { subscribed: true, room: RealtimeRoom.inventory };
  }

  @SubscribeMessage(RealtimeEvent.INVENTORY_UNSUBSCRIBE)
  async unsubscribeInventory(@ConnectedSocket() client: IAuthSocket) {
    await client.leave(RealtimeRoom.inventory);
    return { subscribed: false };
  }

  // ── Watch room: any signed-in user, published watches only ──

  @SubscribeMessage(RealtimeEvent.WATCH_SUBSCRIBE)
  async subscribeWatch(@ConnectedSocket() client: IAuthSocket, @MessageBody() { watchId }: WatchRoomDto) {
    this.credentialsOf(client);
    if (!(await this.watches.exists({ where: { id: watchId, status: WatchStatusEnum.PUBLISHED } }))) throw new NotFoundException('Watch not found');

    await client.join(RealtimeRoom.watch(watchId));
    return { subscribed: true, room: RealtimeRoom.watch(watchId) };
  }

  @SubscribeMessage(RealtimeEvent.WATCH_UNSUBSCRIBE)
  async unsubscribeWatch(@ConnectedSocket() client: IAuthSocket, @MessageBody() { watchId }: WatchRoomDto) {
    await client.leave(RealtimeRoom.watch(watchId));
    return { subscribed: false };
  }

  private credentialsOf(client: IAuthSocket) {
    if (!client.credentials) throw new UnauthorizedException('Missing authorization');
    return client.credentials;
  }
}
