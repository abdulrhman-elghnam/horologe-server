import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { InventoryMovement } from '../model/inventory-movement.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class InventoryMovementRepository extends DatabaseRepository<InventoryMovement> {
  constructor(@InjectRepository(InventoryMovement) repository: Repository<InventoryMovement>) {
    super(repository);
  }
}
