import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Category } from '../model/category.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class CategoryRepository extends DatabaseRepository<Category> {
  constructor(@InjectRepository(Category) repository: Repository<Category>) {
    super(repository);
  }
}
