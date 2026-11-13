import { createHmac, timingSafeEqual } from 'node:crypto';

export const API_PREFIX = '/api/v1';
export type SignedFileKind = 'image' | 'avatar';

export class SignedUrl {
  private static secret: Buffer | null = null;
  static readonly TTL_SECONDS = 60 * 60;

  static configure(secret: Buffer) {
    SignedUrl.secret = secret;
  }

  private static signature(kind: string, id: string, exp: number): string {
    if (!SignedUrl.secret) throw new Error('SignedUrl is not configured');
    return createHmac('sha256', SignedUrl.secret).update(`${kind}:${id}:${exp}`).digest('base64url');
  }

  static sign(kind: SignedFileKind, id: string, now = Date.now()): string {
    const hour = 3600;
    const exp = (Math.floor(now / 1000 / hour) + 2) * hour; // valid 1-2h
    return `${API_PREFIX}/files/${kind}/${id}?exp=${exp}&sig=${SignedUrl.signature(kind, id, exp)}`;
  }

  static verify(kind: string, id: string, exp: string, sig: string, now = Date.now()): boolean {
    const expNum = Number(exp);
    if (!Number.isFinite(expNum) || expNum * 1000 < now || typeof sig !== 'string') return false;
    const expected = Buffer.from(SignedUrl.signature(kind, id, expNum));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
