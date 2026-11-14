import { Check, Column, Entity, Index } from 'typeorm';

import { BaseModel, MoneyColumn } from './base.model.js';
import { CouponUsageStatusEnum, DiscountTypeEnum } from '../../dependency/value/database.enum.js';

@Entity({ name: 'coupons' })
@Check('CHK_coupon_used_count_non_negative', '"used_count" >= 0')
export class Coupon extends BaseModel {
  /** Stored upper-case. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description: string | null;

  @Column({ name: 'discount_type', type: 'enum', enum: DiscountTypeEnum, enumName: 'discount_type' })
  discountType: DiscountTypeEnum;

  /** Percent (0-100) or fixed amount, depending on discountType. */
  @MoneyColumn({ name: 'discount_value' })
  discountValue: number;

  @MoneyColumn({ name: 'min_order_amount', default: 0 })
  minOrderAmount: number;

  /** Cap for percentage discounts. */
  @MoneyColumn({ name: 'max_discount', nullable: true })
  maxDiscount: number | null;

  /** Global usage cap; null = unlimited. */
  @Column({ name: 'usage_limit', type: 'int', nullable: true })
  usageLimit: number | null;

  /** Reserved + confirmed usages. Changed only with conditional UPDATEs. */
  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount: number;

  @Column({ name: 'per_user_limit', type: 'int', nullable: true })
  perUserLimit: number | null;

  @Column({ name: 'start_date', type: 'timestamptz', nullable: true })
  startDate: Date | null;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate: Date | null;

  @Column({ name: 'first_order_only', type: 'boolean', default: false })
  firstOrderOnly: boolean;

  /** Empty = every product is eligible. */
  @Column({ name: 'eligible_watch_ids', type: 'uuid', array: true, default: () => "'{}'" })
  eligibleWatchIds: string[];

  @Column({ name: 'eligible_category_ids', type: 'uuid', array: true, default: () => "'{}'" })
  eligibleCategoryIds: string[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}

@Entity({ name: 'coupon_usages' })
@Index(['couponId', 'userId'])
export class CouponUsage extends BaseModel {
  @Column({ name: 'coupon_id', type: 'uuid' })
  couponId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index({ unique: true })
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @MoneyColumn({ name: 'discount_amount' })
  discountAmount: number;

  @Column({ type: 'enum', enum: CouponUsageStatusEnum, enumName: 'coupon_usage_status', default: CouponUsageStatusEnum.RESERVED })
  status: CouponUsageStatusEnum;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;
}
