import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Brand } from '../model/brand.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class BrandRepository extends DatabaseRepository<Brand> {
  constructor(@InjectRepository(Brand) repository: Repository<Brand>) {
    super(repository);
  }
}
