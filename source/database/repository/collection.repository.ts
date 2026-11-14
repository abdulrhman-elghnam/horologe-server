import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Collection } from '../model/collection.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class CollectionRepository extends DatabaseRepository<Collection> {
  constructor(@InjectRepository(Collection) repository: Repository<Collection>) {
    super(repository);
  }
}
