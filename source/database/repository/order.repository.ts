import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Order } from '../model/order.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class OrderRepository extends DatabaseRepository<Order> {
  constructor(@InjectRepository(Order) repository: Repository<Order>) {
    super(repository);
  }
}
