import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Watch } from './watch.model.js';

/** A watch a user saved to a personal list (wishlist or compare list). */
export abstract class SavedWatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'watch_id', type: 'uuid' })
  watchId: string;

  @ManyToOne(() => Watch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'watch_id' })
  watch?: Watch;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

@Entity({ name: 'wishlist_items' })
@Index(['userId', 'watchId'], { unique: true })
export class WishlistItem extends SavedWatch {}

@Entity({ name: 'compare_items' })
@Index(['userId', 'watchId'], { unique: true })
export class CompareItem extends SavedWatch {}
