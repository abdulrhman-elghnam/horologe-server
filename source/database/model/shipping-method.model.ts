import { Column, Entity, Index } from 'typeorm';

import { BaseModel, MoneyColumn } from './base.model.js';

@Entity({ name: 'shipping_methods' })
export class ShippingMethod extends BaseModel {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @MoneyColumn({ name: 'base_price' })
  basePrice: number;

  /** Orders at or above this subtotal ship free; null = never free. */
  @MoneyColumn({ name: 'free_shipping_threshold', nullable: true })
  freeShippingThreshold: number | null;

  /** Extra cost when shipping outside the store's home country. */
  @MoneyColumn({ name: 'international_surcharge', default: 0 })
  internationalSurcharge: number;

  @Column({ name: 'estimated_days', type: 'int' })
  estimatedDays: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
