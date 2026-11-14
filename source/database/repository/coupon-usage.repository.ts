import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CouponUsage } from '../model/coupon.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class CouponUsageRepository extends DatabaseRepository<CouponUsage> {
  constructor(@InjectRepository(CouponUsage) repository: Repository<CouponUsage>) {
    super(repository);
  }
}
