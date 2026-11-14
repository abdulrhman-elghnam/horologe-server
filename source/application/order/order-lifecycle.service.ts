import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { canTransition, STATUS_EVENT, STATUS_MESSAGE } from './order.state.js';
import { CouponService } from '../coupon/coupon.service.js';
import { InventoryService, type StockChange } from '../inventory/inventory.service.js';
import { NotificationService } from '../notification/notification.service.js';
import { RealtimeEvent } from '../realtime/realtime.event.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { Order, OrderItem, type OrderStatusChange } from '../../database/model/order.model.js';
import { Payment } from '../../database/model/payment.model.js';
import { Watch } from '../../database/model/watch.model.js';
import { NotificationTypeEnum, OrderStatusEnum as S, PaymentStatusEnum } from '../../dependency/value/database.enum.js';

/** What changed inside a transaction; published with `publish()` once it has committed. */
export interface OrderEffects {
  order: Order;
  previousStatus: S;
  stock: StockChange[];
  /** The order was paid and is now cancelled/returned, so the money must go back. */
  refundRequired?: boolean;
}

interface TransitionOptions {
  /** Who made the change: a user id or `system`. */
  actor: string;
  note?: string;
  manager: EntityManager;
}

/**
 * Owns every order status change and its side effects (stock, coupon, timestamps, history).
 * Methods that take an EntityManager run inside the caller's transaction and return OrderEffects;
 * callers then `publish()` them after commit so nobody is notified about a rolled-back change.
 */
@Injectable()
export class OrderLifecycleService {
  constructor(
    private readonly inventory: InventoryService,
    private readonly coupons: CouponService,
    private readonly notifications: NotificationService,
    private readonly realtime: RealtimeService,
    private readonly dataSource: DataSource,
  ) {}

  /** Loads and row-locks an order for the rest of the transaction. */
  async lock(orderId: string, manager: EntityManager, { skipLocked = false } = {}): Promise<Order | null> {
    return manager.findOne(Order, {
      where: { id: orderId },
      lock: skipLocked ? { mode: 'pessimistic_write', onLocked: 'skip_locked' } : { mode: 'pessimistic_write' },
    });
  }

  // ── Payment-driven ──

  /** Payment succeeded: sell the reserved units, confirm the coupon, mark the order paid. */
  async confirmPayment(order: Order, paymentMethod: string, manager: EntityManager): Promise<OrderEffects> {
    this.assertTransition(order, S.CONFIRMED);
    const items = await this.itemsOf(order.id, manager);

    const stock = await this.inventory.confirm(items, order.id, manager);
    await this.coupons.confirm(order.id, manager);
    for (const item of items) {
      await manager.increment(Watch, { id: item.watchId }, 'soldCount', item.quantity);
    }

    return this.apply(order, S.CONFIRMED, { actor: 'system', note: 'Payment received', manager }, stock, {
      paymentStatus: PaymentStatusEnum.SUCCEEDED,
      paymentMethod,
      paidAt: new Date(),
      expiresAt: null,
    });
  }

  /** Payment failed or the payment window expired: cancel and give the stock and coupon back. */
  async failPayment(order: Order, reason: string, manager: EntityManager): Promise<OrderEffects> {
    const effects = await this.cancel(order, { actor: 'system', note: reason, manager });
    await manager.update(Payment, { orderId: order.id, status: PaymentStatusEnum.PENDING }, { status: PaymentStatusEnum.FAILED, failureReason: reason });
    return effects;
  }

  // ── Customer / admin driven ──

  /**
   * Unpaid order: release the reservation. Paid order: put the sold units back on the shelf
   * and flag that a refund is needed (done through POST /admin/payments/:id/refund).
   */
  async cancel(order: Order, options: TransitionOptions): Promise<OrderEffects> {
    this.assertTransition(order, S.CANCELLED);
    const items = await this.itemsOf(order.id, options.manager);
    const paid = order.paymentStatus === PaymentStatusEnum.SUCCEEDED;

    const stock = paid ? await this.inventory.restock(items, order.id, options.manager) : await this.inventory.release(items, order.id, options.manager);
    await this.coupons.release(order.id, options.manager);

    const effects = await this.apply(order, S.CANCELLED, options, stock, {
      cancelReason: options.note ?? null,
      expiresAt: null,
      ...(paid ? {} : { paymentStatus: PaymentStatusEnum.FAILED }),
    });
    return { ...effects, refundRequired: paid };
  }

  async requestReturn(order: Order, reason: string, returnWindowDays: number, manager: EntityManager): Promise<OrderEffects> {
    this.assertTransition(order, S.RETURN_REQUESTED);
    const deadline = new Date((order.deliveredAt ?? order.updatedAt).getTime() + returnWindowDays * 24 * 60 * 60 * 1000);
    if (deadline < new Date()) throw new BadRequestException(`Returns are accepted within ${returnWindowDays} days of delivery`);

    return this.apply(order, S.RETURN_REQUESTED, { actor: order.userId, note: reason, manager }, [], { returnReason: reason });
  }

  /** Admin status change (PROCESSING, SHIPPED, DELIVERED, RETURNED). */
  async adminTransition(order: Order, to: S, options: TransitionOptions): Promise<OrderEffects> {
    this.assertTransition(order, to);

    if (to === S.RETURNED) {
      const stock = await this.inventory.restock(await this.itemsOf(order.id, options.manager), order.id, options.manager);
      const effects = await this.apply(order, to, options, stock, {});
      return { ...effects, refundRequired: order.paymentStatus === PaymentStatusEnum.SUCCEEDED };
    }
    return this.apply(order, to, options, [], to === S.DELIVERED ? { deliveredAt: new Date() } : {});
  }

  /**
   * Moves the order forward because its shipment moved (`to` is SHIPPED or DELIVERED).
   * Silently skips statuses the order already passed, so carrier webhooks can arrive in any order.
   */
  async followShipment(orderId: string, to: S, manager: EntityManager): Promise<OrderEffects | null> {
    const order = await this.lock(orderId, manager);
    // Only orders still in fulfilment follow the parcel (a late webhook must not undo a return request).
    if (!order || ![S.CONFIRMED, S.PROCESSING, S.SHIPPED].includes(order.status)) return null;

    // A parcel can be delivered before anyone marked the order as shipped, so walk every step in between.
    const previousStatus = order.status;
    const path = to === S.DELIVERED ? [S.PROCESSING, S.SHIPPED, S.DELIVERED] : [S.PROCESSING, S.SHIPPED];
    for (const step of path) {
      if (!canTransition(order.status, step)) continue;
      await this.apply(order, step, { actor: 'system', note: 'Shipment update', manager }, [], step === S.DELIVERED ? { deliveredAt: new Date() } : {});
    }
    return order.status === previousStatus ? null : { order, previousStatus, stock: [] };
  }

  /** Convenience: run `work` in a transaction on a locked order and publish afterwards. */
  async run(orderId: string, work: (order: Order, manager: EntityManager) => Promise<OrderEffects>) {
    const effects = await this.dataSource.transaction(async (manager) => {
      const order = await this.lock(orderId, manager);
      if (!order) throw new NotFoundException('Order not found');
      return work(order, manager);
    });
    await this.publish(effects);
    return effects;
  }

  // ── After commit ──

  /** Stock events, socket events and the persisted customer notification. */
  async publish({ order, previousStatus, stock, refundRequired }: OrderEffects): Promise<void> {
    await this.inventory.publish(stock);
    if (order.status === previousStatus) return;

    const payload = { orderId: order.id, orderNumber: order.orderNumber, status: order.status, previousStatus, paymentStatus: order.paymentStatus };
    const specific = STATUS_EVENT[order.status];

    this.realtime.emitToOrder(order.id, RealtimeEvent.ORDER_STATUS_UPDATED, payload);
    if (specific) this.realtime.emitToOrder(order.id, specific, payload);
    this.realtime.emitToAdmins(RealtimeEvent.ADMIN_ORDER_UPDATED, { ...payload, userId: order.userId, total: order.total, refundRequired: !!refundRequired });

    const { title, message } = STATUS_MESSAGE[order.status](order.orderNumber);
    await this.notifications.notify({
      userId: order.userId,
      type: NotificationTypeEnum.ORDER,
      title,
      message,
      referenceId: order.id,
      data: payload,
      event: specific ?? RealtimeEvent.ORDER_STATUS_UPDATED,
      eventPayload: payload,
    });
  }

  // ── Helpers ──

  private assertTransition(order: Order, to: S) {
    if (!canTransition(order.status, to)) {
      throw new ConflictException({ message: `Order cannot move from ${order.status} to ${to}`, code: 'INVALID_ORDER_TRANSITION' });
    }
  }

  private itemsOf(orderId: string, manager: EntityManager): Promise<OrderItem[]> {
    return manager.find(OrderItem, { where: { orderId } });
  }

  private async apply(order: Order, to: S, { actor, note, manager }: TransitionOptions, stock: StockChange[], extra: Partial<Order>): Promise<OrderEffects> {
    const previousStatus = order.status;
    const change: OrderStatusChange = { status: to, at: new Date().toISOString(), by: actor, ...(note ? { note } : {}) };

    Object.assign(order, extra, { status: to, statusHistory: [...(order.statusHistory ?? []), change] });
    await manager.save(Order, order);
    return { order, previousStatus, stock };
  }
}
