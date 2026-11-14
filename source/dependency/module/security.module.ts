import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthGuard, RolesGuard } from '../guard/_INDEX.js';
import { MailService, SecurityService, StorageService, TokenService, UtilService } from '../service/_INDEX.js';

const PROVIDERS = [TokenService, SecurityService, UtilService, MailService, StorageService, AuthGuard, RolesGuard];

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: PROVIDERS,
  exports: PROVIDERS,
})
export class SecurityModule {}
