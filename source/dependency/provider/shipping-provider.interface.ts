import type { IncomingHttpHeaders } from 'node:http';

import type { AddressSnapshot } from '../../database/model/order.model.js';
import type { ShipmentStatusEnum } from '../value/database.enum.js';

export const SHIPPING_PROVIDERS = Symbol('SHIPPING_PROVIDERS');

export interface ShippingWebhookEvent {
  eventId: string;
  trackingNumber: string;
  status: ShipmentStatusEnum;
  occurredAt: Date;
  location?: string;
  note?: string;
}

/** Port every carrier adapter implements (class diagram: ShippingProviderAdapter). */
export interface ShippingProvider {
  readonly name: string;
  /** Carrier name shown to customers. */
  readonly carrier: string;
  createShipment(input: { orderNumber: string; address: AddressSnapshot; methodCode: string }): Promise<{ trackingNumber: string }>;
  /** Verifies the signature and parses the body. Throws UnauthorizedException on a bad signature. */
  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): ShippingWebhookEvent;
}
