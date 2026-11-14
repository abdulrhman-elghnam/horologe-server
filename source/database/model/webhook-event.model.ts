import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Every processed provider callback; the unique (source, eventId) makes webhook handling idempotent. */
@Entity({ name: 'webhook_events' })
@Index(['source', 'eventId'], { unique: true })
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** e.g. `payment:mock`, `shipping:mock`. */
  @Column({ type: 'varchar', length: 60 })
  source: string;

  @Column({ name: 'event_id', type: 'varchar', length: 200 })
  eventId: string;

  @Column({ type: 'varchar', length: 60 })
  type: string;

  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt: Date;
}
