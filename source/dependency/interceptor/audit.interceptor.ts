import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';

import { auditMetadataName, type AuditOptions } from '../decorator/audit.decorator.js';
import type { IAuthReq } from '../interface/ctx.interface.js';
import { AuditLogRepository } from '../../database/repository/audit-log.repository.js';

/** Keys never copied from the request body into audit metadata. */
const SECRET_KEYS = /password|token|secret/i;

const redact = (body: unknown): Record<string, unknown> | null => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  return Object.fromEntries(Object.entries(body).filter(([key]) => !SECRET_KEYS.test(key)));
};

/** Writes an audit log row for every successful handler marked with `@Audit(...)`. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogs: AuditLogRepository,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<AuditOptions | undefined>(auditMetadataName, context.getHandler());
    if (!options || context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<IAuthReq>();

    return next.handle().pipe(
      tap((result) => {
        const adminId = request.credentials?.user?.id;
        if (!adminId) return;

        const fromParam = options.idParam ? request.params[options.idParam] : undefined;
        const fromResult = result && typeof result === 'object' && 'id' in result ? String((result as { id: unknown }).id) : undefined;

        this.auditLogs
          .create({
            data: {
              adminId,
              action: options.action,
              resource: options.resource,
              resourceId: (Array.isArray(fromParam) ? fromParam[0] : fromParam) ?? fromResult ?? null,
              description: `${request.method} ${request.originalUrl}`,
              ipAddress: request.ip ?? null,
              metadata: redact(request.body),
            },
          })
          .catch((error: Error) => this.logger.error(`Audit log failed for ${options.action}: ${error.message}`));
      }),
    );
  }
}
