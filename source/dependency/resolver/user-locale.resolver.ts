import { LocaleResolver, type LocaleResolverInput } from '@nestjs/i18n';
import type { IAuthReq, IAuthSocket } from '../interface/ctx.interface.js';

export class UserLocaleResolver extends LocaleResolver {
  readonly afterGuards = true;

  resolve({ executionContext }: LocaleResolverInput): string | undefined {
    if (!executionContext) return undefined;
    const holder =
      executionContext.getType() === 'ws'
        ? executionContext.switchToWs().getClient<IAuthSocket>()
        : executionContext.getType() === 'http'
          ? executionContext.switchToHttp().getRequest<IAuthReq>()
          : undefined;
    return holder?.credentials?.user?.language ?? undefined;
  }
}
