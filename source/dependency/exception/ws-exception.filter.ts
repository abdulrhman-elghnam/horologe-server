import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

import { RealtimeEvent } from '../../application/realtime/realtime.event.js';

/** Sends every gateway error to the client as a `realtime:error` event instead of the default `exception`. */
@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const event = host.switchToWs().getPattern();

    let code = 'INTERNAL_ERROR';
    let message: string | string[] = 'Something went wrong';

    if (exception instanceof WsException) {
      const error = exception.getError();
      code = 'BAD_REQUEST';
      message = typeof error === 'string' ? error : ((error as { message?: string | string[] }).message ?? message);
    } else if (exception instanceof HttpException) {
      const response = exception.getResponse();
      code = HttpStatusCode[exception.getStatus()] ?? 'ERROR';
      message = typeof response === 'string' ? response : ((response as { message?: string | string[] }).message ?? exception.message);
    }

    client.emit(RealtimeEvent.ERROR, { event, code, message });
  }
}

const HttpStatusCode: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
};
