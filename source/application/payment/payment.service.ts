import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import { DataSource, EntityManager, IsNull } from 'typeorm';

import { NotificationService } from '../notification/notification.service.js';
import { OrderLifecycleService, type OrderEffects } from '../order/order-lifecycle.service.js';
import { RealtimeEvent, type RealtimeEventName } from '../realtime/realtime.event.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { ShipmentService } from '../shipment/shipment.service.js';
import { Order } from '../../database/model/order.model.js';
import { Payment } from '../../database/model/payment.model.js';
import { OrderRepository } from '../../database/repository/order.repository.js';
import { PaymentRepository } from '../../database/repository/payment.repository.js';
import { UserRepository } from '../../database/repository/user.repository.js';
import { WebhookEventRepository } from '../../database/repository/webhook-event.repository.js';
import type { PaymentWebhookEvent } from '../../dependency/provider/payment-provider.interface.js';
import { ProviderRegistry } from '../../dependency/provider/provider.registry.js';
import { NotificationTypeEnum, OrderStatusEnum, PaymentStatusEnum } from '../../dependency/value/database.enum.js';

/** What a webhook changed; acted on after the transaction commits. */
interface WebhookOutcome {
  payment: Payment;
  order: Order | null;
  effects: OrderEffects | null;
  /** Money arrived for an order that was already cancelled (e.g. expired): refund it automatically. */
  lateRefund: boolean;
  mismatch: boolean;
}

/**
 * Payment flow (spec §13, §20 steps 9-12):
 * - initialize: create a PENDING payment, then ask the provider (outside any DB transaction).
 * - webhook: the only thing that can mark a payment succeeded. Signature, amount, currency and order
 *   reference are checked; duplicate deliveries are ignored via webhook_events.
 * - refund: admin only, for cancelled/returned orders.
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly payments: PaymentRepository,
    private readonly orders: OrderRepository,
    private readonly users: UserRepository,
    private readonly webhookEvents: WebhookEventRepository,
    private readonly lifecycle: OrderLifecycleService,
    private readonly shipments: ShipmentService,
    private readonly notifications: NotificationService,
    private readonly realtime: RealtimeService,
    private readonly providers: ProviderRegistry,
    private readonly dataSource: DataSource,
  ) {}

  // ── Customer ──

  async initialize(userId: string, orderId: string, providerName?: string) {
    const provider = this.providers.paymentProvider(providerName);
    const order = await this.orders.findOne({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatusEnum.PENDING || order.paymentStatus !== PaymentStatusEnum.PENDING) {
      throw new ConflictException('This order is not awaiting payment');
    }
    if (order.expiresAt && order.expiresAt < new Date()) throw new ConflictException('The payment window for this order has expired');

    // Re-use a started payment so double clicks don't open two sessions at the provider.
    const started = await this.payments.findOne({
      where: { orderId, provider: provider.name, status: PaymentStatusEnum.PENDING },
      options: { order: { createdAt: 'DESC' } },
    });
    if (started?.transactionId) return this.present(started, order);

    const payment =
      started ??
      (await this.payments.create({
        data: { orderId, provider: provider.name, amount: order.total, currency: order.currency, status: PaymentStatusEnum.PENDING },
      }));
    const customer = await this.users.findById({ id: userId, options: { select: { id: true, email: true } } });

    const { transactionId, checkoutUrl } = await provider.createPayment({
      paymentId: payment.id,
      orderId,
      orderNumber: order.orderNumber,
      amount: payment.amount,
      currency: payment.currency,
      customerEmail: customer!.email,
    });
    await this.payments.updateMany({ where: { id: payment.id }, data: { transactionId, checkoutUrl } });

    const view = this.present({ ...payment, transactionId, checkoutUrl }, order);
    this.emit(order, RealtimeEvent.PAYMENT_PENDING, view);
    return view;
  }

  /** The customer can only read payments of their own orders. */
  async getMine(userId: string, paymentId: string) {
    const payment = await this.payments
      .repo()
      .createQueryBuilder('payment')
      .innerJoinAndSelect('payment.order', 'order', 'order.userId = :userId', { userId })
      .where('payment.id = :paymentId', { paymentId })
      .getOne();
    if (!payment) throw new NotFoundException('Payment not found');
    return this.present(payment, payment.order!);
  }

  // ── Provider callback ──

  async handleWebhook(providerName: string, rawBody: Buffer, headers: IncomingHttpHeaders) {
    const provider = this.providers.paymentProvider(providerName);
    const event = provider.parseWebhook(rawBody, headers);

    const outcome = await this.dataSource.transaction(async (manager) => {
      if (!(await this.webhookEvents.markProcessed({ source: `payment:${provider.name}`, eventId: event.eventId, type: event.type, manager }))) {
        return 'duplicate' as const;
      }
      const payment = await manager.findOne(Payment, {
        where: { provider: provider.name, transactionId: event.transactionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) return null;
      return this.applyEvent(payment, event, provider.name, manager);
    });

    if (outcome === 'duplicate') return { received: true, duplicate: true };
    if (!outcome) {
      this.logger.warn(`Webhook ${event.eventId} for unknown transaction ${event.transactionId}`);
      return { received: true, applied: false };
    }

    await this.afterWebhook(outcome, event);
    return { received: true, applied: !outcome.mismatch };
  }

  private async applyEvent(payment: Payment, event: PaymentWebhookEvent, providerName: string, manager: EntityManager): Promise<WebhookOutcome> {
    const outcome: WebhookOutcome = { payment, order: null, effects: null, lateRefund: false, mismatch: false };

    // Never trust a callback whose money or reference doesn't match what we asked for.
    if (event.orderReference !== payment.orderId || event.currency !== payment.currency || Math.abs(event.amount - payment.amount) > 0.001) {
      this.logger.error(`Webhook ${event.eventId} does not match payment ${payment.id} (amount/currency/order); ignored`);
      payment.failureReason = 'Webhook amount, currency or order reference mismatch';
      await manager.save(Payment, payment);
      return { ...outcome, mismatch: true };
    }

    const order = await this.lifecycle.lock(payment.orderId, manager);
    outcome.order = order;

    switch (event.type) {
      case 'payment.succeeded': {
        if (payment.status !== PaymentStatusEnum.PENDING) return outcome;
        Object.assign(payment, { status: PaymentStatusEnum.SUCCEEDED, paidAt: new Date(), failureReason: null });
        await manager.save(Payment, payment);

        if (order?.status === OrderStatusEnum.PENDING) outcome.effects = await this.lifecycle.confirmPayment(order, providerName, manager);
        else outcome.lateRefund = true;
        return outcome;
      }
      case 'payment.failed': {
        if (payment.status !== PaymentStatusEnum.PENDING) return outcome;
        Object.assign(payment, { status: PaymentStatusEnum.FAILED, failureReason: event.failureReason ?? 'Payment failed' });
        await manager.save(Payment, payment);

        if (order?.status === OrderStatusEnum.PENDING) outcome.effects = await this.lifecycle.failPayment(order, payment.failureReason!, manager);
        return outcome;
      }
      case 'payment.refunded': {
        if (payment.status === PaymentStatusEnum.REFUNDED) return outcome;
        Object.assign(payment, { status: PaymentStatusEnum.REFUNDED, refundedAt: payment.refundedAt ?? new Date() });
        await manager.save(Payment, payment);
        if (order) await manager.update(Order, { id: order.id }, { paymentStatus: PaymentStatusEnum.REFUNDED });
        return outcome;
      }
    }
  }

  private async afterWebhook({ payment, order, effects, lateRefund, mismatch }: WebhookOutcome, event: PaymentWebhookEvent) {
    if (effects) await this.lifecycle.publish(effects);
    if (!order) return;

    if (mismatch) {
      this.realtime.emitToAdmins(RealtimeEvent.ADMIN_PAYMENT_FAILED, { paymentId: payment.id, orderId: order.id, reason: payment.failureReason });
      return;
    }

    if (event.type === 'payment.succeeded' && payment.status === PaymentStatusEnum.SUCCEEDED) {
      await this.notifyCustomer(
        order,
        payment,
        RealtimeEvent.PAYMENT_SUCCEEDED,
        'Payment received',
        `We received your payment for order ${order.orderNumber}.`,
      );
      if (lateRefund) await this.refundLatePayment(payment, order);
      else await this.shipments.tryCreateForOrder(order.id);
    } else if (event.type === 'payment.failed' && payment.status === PaymentStatusEnum.FAILED) {
      this.realtime.emitToAdmins(RealtimeEvent.ADMIN_PAYMENT_FAILED, {
        paymentId: payment.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        reason: payment.failureReason,
      });
      await this.notifyCustomer(
        order,
        payment,
        RealtimeEvent.PAYMENT_FAILED,
        'Payment failed',
        `The payment for order ${order.orderNumber} failed: ${payment.failureReason}.`,
      );
    } else if (event.type === 'payment.refunded') {
      await this.notifyCustomer(
        order,
        payment,
        RealtimeEvent.PAYMENT_REFUNDED,
        'Payment refunded',
        `Your payment for order ${order.orderNumber} was refunded.`,
      );
    }
  }

  // ── Admin ──

  /** Refunds a successful payment of a cancelled or returned order. */
  async refund(paymentId: string, reason?: string) {
    const payment = await this.payments.findOne({ where: { id: paymentId }, options: { relations: { order: true } } });
    if (!payment) throw new NotFoundException('Payment not found');
    const order = payment.order!;
    if (payment.status !== PaymentStatusEnum.SUCCEEDED || !payment.transactionId) throw new ConflictException('Only successful payments can be refunded');
    if (![OrderStatusEnum.CANCELLED, OrderStatusEnum.RETURNED].includes(order.status)) {
      throw new BadRequestException('Cancel the order or mark it returned before refunding');
    }
    await this.executeRefund(payment, order, reason ?? 'Refund by admin');
    return this.present({ ...payment, status: PaymentStatusEnum.REFUNDED, refundedAt: new Date() }, { ...order, paymentStatus: PaymentStatusEnum.REFUNDED });
  }

  /**
   * Claims the refund with a conditional UPDATE (so two admins can't refund twice), calls the
   * provider outside any transaction, then records the result. The claim is undone if the provider fails.
   */
  private async executeRefund(payment: Payment, order: Order, reason: string) {
    const claim = await this.payments.updateMany({
      where: { id: payment.id, status: PaymentStatusEnum.SUCCEEDED, refundedAt: IsNull() },
      data: { refundedAt: new Date() },
    });
    if (claim.affected !== 1) throw new ConflictException('A refund for this payment is already in progress');

    try {
      await this.providers
        .paymentProvider(payment.provider)
        .refund({ transactionId: payment.transactionId!, amount: payment.amount, currency: payment.currency });
    } catch (error) {
      await this.payments.updateMany({ where: { id: payment.id }, data: { refundedAt: null } });
      throw error;
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Payment, { id: payment.id }, { status: PaymentStatusEnum.REFUNDED, failureReason: null });
      await manager.update(Order, { id: order.id }, { paymentStatus: PaymentStatusEnum.REFUNDED });
    });
    await this.notifyCustomer(
      order,
      { ...payment, status: PaymentStatusEnum.REFUNDED },
      RealtimeEvent.PAYMENT_REFUNDED,
      'Payment refunded',
      `Order ${order.orderNumber}: ${reason}.`,
    );
  }

  private async refundLatePayment(payment: Payment, order: Order) {
    try {
      await this.executeRefund(payment, order, 'Payment arrived after the order was cancelled and has been refunded');
    } catch (error) {
      this.logger.error(`Automatic refund of late payment ${payment.id} failed: ${(error as Error).message}`);
      this.realtime.emitToAdmins(RealtimeEvent.ADMIN_PAYMENT_FAILED, {
        paymentId: payment.id,
        orderId: order.id,
        reason: 'Late payment needs a manual refund',
      });
    }
  }

  // ── Helpers ──

  private present(payment: Payment, order: Pick<Order, 'id' | 'orderNumber' | 'status' | 'paymentStatus' | 'total' | 'expiresAt'>) {
    const { order: _order, ...rest } = payment;
    return {
      ...rest,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        expiresAt: order.expiresAt,
      },
    };
  }

  private emit(order: Order, event: RealtimeEventName, payload: unknown) {
    this.realtime.emitToOrder(order.id, event, payload);
  }

  private async notifyCustomer(order: Order, payment: Payment, event: RealtimeEventName, title: string, message: string) {
    const payload = {
      paymentId: payment.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
    };
    this.emit(order, event, payload);
    await this.notifications.notify({
      userId: order.userId,
      type: NotificationTypeEnum.PAYMENT,
      title,
      message,
      referenceId: order.id,
      data: payload,
      event,
      eventPayload: payload,
    });
  }
}
