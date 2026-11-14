import { ConflictException, NotFoundException } from '@nestjs/common';

import { presentWatch } from '../watch/watch.presenter.js';
import type { DeepPartial, FindOptionsWhere } from 'typeorm';

import type { SavedWatch } from '../../database/model/saved-watch.model.js';
import type { DatabaseRepository } from '../../database/repository/base.repository.js';
import type { WatchRepository } from '../../database/repository/watch.repository.js';
import { isUniqueViolation } from '../../dependency/service/util.service.js';
import { WatchStatusEnum } from '../../dependency/value/database.enum.js';

/**
 * Shared behaviour of the wishlist and the compare list: a per-user, size-limited list of published watches.
 * Subclasses only choose the repository and the limit.
 */
export abstract class SavedWatchListService<T extends SavedWatch> {
  protected abstract readonly maxItems: number;
  protected abstract readonly listName: string;

  protected constructor(
    protected readonly items: DatabaseRepository<T>,
    protected readonly watches: WatchRepository,
  ) {}

  async list(userId: string) {
    const items = await this.items
      .repo()
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.watch', 'watch')
      .leftJoinAndSelect('watch.brand', 'brand')
      .leftJoinAndSelect('watch.images', 'image')
      .leftJoinAndSelect('watch.variants', 'variant')
      .leftJoinAndSelect('variant.inventory', 'inventory')
      .where('item.userId = :userId', { userId })
      .orderBy('item.createdAt', 'DESC')
      .getMany();

    return items.map((item) => ({ id: item.id, addedAt: item.createdAt, watch: presentWatch(item.watch!) }));
  }

  async add(userId: string, watchId: string) {
    if (!(await this.watches.exists({ where: { id: watchId, status: WatchStatusEnum.PUBLISHED } }))) throw new NotFoundException('Watch not found');
    if ((await this.items.count({ where: { userId } as FindOptionsWhere<T> })) >= this.maxItems) {
      throw new ConflictException(`Your ${this.listName} can hold up to ${this.maxItems} watches`);
    }

    try {
      await this.items.create({ data: { userId, watchId } as DeepPartial<T> });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error; // already in the list: adding again is a no-op
    }
    return this.list(userId);
  }

  async remove(userId: string, watchId: string) {
    const result = await this.items.deleteMany({ where: { userId, watchId } as FindOptionsWhere<T> });
    if (!result.affected) throw new NotFoundException('Watch not found');
    return this.list(userId);
  }

  async clear(userId: string) {
    await this.items.deleteMany({ where: { userId } as FindOptionsWhere<T> });
    return { cleared: true };
  }
}
