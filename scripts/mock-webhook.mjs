#!/usr/bin/env node
// Sends a signed webhook to the mock payment/shipping provider, like a real gateway would.
//
//   node scripts/mock-webhook.mjs payment payment.succeeded <transactionId> <orderId> <amount> [currency]
//   node scripts/mock-webhook.mjs payment payment.failed    <transactionId> <orderId> <amount> [currency]
//   node scripts/mock-webhook.mjs shipping <trackingNumber> <status> [location]
//
// Reads PORT and the *_MOCK_WEBHOOK_SECRET values from .env.development (or the environment).
import { createHmac, randomUUID } from 'node:crypto';

try {
  process.loadEnvFile(`.env.${process.env.NODE_ENV ?? 'development'}`);
} catch {
  /* rely on the environment */
}

const [kind, ...args] = process.argv.slice(2);
const base = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api/v1`;

let url, secret, body;
if (kind === 'payment') {
  const [type, transactionId, orderReference, amount, currency = process.env.STORE_CURRENCY ?? 'USD'] = args;
  url = `${base}/payments/webhooks/mock`;
  secret = process.env.PAYMENT_MOCK_WEBHOOK_SECRET;
  body = { eventId: `evt_${randomUUID()}`, type, transactionId, orderReference, amount: Number(amount), currency };
} else if (kind === 'shipping') {
  const [trackingNumber, status, location] = args;
  url = `${base}/shipping/webhooks/mock`;
  secret = process.env.SHIPPING_MOCK_WEBHOOK_SECRET;
  body = { eventId: `evt_${randomUUID()}`, trackingNumber, status, occurredAt: new Date().toISOString(), ...(location ? { location } : {}) };
} else {
  console.error('Usage: see the comment at the top of scripts/mock-webhook.mjs');
  process.exit(1);
}
if (!secret) {
  console.error('Missing webhook secret in the environment');
  process.exit(1);
}

const raw = JSON.stringify(body);
const response = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-mock-signature': createHmac('sha256', secret).update(raw).digest('hex') },
  body: raw,
});
console.log(response.status, await response.text());
