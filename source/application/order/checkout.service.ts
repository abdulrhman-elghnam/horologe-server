import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';

import { presentOrder } from './order.presenter.js';
import type { CheckoutDto } from './dto/order.dto.js';
import { CartService, type CartLine } from '../cart/cart.service.js';
import { CouponRejection } from '../coupon/coupon.rules.js';
import { CouponService, type AppliedCoupon } from '../coupon/coupon.service.js';
import { InventoryService, type StockChange } from '../inventory/inventory.service.js';
import { NotificationService } from '../notification/notification.service.js';
import { RealtimeEvent } from '../realtime/realtime.event.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { ShippingService } from '../shipping/shipping.service.js';
import { Address } from '../../database/model/address.model.js';
import { CartItem } from '../../database/model/cart.model.js';
import type { AddressSnapshot, Order } from '../../database/model/order.model.js';
import { AddressRepository } from '../../database/repository/address.repository.js';
import { CartRepository } from '../../database/repository/cart.repository.js';
import { OrderItemRepository } from '../../database/repository/order-item.repository.js';
import { OrderRepository } from '../../database/repository/order.repository.js';
import { UtilService, isUniqueViolation } from '../../dependency/service/util.service.js';
import { NotificationTypeEnum, OrderStatusEnum, PaymentStatusEnum } from '../../dependency/value/database.enum.js';
import { roundMoney, sumMoney } from '../../dependency/util/money.js';

/**
 * Checkout (spec §20, steps 1-8):
 *  1. load the cart with live prices/stock     5. reserve stock atomically
 *  2. revalidate items                         6. reserve coupon capacity
 *  3. validate address, shipping, coupon       7. create the PENDING order with snapshots
 *  4. open one transaction                     8. commit, then notify
 * Payment is started separately with POST /payments/initialize.
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly cart: CartService,
    private readonly carts: CartRepository,
    private readonly coupons: CouponService,
    private readonly inventory: InventoryService,
    private readonly shipping: ShippingService,
    private readonly addresses: AddressRepository,
    private readonly orders: OrderRepository,
    private readonly orderItems: OrderItemRepository,
    private readonly notifications: NotificationService,
    private readonly realtime: RealtimeService,
    private readonly util: UtilService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  /** With the same Idempotency-Key the same order comes back instead of a second one. */
  async checkout(userId: string, input: CheckoutDto, idempotencyKey?: string) {
    if (idempotencyKey) {
      const existing = await this.findByIdempotencyKey(userId, idempotencyKey);
      if (existing) return existing;
    }

    const address = await this.addresses.findOne({ where: { id: input.addressId, userId } });
    if (!address) throw new NotFoundException('Address not found');
    const lines = await this.cart.getCheckoutLines(userId);

    let result: { order: Order; stock: StockChange[] };
    try {
      result = await this.dataSource.transaction((manager) => this.placeOrder({ userId, input, idempotencyKey, address, lines, manager }));
    } catch (error) {
      if (error instanceof CouponRejection) throw new BadRequestException({ message: error.message, code: error.code });
      // Two requests with the same key raced: the other one won, return its order.
      if (idempotencyKey && isUniqueViolation(error)) {
        const existing = await this.findByIdempotencyKey(userId, idempotencyKey);
        if (existing) return existing;
      }
      throw error;
    }

    await this.afterCommit(result.order, result.stock);
    return this.load(result.order.id);
  }

  private async placeOrder({
    userId,
    input,
    idempotencyKey,
    address,
    lines,
    manager,
  }: {
    userId: string;
    input: CheckoutDto;
    idempotencyKey?: string;
    address: Address;
    lines: CartLine[];
    manager: EntityManager;
  }) {
    const subtotal = sumMoney(lines.map((line) => line.lineTotal));
    const method = await this.shipping.activeMethod(input.shippingMethodId, manager);
    const { cost: shippingCost } = this.shipping.quote(method, { country: address.country, subtotal });

    // Locks the coupon row until commit, so its limits can't be overrun by concurrent checkouts.
    const applied: AppliedCoupon | null = input.couponCode ? await this.coupons.apply({ code: input.couponCode, userId, lines, manager }) : null;
    const discount = applied?.discount ?? 0;

    const windowMinutes = this.config.get<number>('commerce.paymentWindowMinutes', 30);
    const order = await this.orders.create({
      data: {
        userId,
        orderNumber: this.orderNumber(),
        subtotal,
        discount,
        shippingCost,
        total: roundMoney(subtotal - discount + shippingCost),
        currency: this.config.get<string>('commerce.currency', 'USD'),
        status: OrderStatusEnum.PENDING,
        paymentStatus: PaymentStatusEnum.PENDING,
        couponId: applied?.coupon.id ?? null,
        couponCode: applied?.coupon.code ?? null,
        shippingMethodId: method.id,
        shippingMethodName: method.name,
        shippingAddress: snapshotOf(address),
        notes: input.notes ?? null,
        idempotencyKey: idempotencyKey ?? null,
        expiresAt: new Date(Date.now() + windowMinutes * 60_000),
        statusHistory: [{ status: OrderStatusEnum.PENDING, at: new Date().toISOString(), by: userId }],
      },
      manager,
    });

    await this.orderItems.createMany({
      data: lines.map((line) => ({
        orderId: order.id,
        watchId: line.watchId,
        variantId: line.variantId,
        watchName: line.watchName,
        sku: line.sku,
        color: line.color,
        imageId: line.imageId,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        totalPrice: line.lineTotal,
      })),
      manager,
    });

    const stock = await this.inventory.reserve(lines, order.id, manager);
    if (applied) await this.coupons.reserve({ coupon: applied.coupon, userId, orderId: order.id, discount, manager });

    // The cart is emptied only when the order really exists.
    const cart = await this.carts.findOne({ where: { userId }, manager });
    if (cart) await manager.delete(CartItem, { cartId: cart.id });

    return { order, stock };
  }

  private async afterCommit(order: Order, stock: StockChange[]) {
    await this.inventory.publish(stock);
    const payload = { orderId: order.id, orderNumber: order.orderNumber, total: order.total, currency: order.currency, expiresAt: order.expiresAt };

    this.realtime.emitToAdmins(RealtimeEvent.ADMIN_ORDER_NEW, { ...payload, userId: order.userId });
    await this.notifications.notify({
      userId: order.userId,
      type: NotificationTypeEnum.ORDER,
      title: 'Order placed',
      message: `Order ${order.orderNumber} was placed. Complete the payment to confirm it.`,
      referenceId: order.id,
      data: payload,
      event: RealtimeEvent.ORDER_CREATED,
      eventPayload: payload,
    });
  }

  private async findByIdempotencyKey(userId: string, idempotencyKey: string) {
    const order = await this.orders.findOne({ where: { userId, idempotencyKey }, options: { select: { id: true } } });
    return order ? this.load(order.id) : null;
  }

  private async load(orderId: string) {
    const order = await this.orders.findOne({ where: { id: orderId }, options: { relations: { items: true } } });
    return presentOrder(order!);
  }

  /** e.g. HRL-20261114-7KQ2M9XA */
  private orderNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return this.util.createReferenceCode(`HRL-${date}`, 8);
  }
}

const snapshotOf = (address: Address): AddressSnapshot => ({
  recipientName: address.recipientName,
  phone: address.phone,
  country: address.country,
  city: address.city,
  street: address.street,
  building: address.building,
  apartment: address.apartment,
  postalCode: address.postalCode,
});
