import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Shipment } from '../model/shipment.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class ShipmentRepository extends DatabaseRepository<Shipment> {
  constructor(@InjectRepository(Shipment) repository: Repository<Shipment>) {
    super(repository);
  }
}
