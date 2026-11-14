import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WatchImage } from '../model/watch-image.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class WatchImageRepository extends DatabaseRepository<WatchImage> {
  constructor(@InjectRepository(WatchImage) repository: Repository<WatchImage>) {
    super(repository);
  }
}
