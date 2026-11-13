import { Socket } from 'socket.io';

import { Request } from 'express';
import type { User } from '../../database/model/user.model.js';
import type { AuthTokenPayload } from '../service/token.service.js';

export interface ICredentials {
  user: User;
  decoded: AuthTokenPayload;
}

export interface IAuthReq extends Request {
  credentials: ICredentials;
}

export interface IAuthSocket extends Socket {
  credentials: ICredentials;
}

export type CtxType = 'http' | 'ws' | 'graphql';
