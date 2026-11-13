import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UserRepository } from '../../database/repository/user.repository.js';
import { SecurityService, isUniqueViolation } from '../../dependency/service/_INDEX.js';
import { AuthProviderEnum, SystemRoleEnum } from '../../dependency/value/security.enum.js';

@Injectable()
export class SuperAdminSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(SuperAdminSeeder.name);

  constructor(
    private readonly config: ConfigService,
    private readonly users: UserRepository,
    private readonly security: SecurityService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get<string>('admin.email')?.trim().toLowerCase();
    const password = this.config.get<string>('admin.password');
    if (!email && !password) return;

    if (await this.users.exists({ where: { role: SystemRoleEnum.SUPER_ADMIN } })) return;

    if (!email || !password) {
      this.logger.warn('Set both ADMIN_EMAIL and ADMIN_PASSWORD to create the first super admin');
      return;
    }

    if (password.length < 12) {
      this.logger.error('ADMIN_PASSWORD must be at least 12 characters; super admin not created');
      return;
    }
    if (await this.users.emailExists(email)) {
      this.logger.warn(`ADMIN_EMAIL ${email} already belongs to a non-super-admin account; super admin not created`);
      return;
    }

    try {
      await this.users.createAuthUser({
        name: this.config.get<string>('admin.name', 'Super Admin'),
        email,
        passwordHash: await this.security.hash(password),
        city: this.config.get<string>('admin.city', 'Cairo'),
        role: SystemRoleEnum.SUPER_ADMIN,
        provider: AuthProviderEnum.SYSTEM,
        emailVerifiedAt: new Date(),
      });
      this.logger.log(`Created super admin ${email}`);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
}
