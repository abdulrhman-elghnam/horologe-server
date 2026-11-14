import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CompareItem } from '../model/saved-watch.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class CompareRepository extends DatabaseRepository<CompareItem> {
  constructor(@InjectRepository(CompareItem) repository: Repository<CompareItem>) {
    super(repository);
  }
}
