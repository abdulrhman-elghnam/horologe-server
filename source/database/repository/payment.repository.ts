import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Payment } from '../model/payment.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class PaymentRepository extends DatabaseRepository<Payment> {
  constructor(@InjectRepository(Payment) repository: Repository<Payment>) {
    super(repository);
  }
}
