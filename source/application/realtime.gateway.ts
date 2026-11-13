import { Logger, UnauthorizedException } from '@nestjs/common';
import { WebSocketGateway, type OnGatewayConnection, type OnGatewayInit } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';

import { RealtimeEvent, RealtimeRoom } from './realtime.event.js';
import { RealtimeService } from './realtime.service.js';
import { TokenService, UtilService } from '../dependency/service/_INDEX.js';
import { SystemRoleEnum, TokenEnum } from '../dependency/value/security.enum.js';
import type { IAuthSocket } from '../dependency/interface/ctx.interface.js';

const ADMIN_ROLES = new Set<SystemRoleEnum>([SystemRoleEnum.ADMIN, SystemRoleEnum.SUPER_ADMIN]);

/**
 * Clients connect with `io('<host>/realtime', { auth: { token: '<access token>' } })`.
 * The user and role come only from the verified token, never from client data.
 */
@WebSocketGateway({ namespace: '/realtime', cors: { origin: process.env.FRONTEND_URL?.split(',') ?? true, credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly tokens: TokenService,
    private readonly util: UtilService,
  ) {}

  afterInit(server: Namespace) {
    this.realtimeService.attach(server);
  }

  /** Guards don't run on connect, so the handshake token is verified here. */
  async handleConnection(client: Socket) {
    try {
      const raw = this.util.getAuthSocket(client)?.trim();
      const token = raw?.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : raw;
      if (!token) {
        throw new UnauthorizedException('Missing authorization');
      }

      const credentials = await this.tokens.decodeToken({ token, tokenType: TokenEnum.ACCESS });
      const { user, decoded } = credentials;
      (client as IAuthSocket).credentials = credentials;

      const rooms = [RealtimeRoom.user(user.id), RealtimeRoom.session(decoded.sid)];
      if (ADMIN_ROLES.has(user.role)) {
        rooms.push(RealtimeRoom.admins, RealtimeRoom.admin(user.id));
      }
      await client.join(rooms);

      client.emit(RealtimeEvent.READY, { userId: user.id, role: user.role });
    } catch (error) {
      const message = error instanceof UnauthorizedException ? error.message : 'Authentication failed';
      if (!(error instanceof UnauthorizedException)) {
        this.logger.warn(`Socket auth failed: ${(error as Error).message}`);
      }
      client.emit(RealtimeEvent.ERROR, { code: 'UNAUTHORIZED', message });
      client.disconnect(true);
    }
  }
}
