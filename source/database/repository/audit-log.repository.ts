import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuditLog } from '../model/audit-log.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class AuditLogRepository extends DatabaseRepository<AuditLog> {
  constructor(@InjectRepository(AuditLog) repository: Repository<AuditLog>) {
    super(repository);
  }
}
