import { Module } from '@nestjs/common';

import { AdminAccountService } from './admin-account.service.js';
import { AdminReportController, SuperAdminController } from './admin.controller.js';
import { AuditLogService } from './audit-log.service.js';
import { ReportService } from './report.service.js';
import { SuperAdminSeeder } from './super-admin.seeder.js';
import { UserModule } from '../user/user.module.js';

@Module({
  imports: [UserModule],
  controllers: [AdminReportController, SuperAdminController],
  providers: [ReportService, AdminAccountService, AuditLogService, SuperAdminSeeder],
})
export class AdminModule {}
