import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { WebhookEvent } from '../model/webhook-event.model.js';
import { DatabaseRepository } from './base.repository.js';

@Injectable()
export class WebhookEventRepository extends DatabaseRepository<WebhookEvent> {
  constructor(@InjectRepository(WebhookEvent) repository: Repository<WebhookEvent>) {
    super(repository);
  }

  /** Records the event. Returns false when it was already processed (duplicate delivery). */
  async markProcessed({ source, eventId, type, manager }: { source: string; eventId: string; type: string; manager?: EntityManager }): Promise<boolean> {
    const result = await this.repo(manager).createQueryBuilder().insert().into(WebhookEvent).values({ source, eventId, type }).orIgnore().execute();
    // Postgres returns the inserted row; an ignored conflict returns none.
    return (result.raw as unknown[]).length > 0;
  }
}
