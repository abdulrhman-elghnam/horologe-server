import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CartItem } from '../model/cart.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class CartItemRepository extends DatabaseRepository<CartItem> {
  constructor(@InjectRepository(CartItem) repository: Repository<CartItem>) {
    super(repository);
  }
}
