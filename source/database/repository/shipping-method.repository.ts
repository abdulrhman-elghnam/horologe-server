import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ShippingMethod } from '../model/shipping-method.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class ShippingMethodRepository extends DatabaseRepository<ShippingMethod> {
  constructor(@InjectRepository(ShippingMethod) repository: Repository<ShippingMethod>) {
    super(repository);
  }
}
