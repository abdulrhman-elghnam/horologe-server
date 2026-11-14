import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification } from '../model/notification.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class NotificationRepository extends DatabaseRepository<Notification> {
  constructor(@InjectRepository(Notification) repository: Repository<Notification>) {
    super(repository);
  }

  countUnread(userId: string): Promise<number> {
    return this.repository.count({ where: { userId, isRead: false } });
  }
}
