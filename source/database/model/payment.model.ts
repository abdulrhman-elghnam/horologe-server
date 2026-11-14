import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseModel, MoneyColumn } from './base.model.js';
import { Order } from './order.model.js';
import { PaymentStatusEnum } from '../../dependency/value/database.enum.js';

@Entity({ name: 'payments' })
@Index('UQ_payments_provider_transaction', ['provider', 'transactionId'], { unique: true, where: '"transaction_id" IS NOT NULL' })
export class Payment extends BaseModel {
  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order?: Order;

  @Column({ type: 'varchar', length: 40 })
  provider: string;

  @Column({ name: 'transaction_id', type: 'varchar', length: 200, nullable: true })
  transactionId: string | null;

  @MoneyColumn()
  amount: number;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'enum', enum: PaymentStatusEnum, enumName: 'payment_status', default: PaymentStatusEnum.PENDING })
  status: PaymentStatusEnum;

  /** Where the customer completes payment (hosted page), if the provider uses one. */
  @Column({ name: 'checkout_url', type: 'varchar', length: 1000, nullable: true })
  checkoutUrl: string | null;

  @Column({ name: 'failure_reason', type: 'varchar', length: 300, nullable: true })
  failureReason: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt: Date | null;
}
