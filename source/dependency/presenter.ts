import type { Types } from 'mongoose';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { Localize } from './language/localize.js';

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

const idOf = (value: unknown): string | null => {
  if (!value) return null;
  const v = value as { _id?: Types.ObjectId; toString(): string };
  return v._id ? v._id.toString() : v.toString();
};

export const presentUser = (user: any) => {
  if (!user) return null;
  if (typeof user !== 'object' || !('email' in user)) return { id: idOf(user) };
  const id = idOf(user)!;
  return {
    id,
    _id: id,
    name: user.name,
    email: user.email,
    city: user.city,
    phone: user.phone ?? null,
    role: user.role,
    avatarUrl: user.avatarKey ? SignedUrl.sign('avatar', id) : (user.avatarUrl ?? null),
    provider: user.provider,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    isActive: user.isActive !== false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const imageFileUrl = (imageId: string) => `${API_PREFIX}/fundus-images/${imageId}/file`;

export const paged = <T>(result: { docs: unknown[]; count: number; currentPage: number; size: number; pages: number }, map: (doc: any) => T) => ({
  items: result.docs.map(map),
  total: result.count,
  page: result.currentPage,
  size: result.size,
  pages: result.pages,
});
