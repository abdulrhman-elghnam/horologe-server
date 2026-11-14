import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';

import { AuthGuard } from '../guard/auth.guard.js';
import { RolesGuard } from '../guard/roles.guard.js';
import { BEARER } from '../swagger/swagger.setup.js';
import { SystemRoleEnum } from '../value/security.enum.js';
import { Role } from './role.decorator.js';

/** Swagger metadata for a route that needs an access token (also used by routes that apply AuthGuard directly). */
export const ApiAuth = (...roles: SystemRoleEnum[]) =>
  applyDecorators(
    ApiBearerAuth(BEARER.access),
    ApiUnauthorizedResponse({ description: 'Missing, invalid or revoked access token' }),
    ...(roles.length ? [ApiForbiddenResponse({ description: `Requires role: ${roles.join(' or ')}` })] : []),
  );

/**
 * Requires a valid access token and, when roles are given, one of those roles.
 * `@Auth()` = any signed-in user, `@Auth(SystemRoleEnum.ADMIN)` = admins (and super admins).
 */
export const Auth = (...roles: SystemRoleEnum[]) => applyDecorators(Role(roles), UseGuards(AuthGuard, RolesGuard), ApiAuth(...roles));

export const AdminOnly = () => Auth(SystemRoleEnum.ADMIN);
export const SuperAdminOnly = () => Auth(SystemRoleEnum.SUPER_ADMIN);
