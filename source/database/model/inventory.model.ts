import { Check, Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';

import { BaseModel } from './base.model.js';
import type { WatchVariant } from './watch-variant.model.js';

/**
 * Stock for one variant.
 * - availableQuantity: units that can be bought now.
 * - reservedQuantity: units held by pending checkouts.
 * Both are changed only with conditional UPDATEs (see InventoryRepository) so stock can't go negative.
 */
@Entity({ name: 'inventories' })
@Check('CHK_inventory_available_non_negative', '"available_quantity" >= 0')
@Check('CHK_inventory_reserved_non_negative', '"reserved_quantity" >= 0')
export class Inventory extends BaseModel {
  @Index({ unique: true })
  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  @OneToOne('WatchVariant', 'inventory', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant?: WatchVariant;

  @Column({ name: 'available_quantity', type: 'int', default: 0 })
  availableQuantity: number;

  @Column({ name: 'reserved_quantity', type: 'int', default: 0 })
  reservedQuantity: number;

  @Column({ name: 'low_stock_threshold', type: 'int', default: 5 })
  lowStockThreshold: number;
}
