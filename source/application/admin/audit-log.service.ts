import { Injectable, NotFoundException } from '@nestjs/common';
import { Between, LessThanOrEqual, MoreThanOrEqual, type FindOptionsWhere } from 'typeorm';

import type { AuditLogQueryDto } from './dto/admin.dto.js';
import type { AuditLog } from '../../database/model/audit-log.model.js';
import { AuditLogRepository } from '../../database/repository/audit-log.repository.js';
import { sortDirection } from '../../dependency/dto/pagination.dto.js';

/** Read side of the audit log. Entries are written by AuditInterceptor from `@Audit(...)` routes. */
@Injectable()
export class AuditLogService {
  constructor(private readonly logs: AuditLogRepository) {}

  list({ page, limit, adminId, action, resource, resourceId, from, to, sortOrder }: AuditLogQueryDto) {
    const where: FindOptionsWhere<AuditLog> = {};
    if (adminId) where.adminId = adminId;
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (resourceId) where.resourceId = resourceId;
    if (from && to) where.createdAt = Between(from, to);
    else if (from) where.createdAt = MoreThanOrEqual(from);
    else if (to) where.createdAt = LessThanOrEqual(to);

    return this.logs.paginate({ where, page, size: limit, options: { order: { createdAt: sortDirection(sortOrder) } } });
  }

  async get(id: string) {
    const log = await this.logs.findById({ id });
    if (!log) throw new NotFoundException('Audit log not found');
    return log;
  }
}
