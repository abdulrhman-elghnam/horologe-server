import { JwtPayload } from 'jsonwebtoken';
import { Socket } from 'socket.io';

import { Request } from 'express';
import { IUser } from './database.interface.js';


export interface IAuthReq extends Request {
  credentials: { user: IUser; decoded: JwtPayload };
}

export interface IAuthSocket extends Socket {
  credentials: { user: IUser; decoded: JwtPayload };
}

export type CtxType = 'http' | 'ws' | 'graphql';
