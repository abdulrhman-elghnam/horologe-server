import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { roleName } from '../decorator/role.decorator.js';
import { SystemRoleEnum } from '../value/security.enum.js';
import type { IAuthReq, IAuthSocket } from '../interface/ctx.interface.js';

/** SUPER_ADMIN can do everything ADMIN can, so [ADMIN] routes don't need to list both. */
const IMPLIED_ROLES: Partial<Record<SystemRoleEnum, SystemRoleEnum[]>> = {
  [SystemRoleEnum.SUPER_ADMIN]: [SystemRoleEnum.ADMIN],
};

export const matchRoles = (requiredRoles: SystemRoleEnum[], userRole: SystemRoleEnum | undefined): boolean => {
  if (!requiredRoles.length) return true;
  if (!userRole) return false;
  const held = [userRole, ...(IMPLIED_ROLES[userRole] ?? [])];
  return requiredRoles.some((role) => held.includes(role));
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<SystemRoleEnum[] | undefined>(roleName, [context.getHandler(), context.getClass()]) ?? [];

    if (!roles.length) {
      return true;
    }

    const holder = context.getType() === 'ws' ? context.switchToWs().getClient<IAuthSocket>() : context.switchToHttp().getRequest<IAuthReq>();

    const role = holder.credentials?.user?.role;
    if (!matchRoles(roles, role)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
    return true;
  }
}
