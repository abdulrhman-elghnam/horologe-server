import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthGuard, RolesGuard } from '../guard/_INDEX.js';
import { MailService, SecurityService, TokenService, UtilService } from '../service/_INDEX.js';

const PROVIDERS = [TokenService, SecurityService, UtilService, MailService, AuthGuard, RolesGuard];

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: PROVIDERS,
  exports: PROVIDERS,
})
export class SecurityModule {}
