import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Review } from '../model/review.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class ReviewRepository extends DatabaseRepository<Review> {
  constructor(@InjectRepository(Review) repository: Repository<Review>) {
    super(repository);
  }
}
