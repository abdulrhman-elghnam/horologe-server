import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseModel } from './base.model.js';
import { Order } from './order.model.js';
import { ShippingMethod } from './shipping-method.model.js';
import { ShipmentStatusEnum } from '../../dependency/value/database.enum.js';

export interface ShipmentEvent {
  status: ShipmentStatusEnum;
  at: string;
  note?: string;
  location?: string;
}

@Entity({ name: 'shipments' })
export class Shipment extends BaseModel {
  @Index({ unique: true })
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order?: Order;

  @Column({ name: 'shipping_method_id', type: 'uuid' })
  shippingMethodId: string;

  @ManyToOne(() => ShippingMethod, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'shipping_method_id' })
  shippingMethod?: ShippingMethod;

  @Index({ unique: true })
  @Column({ name: 'tracking_number', type: 'varchar', length: 80 })
  trackingNumber: string;

  @Column({ type: 'varchar', length: 60 })
  carrier: string;

  @Index()
  @Column({ type: 'enum', enum: ShipmentStatusEnum, enumName: 'shipment_status', default: ShipmentStatusEnum.PENDING })
  status: ShipmentStatusEnum;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  events: ShipmentEvent[];

  @Column({ name: 'shipped_at', type: 'timestamptz', nullable: true })
  shippedAt: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;
}
