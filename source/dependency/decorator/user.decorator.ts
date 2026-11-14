import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { CtxType, IAuthReq, IAuthSocket, ICredentials } from '../interface/ctx.interface.js';
import type { User } from '../../database/model/user.model.js';

const credentialsOf = (context: ExecutionContext): ICredentials | undefined => {
  switch (context.getType<CtxType>()) {
    case 'http':
      return context.switchToHttp().getRequest<IAuthReq>().credentials;
    case 'ws':
      return context.switchToWs().getClient<IAuthSocket>().credentials;
    default:
      return undefined;
  }
};

/** The signed-in user (set by AuthGuard). `@CurrentUser('id')` returns a single field. */
export const CurrentUser = createParamDecorator((field: keyof User | undefined, context: ExecutionContext) => {
  const user = credentialsOf(context)?.user;
  return field ? user?.[field] : user;
});

/** Id of the current login session (the token's `sid`). */
export const SessionId = createParamDecorator((_: unknown, context: ExecutionContext) => credentialsOf(context)?.decoded.sid);
