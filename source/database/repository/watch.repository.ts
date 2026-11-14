import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Watch } from '../model/watch.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class WatchRepository extends DatabaseRepository<Watch> {
  constructor(@InjectRepository(Watch) repository: Repository<Watch>) {
    super(repository);
  }
}
