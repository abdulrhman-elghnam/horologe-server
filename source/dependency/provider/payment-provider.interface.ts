import type { IncomingHttpHeaders } from 'node:http';

export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');

export interface CreatePaymentInput {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  customerEmail: string;
}

export interface CreatePaymentResult {
  transactionId: string;
  /** Hosted page where the customer pays, if the provider has one. */
  checkoutUrl: string | null;
}

export type PaymentWebhookType = 'payment.succeeded' | 'payment.failed' | 'payment.refunded';

/** A verified, provider-neutral webhook event. */
export interface PaymentWebhookEvent {
  eventId: string;
  type: PaymentWebhookType;
  transactionId: string;
  /** Our order id, echoed back by the provider. */
  orderReference: string;
  amount: number;
  currency: string;
  failureReason?: string;
}

/**
 * Port every payment gateway adapter implements (class diagram: IPaymentProvider).
 * Adding Stripe/Paymob/etc. = one new class + one line in ProviderModule.
 */
export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /** Verifies the signature and parses the body. Throws UnauthorizedException on a bad signature. */
  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): PaymentWebhookEvent;
  refund(input: { transactionId: string; amount: number; currency: string }): Promise<{ refundId: string }>;
}
