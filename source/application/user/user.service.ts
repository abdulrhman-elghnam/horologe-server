import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, ILike, type FindOptionsWhere } from 'typeorm';

import type { AdminUserQueryDto, CreateAddressDto, UpdateAddressDto, UpdateProfileDto } from './dto/user.dto.js';
import { presentUser } from './user.presenter.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { Address } from '../../database/model/address.model.js';
import type { User } from '../../database/model/user.model.js';
import { AddressRepository } from '../../database/repository/address.repository.js';
import { UserRepository } from '../../database/repository/user.repository.js';
import { sortColumn, sortDirection } from '../../dependency/dto/pagination.dto.js';
import { StorageService, extensionForMime } from '../../dependency/service/storage.service.js';
import { TokenService } from '../../dependency/service/token.service.js';
import { escapeLike } from '../../dependency/service/util.service.js';
import { SystemRoleEnum } from '../../dependency/value/security.enum.js';

const MAX_ADDRESSES = 10;

@Injectable()
export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly addresses: AddressRepository,
    private readonly storage: StorageService,
    private readonly tokens: TokenService,
    private readonly realtime: RealtimeService,
    private readonly dataSource: DataSource,
  ) {}

  // ── Profile ──

  getProfile(user: User) {
    return presentUser(user);
  }

  async updateProfile(userId: string, input: UpdateProfileDto) {
    const user = await this.users.findByIdAndUpdate({ id: userId, data: input });
    if (!user) throw new NotFoundException('User not found');
    return presentUser(user);
  }

  async updateAvatar(user: User, file: Express.Multer.File) {
    const key = await this.storage.save('avatars', file.buffer, extensionForMime(file.mimetype));
    const previousKey = user.avatarKey;
    const updated = await this.users.findByIdAndUpdate({ id: user.id, data: { avatarKey: key, avatarUrl: null } });
    await this.storage.remove(previousKey).catch(() => undefined);
    return presentUser(updated!);
  }

  // ── Addresses ──

  listAddresses(userId: string) {
    return this.addresses.find({ where: { userId }, options: { order: { isDefault: 'DESC', createdAt: 'DESC' } } });
  }

  async getAddress(userId: string, addressId: string): Promise<Address> {
    const address = await this.addresses.findOne({ where: { id: addressId, userId } });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async createAddress(userId: string, input: CreateAddressDto) {
    const count = await this.addresses.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) throw new ConflictException(`You can save up to ${MAX_ADDRESSES} addresses`);

    // The first address is always the default.
    const isDefault = count === 0 || !!input.isDefault;
    return this.dataSource.transaction(async (manager) => {
      if (isDefault) await this.addresses.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false }, manager });
      return this.addresses.create({ data: { ...input, userId, isDefault }, manager });
    });
  }

  async updateAddress(userId: string, addressId: string, input: UpdateAddressDto) {
    const address = await this.getAddress(userId, addressId);
    const { isDefault, ...fields } = input;
    return this.dataSource.transaction(async (manager) => {
      if (isDefault && !address.isDefault) await this.addresses.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false }, manager });
      // Unsetting the default is done by choosing another address as default.
      return this.addresses.findByIdAndUpdate({ id: address.id, data: { ...fields, ...(isDefault ? { isDefault: true } : {}) }, manager });
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await this.getAddress(userId, addressId);
    await this.dataSource.transaction(async (manager) => {
      await this.addresses.deleteOne({ where: { id: address.id }, manager });
      if (address.isDefault) {
        // Promote the newest remaining address so the user keeps a default.
        const next = await this.addresses.findOne({ where: { userId }, options: { order: { createdAt: 'DESC' } }, manager });
        if (next) await this.addresses.updateMany({ where: { id: next.id }, data: { isDefault: true }, manager });
      }
    });
    return { deleted: true };
  }

  setDefaultAddress(userId: string, addressId: string) {
    return this.updateAddress(userId, addressId, { isDefault: true });
  }

  // ── Admin: customer accounts ──

  async listUsers({ page, limit, search, role, isActive, sortBy, sortOrder }: AdminUserQueryDto) {
    const base: FindOptionsWhere<User> = {};
    if (role) base.role = role;
    if (isActive !== undefined) base.isActive = isActive;
    const where = search
      ? [
          { ...base, name: ILike(`%${escapeLike(search)}%`) },
          { ...base, email: ILike(`%${escapeLike(search)}%`) },
        ]
      : base;

    const column = sortColumn(sortBy, { createdAt: 'createdAt', name: 'name', email: 'email' }, 'createdAt');
    const result = await this.users.paginate({ where, page, size: limit, options: { order: { [column]: sortDirection(sortOrder) } } });
    return { ...result, docs: result.docs.map(presentUser) };
  }

  async getUser(userId: string) {
    const user = await this.users.findById({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    return presentUser(user);
  }

  /** Admins manage customer accounts only; admin accounts are managed by super admins. */
  async setCustomerStatus(userId: string, isActive: boolean) {
    const user = await this.users.findById({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== SystemRoleEnum.CUSTOMER) throw new ForbiddenException('Only customer accounts can be managed here');

    await this.users.updateMany({ where: { id: user.id }, data: { isActive } });
    if (!isActive) await this.signOutEverywhere(user.id);
    return presentUser({ ...user, isActive });
  }

  /** Ends every session of the user and closes their sockets. */
  async signOutEverywhere(userId: string) {
    await this.tokens.revokeAllSessions({ userId });
    this.realtime.disconnectUser(userId);
  }
}
