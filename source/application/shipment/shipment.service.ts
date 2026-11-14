import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import { DataSource, EntityManager } from 'typeorm';

import { canMoveShipment, IN_CARRIER_HANDS } from './shipment.state.js';
import type { CreateShipmentDto, ShipmentQueryDto } from '../shipping/dto/shipping.dto.js';
import { ShippingService } from '../shipping/shipping.service.js';
import { NotificationService } from '../notification/notification.service.js';
import { OrderLifecycleService, type OrderEffects } from '../order/order-lifecycle.service.js';
import { RealtimeEvent } from '../realtime/realtime.event.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { Shipment, type ShipmentEvent } from '../../database/model/shipment.model.js';
import { paginateQuery } from '../../database/repository/base.repository.js';
import { OrderRepository } from '../../database/repository/order.repository.js';
import { ShipmentRepository } from '../../database/repository/shipment.repository.js';
import { WebhookEventRepository } from '../../database/repository/webhook-event.repository.js';
import { sortDirection } from '../../dependency/dto/pagination.dto.js';
import { ProviderRegistry } from '../../dependency/provider/provider.registry.js';
import { escapeLike, isUniqueViolation } from '../../dependency/service/util.service.js';
import { NotificationTypeEnum, OrderStatusEnum, PaymentStatusEnum, ShipmentStatusEnum } from '../../dependency/value/database.enum.js';

interface StatusUpdate {
  status: ShipmentStatusEnum;
  note?: string;
  location?: string;
  at?: Date;
}

@Injectable()
export class ShipmentService {
  private readonly logger = new Logger(ShipmentService.name);

  constructor(
    private readonly shipments: ShipmentRepository,
    private readonly orders: OrderRepository,
    private readonly webhookEvents: WebhookEventRepository,
    private readonly shipping: ShippingService,
    private readonly lifecycle: OrderLifecycleService,
    private readonly notifications: NotificationService,
    private readonly realtime: RealtimeService,
    private readonly providers: ProviderRegistry,
    private readonly dataSource: DataSource,
  ) {}

  // ── Creation ──

  /**
   * Books the parcel for a paid order and moves the order to PROCESSING.
   * Called by admins (POST /admin/shipments) and automatically after a successful payment.
   */
  async createForOrder(orderId: string, input: Omit<CreateShipmentDto, 'orderId'> = {}, actor = 'system') {
    const order = await this.orders.findById({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');
    if (order.paymentStatus !== PaymentStatusEnum.SUCCEEDED || ![OrderStatusEnum.CONFIRMED, OrderStatusEnum.PROCESSING].includes(order.status)) {
      throw new ConflictException('Only paid orders that have not shipped yet can get a shipment');
    }
    if (await this.shipments.exists({ where: { orderId } })) throw new ConflictException('This order already has a shipment');

    const method = await this.shipping.getMethod(input.shippingMethodId ?? order.shippingMethodId);
    const provider = this.providers.shippingProvider();
    const trackingNumber =
      input.trackingNumber ??
      (await provider.createShipment({ orderNumber: order.orderNumber, address: order.shippingAddress, methodCode: method.code })).trackingNumber;

    let result: { shipment: Shipment; effects: OrderEffects | null };
    try {
      result = await this.dataSource.transaction(async (manager) => {
        const shipment = await this.shipments.create({
          data: {
            orderId,
            shippingMethodId: method.id,
            trackingNumber,
            carrier: input.carrier ?? provider.carrier,
            status: ShipmentStatusEnum.PENDING,
            events: [{ status: ShipmentStatusEnum.PENDING, at: new Date().toISOString(), note: 'Shipment created' }],
          },
          manager,
        });
        const locked = await this.lifecycle.lock(orderId, manager);
        const effects =
          locked?.status === OrderStatusEnum.CONFIRMED ? await this.lifecycle.adminTransition(locked, OrderStatusEnum.PROCESSING, { actor, manager }) : null;
        return { shipment, effects };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('This order already has a shipment');
      throw error;
    }

    if (result.effects) await this.lifecycle.publish(result.effects);
    await this.announce(
      result.shipment,
      order.userId,
      RealtimeEvent.SHIPMENT_CREATED,
      'Shipment created',
      `Your order ${order.orderNumber} has a tracking number: ${trackingNumber}.`,
    );
    return result.shipment;
  }

  /** Best-effort version used right after payment; a failure only means an admin creates it manually. */
  async tryCreateForOrder(orderId: string) {
    try {
      await this.createForOrder(orderId);
    } catch (error) {
      this.logger.warn(`Automatic shipment for order ${orderId} not created: ${(error as Error).message}`);
    }
  }

  // ── Status changes ──

  async adminUpdateStatus(shipmentId: string, update: StatusUpdate) {
    return (await this.applyStatus({ shipmentId }, update, { strict: true })) as Shipment;
  }

  /** Verified, idempotent carrier callback. Out-of-order or repeated events are acknowledged and ignored. */
  async handleWebhook(providerName: string, rawBody: Buffer, headers: IncomingHttpHeaders) {
    const event = this.providers.shippingProvider(providerName).parseWebhook(rawBody, headers);

    const shipment = await this.applyStatus(
      { trackingNumber: event.trackingNumber },
      { status: event.status, note: event.note, location: event.location, at: event.occurredAt },
      { strict: false, dedupe: { source: `shipping:${providerName}`, eventId: event.eventId, type: event.status } },
    );
    return shipment === 'duplicate' ? { received: true, duplicate: true } : { received: true, applied: !!shipment };
  }

  /**
   * strict: throw on unknown shipment / invalid move (admin) instead of ignoring it (webhook).
   * dedupe: webhook event recorded in the same transaction, so a failed attempt can be retried by the carrier.
   */
  private async applyStatus(
    target: { shipmentId?: string; trackingNumber?: string },
    { status, note, location, at = new Date() }: StatusUpdate,
    { strict, dedupe }: { strict: boolean; dedupe?: { source: string; eventId: string; type: string } },
  ): Promise<Shipment | null | 'duplicate'> {
    const outcome = await this.dataSource.transaction(async (manager) => {
      if (dedupe && !(await this.webhookEvents.markProcessed({ ...dedupe, manager }))) return 'duplicate' as const;

      const shipment = await this.lockShipment(target, manager);
      if (!shipment) {
        if (strict) throw new NotFoundException('Shipment not found');
        return null;
      }
      if (!canMoveShipment(shipment.status, status)) {
        if (strict) throw new ConflictException({ message: `Shipment cannot move from ${shipment.status} to ${status}`, code: 'INVALID_SHIPMENT_TRANSITION' });
        return null;
      }

      const event: ShipmentEvent = { status, at: at.toISOString(), ...(note ? { note } : {}), ...(location ? { location } : {}) };
      shipment.status = status;
      shipment.events = [...shipment.events, event];
      if (IN_CARRIER_HANDS.has(status) && !shipment.shippedAt) shipment.shippedAt = at;
      if (status === ShipmentStatusEnum.DELIVERED) shipment.deliveredAt = at;
      await manager.save(Shipment, shipment);

      const orderTarget = status === ShipmentStatusEnum.DELIVERED ? OrderStatusEnum.DELIVERED : IN_CARRIER_HANDS.has(status) ? OrderStatusEnum.SHIPPED : null;
      const effects = orderTarget ? await this.lifecycle.followShipment(shipment.orderId, orderTarget, manager) : null;
      return { shipment, effects };
    });
    if (!outcome || outcome === 'duplicate') return outcome;

    if (outcome.effects) await this.lifecycle.publish(outcome.effects);
    const order = await this.orders.findById({ id: outcome.shipment.orderId, options: { select: { id: true, userId: true, orderNumber: true } } });
    if (order) {
      const delivered = status === ShipmentStatusEnum.DELIVERED;
      await this.announce(
        outcome.shipment,
        order.userId,
        delivered ? RealtimeEvent.SHIPMENT_DELIVERED : RealtimeEvent.SHIPMENT_STATUS_UPDATED,
        delivered ? 'Parcel delivered' : 'Shipment update',
        `Order ${order.orderNumber}: ${status.replace(/_/g, ' ')}${location ? ` (${location})` : ''}.`,
      );
    }
    return outcome.shipment;
  }

  // ── Queries ──

  /** Public tracking: status history only, no address or customer data. */
  async track(trackingNumber: string) {
    const shipment = await this.shipments.findOne({ where: { trackingNumber } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    const { trackingNumber: number, carrier, status, events, shippedAt, deliveredAt } = shipment;
    return { trackingNumber: number, carrier, status, shippedAt, deliveredAt, events };
  }

  list({ page, limit, status, search, sortOrder }: ShipmentQueryDto) {
    const query = this.shipments
      .repo()
      .createQueryBuilder('shipment')
      .leftJoinAndSelect('shipment.order', 'order')
      .leftJoinAndSelect('shipment.shippingMethod', 'method');
    if (status) query.andWhere('shipment.status = :status', { status });
    if (search) query.andWhere('(shipment.trackingNumber ILIKE :search OR order.orderNumber ILIKE :search)', { search: `%${escapeLike(search)}%` });
    query.orderBy('shipment.createdAt', sortDirection(sortOrder));
    return paginateQuery(query, page, limit);
  }

  async get(id: string) {
    const shipment = await this.shipments.findOne({ where: { id }, options: { relations: { order: true, shippingMethod: true } } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    return shipment;
  }

  // ── Helpers ──

  private lockShipment({ shipmentId, trackingNumber }: { shipmentId?: string; trackingNumber?: string }, manager: EntityManager) {
    return manager.findOne(Shipment, {
      where: shipmentId ? { id: shipmentId } : { trackingNumber },
      lock: { mode: 'pessimistic_write' },
    });
  }

  private async announce(
    shipment: Shipment,
    userId: string,
    event: typeof RealtimeEvent.SHIPMENT_CREATED | typeof RealtimeEvent.SHIPMENT_STATUS_UPDATED | typeof RealtimeEvent.SHIPMENT_DELIVERED,
    title: string,
    message: string,
  ) {
    const payload = {
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      trackingNumber: shipment.trackingNumber,
      carrier: shipment.carrier,
      status: shipment.status,
    };
    this.realtime.emitToOrder(shipment.orderId, event, payload);
    await this.notifications.notify({
      userId,
      type: NotificationTypeEnum.SHIPMENT,
      title,
      message,
      referenceId: shipment.orderId,
      data: payload,
      event,
      eventPayload: payload,
    });
  }
}
