import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Address } from '../model/address.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class AddressRepository extends DatabaseRepository<Address> {
  constructor(@InjectRepository(Address) repository: Repository<Address>) {
    super(repository);
  }
}
