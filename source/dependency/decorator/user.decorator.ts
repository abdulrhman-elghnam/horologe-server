import { createParamDecorator, ExecutionContext } from '@nestjs/common';


import { CtxType, IAuthReq, IAuthSocket } from '../interface/ctx.interface.js';
import { IUser } from '../interface/database.interface.js';

export const User = createParamDecorator((data: keyof IUser | undefined, context: ExecutionContext) => {
  let user!: IUser;

  switch (context.getType<CtxType>()) {
    case 'http':
      user = (context.switchToHttp().getRequest() as IAuthReq).credentials.user;
      break;

    case 'ws':
      user = (context.switchToWs().getClient() as IAuthSocket).credentials.user;
      break;

    default:
      return null;
  }

  return data ? user[data] : user;
});
