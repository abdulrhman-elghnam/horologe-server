import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WishlistItem } from '../model/saved-watch.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class WishlistRepository extends DatabaseRepository<WishlistItem> {
  constructor(@InjectRepository(WishlistItem) repository: Repository<WishlistItem>) {
    super(repository);
  }
}
