import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WatchVariant } from '../model/watch-variant.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class WatchVariantRepository extends DatabaseRepository<WatchVariant> {
  constructor(@InjectRepository(WatchVariant) repository: Repository<WatchVariant>) {
    super(repository);
  }
}
