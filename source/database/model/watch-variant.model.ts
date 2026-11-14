import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne } from 'typeorm';

import { BaseModel, MoneyColumn } from './base.model.js';
import type { Watch } from './watch.model.js';
import type { Inventory } from './inventory.model.js';

@Entity({ name: 'watch_variants' })
export class WatchVariant extends BaseModel {
  @Index()
  @Column({ name: 'watch_id', type: 'uuid' })
  watchId: string;

  @ManyToOne('Watch', 'variants', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'watch_id' })
  watch?: Watch;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  sku: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  color: string | null;

  @MoneyColumn()
  price: number;

  @MoneyColumn({ name: 'compare_at_price', nullable: true })
  compareAtPrice: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToOne('Inventory', 'variant')
  inventory?: Inventory;
}
