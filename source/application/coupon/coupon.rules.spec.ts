import type { Coupon } from '../../database/model/coupon.model.js';
import { DiscountTypeEnum } from '../../dependency/value/database.enum.js';
import { calculateDiscount, CouponRejection, eligibleSubtotal, evaluateCoupon, type PricedLine } from './coupon.rules.js';

const coupon = (overrides: Partial<Coupon> = {}): Coupon =>
  ({
    isActive: true,
    discountType: DiscountTypeEnum.PERCENTAGE,
    discountValue: 20,
    maxDiscount: null,
    minOrderAmount: 0,
    usageLimit: null,
    usedCount: 0,
    perUserLimit: null,
    firstOrderOnly: false,
    startDate: null,
    endDate: null,
    eligibleWatchIds: [],
    eligibleCategoryIds: [],
    ...overrides,
  }) as Coupon;

const lines: PricedLine[] = [
  { watchId: 'w1', categoryIds: ['divers'], lineTotal: 300 },
  { watchId: 'w2', categoryIds: ['dress'], lineTotal: 100.1 },
];
const facts = { userUsages: 0, hasPreviousOrders: false };

const rejectionCode = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error instanceof CouponRejection ? error.code : 'NOT_A_REJECTION';
  }
  return 'NO_ERROR';
};

describe('coupon rules', () => {
  it('applies a percentage to the whole cart, capped by maxDiscount', () => {
    expect(evaluateCoupon(coupon(), lines, facts)).toBe(80.02);
    expect(evaluateCoupon(coupon({ maxDiscount: 50 }), lines, facts)).toBe(50);
  });

  it('never discounts more than the eligible amount with a fixed coupon', () => {
    expect(calculateDiscount(coupon({ discountType: DiscountTypeEnum.FIXED_AMOUNT, discountValue: 1000 }), 400.1)).toBe(400.1);
    expect(calculateDiscount(coupon({ discountType: DiscountTypeEnum.FIXED_AMOUNT, discountValue: 25 }), 400.1)).toBe(25);
  });

  it('only counts lines matching the watch or category restriction', () => {
    expect(eligibleSubtotal(coupon({ eligibleCategoryIds: ['divers'] }), lines)).toBe(300);
    expect(eligibleSubtotal(coupon({ eligibleWatchIds: ['w2'] }), lines)).toBe(100.1);
    expect(rejectionCode(() => evaluateCoupon(coupon({ eligibleWatchIds: ['other'] }), lines, facts))).toBe('COUPON_NOT_APPLICABLE');
  });

  it.each([
    [{ isActive: false }, facts, 'COUPON_INACTIVE'],
    [{ startDate: new Date(Date.now() + 60_000) }, facts, 'COUPON_NOT_STARTED'],
    [{ endDate: new Date(Date.now() - 60_000) }, facts, 'COUPON_EXPIRED'],
    [{ usageLimit: 5, usedCount: 5 }, facts, 'COUPON_USAGE_LIMIT_REACHED'],
    [{ perUserLimit: 1 }, { userUsages: 1, hasPreviousOrders: true }, 'COUPON_USER_LIMIT_REACHED'],
    [{ firstOrderOnly: true }, { userUsages: 0, hasPreviousOrders: true }, 'COUPON_FIRST_ORDER_ONLY'],
    [{ minOrderAmount: 500 }, facts, 'COUPON_MIN_ORDER_NOT_MET'],
  ] as const)('rejects %o with %s', (overrides, usage, code) => {
    expect(rejectionCode(() => evaluateCoupon(coupon(overrides), lines, usage))).toBe(code);
  });
});
