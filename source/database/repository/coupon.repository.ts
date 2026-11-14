import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { Coupon } from '../model/coupon.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class CouponRepository extends DatabaseRepository<Coupon> {
  constructor(@InjectRepository(Coupon) repository: Repository<Coupon>) {
    super(repository);
  }

  findByCode({ code, manager, lock = false }: { code: string; manager?: EntityManager; lock?: boolean }): Promise<Coupon | null> {
    return this.repo(manager).findOne({ where: { code: code.trim().toUpperCase() }, ...(lock ? { lock: { mode: 'pessimistic_write' } } : {}) });
  }

  /** Takes one unit of global capacity. False when the usage limit is reached. */
  async reserveUsage({ id, manager }: { id: string; manager?: EntityManager }): Promise<boolean> {
    const result = await this.repo(manager)
      .createQueryBuilder()
      .update(Coupon)
      .set({ usedCount: () => 'used_count + 1' })
      .where('id = :id', { id })
      .andWhere('(usage_limit IS NULL OR used_count < usage_limit)')
      .execute();
    return result.affected === 1;
  }

  async releaseUsage({ id, manager }: { id: string; manager?: EntityManager }): Promise<void> {
    await this.repo(manager)
      .createQueryBuilder()
      .update(Coupon)
      .set({ usedCount: () => 'used_count - 1' })
      .where('id = :id AND used_count > 0', { id })
      .execute();
  }
}
