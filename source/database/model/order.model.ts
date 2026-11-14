import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { BaseModel, MoneyColumn } from './base.model.js';
import { User } from './user.model.js';
import { OrderStatusEnum, PaymentStatusEnum } from '../../dependency/value/database.enum.js';

/** Immutable copy of the delivery address taken at checkout. */
export interface AddressSnapshot {
  recipientName: string;
  phone: string;
  country: string;
  city: string;
  street: string;
  building: string | null;
  apartment: string | null;
  postalCode: string | null;
}

export interface OrderStatusChange {
  status: OrderStatusEnum;
  at: string;
  note?: string;
  by?: string;
}

@Entity({ name: 'orders' })
@Index(['userId', 'createdAt'])
@Index('UQ_orders_user_idempotency_key', ['userId', 'idempotencyKey'], { unique: true, where: '"idempotency_key" IS NOT NULL' })
export class Order extends BaseModel {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Index({ unique: true })
  @Column({ name: 'order_number', type: 'varchar', length: 32 })
  orderNumber: string;

  @MoneyColumn()
  subtotal: number;

  @MoneyColumn({ default: 0 })
  discount: number;

  @MoneyColumn({ name: 'shipping_cost', default: 0 })
  shippingCost: number;

  @MoneyColumn()
  total: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Index()
  @Column({ type: 'enum', enum: OrderStatusEnum, enumName: 'order_status', default: OrderStatusEnum.PENDING })
  status: OrderStatusEnum;

  @Index()
  @Column({ name: 'payment_status', type: 'enum', enum: PaymentStatusEnum, enumName: 'payment_status', default: PaymentStatusEnum.PENDING })
  paymentStatus: PaymentStatusEnum;

  @Column({ name: 'payment_method', type: 'varchar', length: 40, nullable: true })
  paymentMethod: string | null;

  @Column({ name: 'coupon_id', type: 'uuid', nullable: true })
  couponId: string | null;

  @Column({ name: 'coupon_code', type: 'varchar', length: 40, nullable: true })
  couponCode: string | null;

  @Column({ name: 'shipping_method_id', type: 'uuid' })
  shippingMethodId: string;

  @Column({ name: 'shipping_method_name', type: 'varchar', length: 120 })
  shippingMethodName: string;

  @Column({ name: 'shipping_address', type: 'jsonb' })
  shippingAddress: AddressSnapshot;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 100, nullable: true })
  idempotencyKey: string | null;

  /** Pending orders not paid by this time are cancelled and their stock released. */
  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'cancel_reason', type: 'varchar', length: 300, nullable: true })
  cancelReason: string | null;

  @Column({ name: 'return_reason', type: 'varchar', length: 500, nullable: true })
  returnReason: string | null;

  @Column({ name: 'status_history', type: 'jsonb', default: () => "'[]'" })
  statusHistory: OrderStatusChange[];

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @OneToMany(() => OrderItem, (item) => item.order)
  items?: OrderItem[];
}

/** A line of an order. Watch name, SKU, price etc. are snapshots and never change. */
@Entity({ name: 'order_items' })
export class OrderItem extends BaseModel {
  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order?: Order;

  @Index()
  @Column({ name: 'watch_id', type: 'uuid' })
  watchId: string;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  @Column({ name: 'watch_name', type: 'varchar', length: 200 })
  watchName: string;

  @Column({ type: 'varchar', length: 64 })
  sku: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  color: string | null;

  /** Image id at checkout time, if any. */
  @Column({ name: 'image_id', type: 'uuid', nullable: true })
  imageId: string | null;

  @MoneyColumn({ name: 'unit_price' })
  unitPrice: number;

  @Column({ type: 'int' })
  quantity: number;

  @MoneyColumn({ name: 'total_price' })
  totalPrice: number;
}
