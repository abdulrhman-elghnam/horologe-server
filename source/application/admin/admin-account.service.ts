import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ILike, In, type FindOptionsWhere } from 'typeorm';

import type { AdminListQueryDto, CreateAdminDto, UpdateAdminDto } from './dto/admin.dto.js';
import { presentUser } from '../user/user.presenter.js';
import { UserService } from '../user/user.service.js';
import type { User } from '../../database/model/user.model.js';
import { UserRepository } from '../../database/repository/user.repository.js';
import { sortDirection } from '../../dependency/dto/pagination.dto.js';
import { SecurityService } from '../../dependency/service/security.service.js';
import { escapeLike, isUniqueViolation } from '../../dependency/service/util.service.js';
import { AuthProviderEnum, SystemRoleEnum } from '../../dependency/value/security.enum.js';

const ADMIN_ROLES = In([SystemRoleEnum.ADMIN, SystemRoleEnum.SUPER_ADMIN]);

/** Super-admin management of admin accounts. */
@Injectable()
export class AdminAccountService {
  constructor(
    private readonly users: UserRepository,
    private readonly userService: UserService,
    private readonly security: SecurityService,
  ) {}

  async list({ page, limit, search, isActive, sortOrder }: AdminListQueryDto) {
    const base: FindOptionsWhere<User> = { role: ADMIN_ROLES };
    if (isActive !== undefined) base.isActive = isActive;
    const where = search
      ? [
          { ...base, name: ILike(`%${escapeLike(search)}%`) },
          { ...base, email: ILike(`%${escapeLike(search)}%`) },
        ]
      : base;

    const result = await this.users.paginate({ where, page, size: limit, options: { order: { createdAt: sortDirection(sortOrder) } } });
    return { ...result, docs: result.docs.map(presentUser) };
  }

  async get(adminId: string) {
    return presentUser(await this.findAdmin(adminId));
  }

  /** New admins can sign in right away (email counts as verified because a super admin created it). */
  async create({ password, ...input }: CreateAdminDto) {
    if (await this.users.emailExists(input.email)) throw new ConflictException('An account with this email already exists');
    try {
      const admin = await this.users.createAuthUser({
        ...input,
        phone: input.phone ?? null,
        passwordHash: await this.security.hash(password),
        role: SystemRoleEnum.ADMIN,
        provider: AuthProviderEnum.SYSTEM,
        emailVerifiedAt: new Date(),
      });
      return presentUser(admin);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('An account with this email already exists');
      throw error;
    }
  }

  async update(adminId: string, input: UpdateAdminDto) {
    await this.findAdmin(adminId);
    const admin = await this.users.findByIdAndUpdate({ id: adminId, data: input });
    return presentUser(admin!);
  }

  /** Disabling an admin ends all their sessions immediately. Super admins can't be disabled here. */
  async setStatus(actorId: string, adminId: string, isActive: boolean) {
    const admin = await this.findAdmin(adminId);
    if (admin.id === actorId) throw new BadRequestException('You cannot change the status of your own account');
    if (admin.role === SystemRoleEnum.SUPER_ADMIN) throw new BadRequestException('Super admin accounts cannot be disabled');

    await this.users.updateMany({ where: { id: admin.id }, data: { isActive } });
    if (!isActive) await this.userService.signOutEverywhere(admin.id);
    return presentUser({ ...admin, isActive });
  }

  private async findAdmin(adminId: string): Promise<User> {
    const admin = await this.users.findOne({ where: { id: adminId, role: ADMIN_ROLES } });
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }
}
