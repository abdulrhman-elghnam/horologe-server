import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, ILike, In, Not, type FindOptionsWhere } from 'typeorm';

import { CouponRejection, evaluateCoupon, type PricedLine } from './coupon.rules.js';
import type { CouponQueryDto, CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto.js';
import { CartService } from '../cart/cart.service.js';
import type { Coupon } from '../../database/model/coupon.model.js';
import { CouponUsageRepository } from '../../database/repository/coupon-usage.repository.js';
import { CouponRepository } from '../../database/repository/coupon.repository.js';
import { OrderRepository } from '../../database/repository/order.repository.js';
import { sortDirection } from '../../dependency/dto/pagination.dto.js';
import { escapeLike, isUniqueViolation } from '../../dependency/service/util.service.js';
import { CouponUsageStatusEnum, DiscountTypeEnum, OrderStatusEnum } from '../../dependency/value/database.enum.js';
import { roundMoney, sumMoney } from '../../dependency/util/money.js';

const ACTIVE_USAGE = In([CouponUsageStatusEnum.RESERVED, CouponUsageStatusEnum.CONFIRMED]);

export interface AppliedCoupon {
  coupon: Coupon;
  discount: number;
}

@Injectable()
export class CouponService {
  constructor(
    private readonly coupons: CouponRepository,
    private readonly usages: CouponUsageRepository,
    private readonly orders: OrderRepository,
    private readonly cart: CartService,
  ) {}

  // ── Customer ──

  /** Checks the code against the customer's current cart. The client never sends a discount amount. */
  async validateForCart(userId: string, code: string) {
    const lines = await this.cart.getCheckoutLines(userId);
    const subtotal = sumMoney(lines.map((line) => line.lineTotal));
    try {
      const { coupon, discount } = await this.apply({ code, userId, lines });
      return {
        isValid: true,
        code: coupon.code,
        discountType: coupon.discountType,
        discountAmount: discount,
        subtotal,
        finalTotal: roundMoney(subtotal - discount),
      };
    } catch (error) {
      if (!(error instanceof CouponRejection)) throw error;
      return { isValid: false, errorCode: error.code, message: error.message, discountAmount: 0, subtotal, finalTotal: subtotal };
    }
  }

  // ── Checkout (internal) ──

  /**
   * Evaluates the coupon for these lines. Pass a transaction `manager` to lock the coupon row,
   * which serialises concurrent checkouts using the same coupon.
   */
  async apply({ code, userId, lines, manager }: { code: string; userId: string; lines: PricedLine[]; manager?: EntityManager }): Promise<AppliedCoupon> {
    const coupon = await this.coupons.findByCode({ code, manager, lock: !!manager });
    if (!coupon) throw new CouponRejection('COUPON_NOT_FOUND', 'Invalid coupon code');

    const [userUsages, hasPreviousOrders] = await Promise.all([
      this.usages.count({ where: { couponId: coupon.id, userId, status: ACTIVE_USAGE }, manager }),
      coupon.firstOrderOnly ? this.orders.exists({ where: { userId, status: Not(OrderStatusEnum.CANCELLED) }, manager }) : Promise.resolve(false),
    ]);
    return { coupon, discount: evaluateCoupon(coupon, lines, { userUsages, hasPreviousOrders }) };
  }

  /** Takes one unit of capacity for a pending order. Call inside the checkout transaction after `apply`. */
  async reserve({ coupon, userId, orderId, discount, manager }: { coupon: Coupon; userId: string; orderId: string; discount: number; manager: EntityManager }) {
    if (!(await this.coupons.reserveUsage({ id: coupon.id, manager }))) {
      throw new CouponRejection('COUPON_USAGE_LIMIT_REACHED', 'This coupon has been fully used');
    }
    await this.usages.create({ data: { couponId: coupon.id, userId, orderId, discountAmount: discount, status: CouponUsageStatusEnum.RESERVED }, manager });
  }

  /** Payment succeeded: the reservation becomes a real usage. */
  async confirm(orderId: string, manager: EntityManager) {
    await this.usages.updateMany({
      where: { orderId, status: CouponUsageStatusEnum.RESERVED },
      data: { status: CouponUsageStatusEnum.CONFIRMED, usedAt: new Date() },
      manager,
    });
  }

  /** Order failed, expired or was cancelled: give the capacity back. */
  async release(orderId: string, manager: EntityManager) {
    const usage = await this.usages.findOne({ where: { orderId, status: ACTIVE_USAGE }, manager });
    if (!usage) return;
    await this.usages.updateMany({ where: { id: usage.id }, data: { status: CouponUsageStatusEnum.RELEASED }, manager });
    await this.coupons.releaseUsage({ id: usage.couponId, manager });
  }

  // ── Admin ──

  list({ page, limit, search, isActive, sortOrder }: CouponQueryDto) {
    const where: FindOptionsWhere<Coupon> = {};
    if (search) where.code = ILike(`%${escapeLike(search.toUpperCase())}%`);
    if (isActive !== undefined) where.isActive = isActive;
    return this.coupons.paginate({ where, page, size: limit, options: { order: { createdAt: sortDirection(sortOrder) } } });
  }

  async get(id: string) {
    const coupon = await this.coupons.findById({ id });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async create(input: CreateCouponDto) {
    this.assertRules(input);
    try {
      return await this.coupons.create({ data: input });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A coupon with this code already exists');
      throw error;
    }
  }

  async update(id: string, input: UpdateCouponDto) {
    const coupon = await this.get(id);
    this.assertRules({ ...coupon, ...input });
    if (input.usageLimit !== undefined && input.usageLimit < coupon.usedCount) {
      throw new BadRequestException(`usageLimit cannot be lower than the ${coupon.usedCount} uses so far`);
    }
    try {
      return await this.coupons.findByIdAndUpdate({ id, data: input });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A coupon with this code already exists');
      throw error;
    }
  }

  async setActive(id: string, isActive: boolean) {
    await this.get(id);
    return this.coupons.findByIdAndUpdate({ id, data: { isActive } });
  }

  async usagesOf(id: string, { page, limit, sortOrder }: CouponQueryDto) {
    await this.get(id);
    return this.usages.paginate({ where: { couponId: id }, page, size: limit, options: { order: { createdAt: sortDirection(sortOrder) } } });
  }

  /** Coupons that were used stay for order history; deactivate them instead. */
  async remove(id: string) {
    await this.get(id);
    if (await this.usages.exists({ where: { couponId: id } })) throw new ConflictException('This coupon has been used. Deactivate it instead');
    await this.coupons.deleteOne({ where: { id } });
    return { deleted: true };
  }

  private assertRules(input: Pick<Partial<Coupon>, 'discountType' | 'discountValue' | 'startDate' | 'endDate'>) {
    if (input.discountType === DiscountTypeEnum.PERCENTAGE && (input.discountValue ?? 0) > 100) {
      throw new BadRequestException('A percentage discount cannot exceed 100');
    }
    if ((input.discountValue ?? 1) <= 0) throw new BadRequestException('discountValue must be greater than 0');
    if (input.startDate && input.endDate && input.startDate > input.endDate) throw new BadRequestException('startDate must be before endDate');
  }
}
