import { Coupon } from '../../database/model/coupon.model.js';
import { DiscountTypeEnum } from '../../dependency/value/database.enum.js';
import { roundMoney, sumMoney } from '../../dependency/util/money.js';

/** Pure coupon rules — no database access, easy to unit test. */

export type CouponErrorCode =
  | 'COUPON_NOT_FOUND'
  | 'COUPON_INACTIVE'
  | 'COUPON_NOT_STARTED'
  | 'COUPON_EXPIRED'
  | 'COUPON_USAGE_LIMIT_REACHED'
  | 'COUPON_USER_LIMIT_REACHED'
  | 'COUPON_MIN_ORDER_NOT_MET'
  | 'COUPON_NOT_APPLICABLE'
  | 'COUPON_FIRST_ORDER_ONLY';

/** Thrown when a coupon can't be applied. Checkout turns it into a 400; validation turns it into `isValid: false`. */
export class CouponRejection extends Error {
  constructor(
    readonly code: CouponErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface PricedLine {
  watchId: string;
  categoryIds: string[];
  lineTotal: number;
}

export interface CouponUsageFacts {
  /** Reserved + confirmed usages of this coupon by the user. */
  userUsages: number;
  /** Whether the user already has a non-cancelled order. */
  hasPreviousOrders: boolean;
}

/** Subtotal of the lines the coupon applies to (all lines when no product/category restriction is set). */
export const eligibleSubtotal = (coupon: Coupon, lines: PricedLine[]): number => {
  const restricted = coupon.eligibleWatchIds.length > 0 || coupon.eligibleCategoryIds.length > 0;
  if (!restricted) return sumMoney(lines.map((line) => line.lineTotal));

  const watches = new Set(coupon.eligibleWatchIds);
  const categories = new Set(coupon.eligibleCategoryIds);
  return sumMoney(lines.filter((line) => watches.has(line.watchId) || line.categoryIds.some((id) => categories.has(id))).map((line) => line.lineTotal));
};

/**
 * percentage   : min(eligible * rate, maxDiscount)
 * fixed_amount : min(discountValue, eligible)
 */
export const calculateDiscount = (coupon: Coupon, eligible: number): number => {
  if (eligible <= 0) return 0;
  if (coupon.discountType === DiscountTypeEnum.PERCENTAGE) {
    const raw = roundMoney((eligible * coupon.discountValue) / 100);
    return coupon.maxDiscount !== null ? Math.min(raw, coupon.maxDiscount) : raw;
  }
  return roundMoney(Math.min(coupon.discountValue, eligible));
};

/** Checks every rule and returns the discount, or throws CouponRejection. */
export const evaluateCoupon = (coupon: Coupon, lines: PricedLine[], facts: CouponUsageFacts, now = new Date()): number => {
  if (!coupon.isActive) throw new CouponRejection('COUPON_INACTIVE', 'This coupon is not active');
  if (coupon.startDate && coupon.startDate > now) throw new CouponRejection('COUPON_NOT_STARTED', 'This coupon is not valid yet');
  if (coupon.endDate && coupon.endDate < now) throw new CouponRejection('COUPON_EXPIRED', 'This coupon has expired');
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
    throw new CouponRejection('COUPON_USAGE_LIMIT_REACHED', 'This coupon has been fully used');
  if (coupon.perUserLimit !== null && facts.userUsages >= coupon.perUserLimit) {
    throw new CouponRejection('COUPON_USER_LIMIT_REACHED', 'You have already used this coupon');
  }
  if (coupon.firstOrderOnly && facts.hasPreviousOrders) throw new CouponRejection('COUPON_FIRST_ORDER_ONLY', 'This coupon is only valid on your first order');

  const subtotal = sumMoney(lines.map((line) => line.lineTotal));
  if (subtotal < coupon.minOrderAmount) {
    throw new CouponRejection('COUPON_MIN_ORDER_NOT_MET', `This coupon needs a minimum order of ${coupon.minOrderAmount.toFixed(2)}`);
  }

  const discount = calculateDiscount(coupon, eligibleSubtotal(coupon, lines));
  if (discount <= 0) throw new CouponRejection('COUPON_NOT_APPLICABLE', 'This coupon does not apply to the items in your cart');
  return discount;
};
