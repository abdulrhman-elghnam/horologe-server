import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseModel } from './base.model.js';
import { User } from './user.model.js';
import { Watch } from './watch.model.js';
import { ReviewStatusEnum } from '../../dependency/value/database.enum.js';

@Entity({ name: 'reviews' })
@Index(['userId', 'watchId'], { unique: true })
@Index(['watchId', 'status', 'createdAt'])
@Check('CHK_review_rating_range', '"rating" BETWEEN 1 AND 5')
export class Review extends BaseModel {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'watch_id', type: 'uuid' })
  watchId: string;

  @ManyToOne(() => Watch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'watch_id' })
  watch?: Watch;

  /** Delivered order that proves the purchase, if any. */
  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ name: 'is_verified_purchase', type: 'boolean', default: false })
  isVerifiedPurchase: boolean;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'enum', enum: ReviewStatusEnum, enumName: 'review_status', default: ReviewStatusEnum.PENDING })
  status: ReviewStatusEnum;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 300, nullable: true })
  rejectionReason: string | null;
}
