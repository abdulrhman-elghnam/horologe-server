import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Cart } from '../model/cart.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class CartRepository extends DatabaseRepository<Cart> {
  constructor(@InjectRepository(Cart) repository: Repository<Cart>) {
    super(repository);
  }
}
