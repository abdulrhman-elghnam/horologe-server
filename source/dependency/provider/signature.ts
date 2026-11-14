import { createHmac, timingSafeEqual } from 'node:crypto';

/** HMAC-SHA256 hex signature of a raw webhook body. */
export const signBody = (secret: string, body: Buffer | string): string => createHmac('sha256', secret).update(body).digest('hex');

export const verifyBodySignature = (secret: string, body: Buffer, signature: string | undefined): boolean => {
  if (!signature) return false;
  const expected = Buffer.from(signBody(secret, body));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
};
