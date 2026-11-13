import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { HUserDocument } from '../../database/model/user.model.js';
import { CtxType, IAuthReq, IAuthSocket } from '../interface/ctx.interface.js';

export const User = createParamDecorator((data: keyof HUserDocument | undefined, context: ExecutionContext) => {
  let user!: HUserDocument;

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
