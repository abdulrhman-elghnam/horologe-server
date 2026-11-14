import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

import type { CreatePaymentInput, CreatePaymentResult, PaymentProvider, PaymentWebhookEvent } from './payment-provider.interface.js';
import { verifyBodySignature } from './signature.js';

const TYPES = new Set(['payment.succeeded', 'payment.failed', 'payment.refunded']);

/**
 * Development gateway. It "creates" payments locally and accepts webhooks signed with
 * PAYMENT_MOCK_WEBHOOK_SECRET in the `x-mock-signature` header (HMAC-SHA256 hex of the raw body).
 * See scripts/mock-webhook.mjs to send one.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  constructor(private readonly config: ConfigService) {}

  async createPayment({ orderId }: CreatePaymentInput): Promise<CreatePaymentResult> {
    const transactionId = `mock_txn_${randomUUID()}`;
    const frontend = this.config.get<string>('app.frontendUrl', 'http://localhost:3000').replace(/\/$/, '');
    return { transactionId, checkoutUrl: `${frontend}/checkout/pay?provider=mock&order=${orderId}&transaction=${transactionId}` };
  }

  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): PaymentWebhookEvent {
    const secret = this.config.get<string>('payment.mockWebhookSecret');
    if (!secret) throw new ServiceUnavailableException('Payment webhooks are not configured');
    if (!verifyBodySignature(secret, rawBody, headers['x-mock-signature'] as string | undefined)) throw new UnauthorizedException('Invalid webhook signature');

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    const { eventId, type, transactionId, orderReference, amount, currency, failureReason } = body;
    if (
      typeof eventId !== 'string' ||
      typeof type !== 'string' ||
      !TYPES.has(type) ||
      typeof transactionId !== 'string' ||
      typeof orderReference !== 'string'
    ) {
      throw new BadRequestException('Invalid webhook payload');
    }
    if (typeof amount !== 'number' || typeof currency !== 'string') throw new BadRequestException('Invalid webhook payload');

    return {
      eventId,
      type: type as PaymentWebhookEvent['type'],
      transactionId,
      orderReference,
      amount,
      currency: currency.toUpperCase(),
      ...(typeof failureReason === 'string' ? { failureReason: failureReason.slice(0, 300) } : {}),
    };
  }

  async refund(): Promise<{ refundId: string }> {
    return { refundId: `mock_refund_${randomUUID()}` };
  }
}
