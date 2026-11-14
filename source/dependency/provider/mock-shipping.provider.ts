import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

import type { ShippingProvider, ShippingWebhookEvent } from './shipping-provider.interface.js';
import { verifyBodySignature } from './signature.js';
import { ShipmentStatusEnum } from '../value/database.enum.js';

const STATUSES = new Set<string>(Object.values(ShipmentStatusEnum));

/** Development carrier. Webhooks are signed with SHIPPING_MOCK_WEBHOOK_SECRET in `x-mock-signature`. */
@Injectable()
export class MockShippingProvider implements ShippingProvider {
  readonly name = 'mock';
  readonly carrier = 'Horologe Express';

  constructor(private readonly config: ConfigService) {}

  async createShipment(): Promise<{ trackingNumber: string }> {
    const digits = Array.from({ length: 12 }, () => randomInt(0, 10)).join('');
    return { trackingNumber: `HX${digits}` };
  }

  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): ShippingWebhookEvent {
    const secret = this.config.get<string>('shipping.mockWebhookSecret');
    if (!secret) throw new ServiceUnavailableException('Shipping webhooks are not configured');
    if (!verifyBodySignature(secret, rawBody, headers['x-mock-signature'] as string | undefined)) throw new UnauthorizedException('Invalid webhook signature');

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    const { eventId, trackingNumber, status, occurredAt, location, note } = body;
    if (typeof eventId !== 'string' || typeof trackingNumber !== 'string' || typeof status !== 'string' || !STATUSES.has(status)) {
      throw new BadRequestException('Invalid webhook payload');
    }
    const at = typeof occurredAt === 'string' ? new Date(occurredAt) : new Date();

    return {
      eventId,
      trackingNumber,
      status: status as ShipmentStatusEnum,
      occurredAt: Number.isNaN(at.getTime()) ? new Date() : at,
      ...(typeof location === 'string' ? { location: location.slice(0, 120) } : {}),
      ...(typeof note === 'string' ? { note: note.slice(0, 300) } : {}),
    };
  }
}
