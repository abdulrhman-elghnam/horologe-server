import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { NotificationTypeEnum } from '../../dependency/value/database.enum.js';

@Entity({ name: 'notifications' })
@Index(['userId', 'createdAt'])
@Index('IDX_notifications_unread', ['userId'], { where: '"is_read" = false' })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'varchar', length: 1000 })
  message: string;

  @Column({ type: 'enum', enum: NotificationTypeEnum, enumName: 'notification_type' })
  type: NotificationTypeEnum;

  /** Id of the order/payment/watch… the notification is about. */
  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
