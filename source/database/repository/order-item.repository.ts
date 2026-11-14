import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OrderItem } from '../model/order.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class OrderItemRepository extends DatabaseRepository<OrderItem> {
  constructor(@InjectRepository(OrderItem) repository: Repository<OrderItem>) {
    super(repository);
  }
}
