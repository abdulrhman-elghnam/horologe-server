import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';

import { RealtimeRoom } from './realtime.event.js';

@Injectable()
export class RealtimeService {
  private server?: Namespace;

  attach(server: Namespace) {
    this.server = server;
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(RealtimeRoom.user(userId)).emit(event, payload);
  }

  emitToAdmins(event: string, payload: unknown) {
    this.server?.to(RealtimeRoom.admins).emit(event, payload);
  }

  emitToRoom(room: string, event: string, payload: unknown) {
    this.server?.to(room).emit(event, payload);
  }

  /** Closes sockets opened with a session's tokens (after logout / session revoke). */
  disconnectSession(sessionId: string) {
    this.server?.in(RealtimeRoom.session(sessionId)).disconnectSockets(true);
  }

  /** Closes every socket of a user (after password reset / logout from all devices / account disabled). */
  disconnectUser(userId: string) {
    this.server?.in(RealtimeRoom.user(userId)).disconnectSockets(true);
  }
}
