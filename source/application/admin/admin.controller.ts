import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminAccountService } from './admin-account.service.js';
import { AuditLogService } from './audit-log.service.js';
import { AdminListQueryDto, AuditLogQueryDto, CreateAdminDto, ReportQueryDto, UpdateAdminDto } from './dto/admin.dto.js';
import { ReportService } from './report.service.js';
import { AdminOnly, Audit, CurrentUser, SuperAdminOnly } from '../../dependency/decorator/_INDEX.js';
import { StatusDto } from '../../dependency/dto/common.dto.js';

/** ?from&to (default: last 30 days), ?groupBy=day|week|month, ?limit for top-N lists. */
@AdminOnly()
@ApiTags('Admin · Reports')
@Controller('admin')
export class AdminReportController {
  constructor(private readonly reports: ReportService) {}

  @Get('dashboard/summary')
  dashboard() {
    return this.reports.dashboard();
  }

  @Get('reports/sales')
  sales(@Query() query: ReportQueryDto) {
    return this.reports.sales(query);
  }

  @Get('reports/orders')
  orders(@Query() query: ReportQueryDto) {
    return this.reports.orders(query);
  }

  @Get('reports/products')
  products(@Query() query: ReportQueryDto) {
    return this.reports.products(query);
  }

  @Get('reports/inventory')
  inventory(@Query() query: ReportQueryDto) {
    return this.reports.inventory(query);
  }

  @Get('reports/customers')
  customers(@Query() query: ReportQueryDto) {
    return this.reports.customers(query);
  }
}

@SuperAdminOnly()
@ApiTags('Super admin')
@Controller('super-admin')
export class SuperAdminController {
  constructor(
    private readonly admins: AdminAccountService,
    private readonly auditLogs: AuditLogService,
  ) {}

  @Get('admins')
  list(@Query() query: AdminListQueryDto) {
    return this.admins.list(query);
  }

  @Audit('admin.create', 'admin')
  @Post('admins')
  create(@Body() body: CreateAdminDto) {
    return this.admins.create(body);
  }

  @Get('admins/:adminId')
  get(@Param('adminId', ParseUUIDPipe) adminId: string) {
    return this.admins.get(adminId);
  }

  @Audit('admin.update', 'admin', 'adminId')
  @Patch('admins/:adminId')
  update(@Param('adminId', ParseUUIDPipe) adminId: string, @Body() body: UpdateAdminDto) {
    return this.admins.update(adminId, body);
  }

  @Audit('admin.status.update', 'admin', 'adminId')
  @Patch('admins/:adminId/status')
  setStatus(@CurrentUser('id') actorId: string, @Param('adminId', ParseUUIDPipe) adminId: string, @Body() { isActive }: StatusDto) {
    return this.admins.setStatus(actorId, adminId, isActive);
  }

  @Get('audit-logs')
  logs(@Query() query: AuditLogQueryDto) {
    return this.auditLogs.list(query);
  }

  @Get('audit-logs/:logId')
  log(@Param('logId', ParseUUIDPipe) logId: string) {
    return this.auditLogs.get(logId);
  }
}
