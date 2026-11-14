import { SetMetadata } from '@nestjs/common';

export const auditMetadataName = 'AUDIT_OPTION';

export interface AuditOptions {
  /** What happened, e.g. `watch.create`. */
  action: string;
  /** Kind of resource, e.g. `watch`. */
  resource: string;
  /** Route param holding the resource id. Defaults to the `id` of the response. */
  idParam?: string;
}

/** Records the action in the audit log after the handler succeeds (see AuditInterceptor). */
export const Audit = (action: string, resource: string, idParam?: string) =>
  SetMetadata(auditMetadataName, { action, resource, idParam } satisfies AuditOptions);
