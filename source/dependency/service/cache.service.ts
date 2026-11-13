import type {
  SetCache,
  CacheKey,
  ExpireCache,
  IncrementCache,
  FindCacheKeys,
  DeleteManyCache,
  GetOrSetCache,
  RateLimit,
  RateLimitResult,
} from './../interface/redis.interface.js';

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis, Result } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

const SCRIPTS = {
  incrWithTtl: `
local v = redis.call('INCRBY', KEYS[1], ARGV[1])
if tonumber(ARGV[2]) > 0 and redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return v`,
  // Fixed-window counter: returns { count, secondsUntilReset }.
  rateLimit: `
local c = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { c, ttl }`,
  // Atomically update a hash only if `field` still equals `expected`.
  // ARGV: field, expected, ttlSeconds (0 = keep), then field/value pairs to write.
  // Returns 1 updated, 0 mismatch, -1 missing key.
  hashCompareAndSet: `
local current = redis.call('HGET', KEYS[1], ARGV[1])
if not current then return -1 end
if current ~= ARGV[2] then return 0 end
redis.call('HSET', KEYS[1], unpack(ARGV, 4))
if tonumber(ARGV[3]) > 0 then redis.call('EXPIRE', KEYS[1], ARGV[3]) end
return 1`,
} as const;

declare module 'ioredis' {
  interface RedisCommander<Context> {
    incrWithTtl(key: string, amount: number, ttl: number): Result<number, Context>;
    rateLimit(key: string, windowSeconds: number): Result<[number, number], Context>;
    hashCompareAndSet(key: string, field: string, expected: string, ttl: number, ...pairs: string[]): Result<number, Context>;
  }
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const RedisKeys = {
  otpKey: (email: string) => `otp:${normalizeEmail(email)}`,
  emailVerification: (email: string) => `auth:email-verification:${normalizeEmail(email)}`,
  passwordReset: (tokenHash: string) => `auth:password-reset:${tokenHash}`,
  rateLimitKey: (scope: string, id: string) => `rate:${scope}:${id}`,
  emailVerificationAttempts: (email: string) => `auth:email-verification-attempts:${normalizeEmail(email)}`,
  /** Hash holding one login session (access/refresh jti, device info). */
  session: (userId: string, sessionId: string) => `auth:session:${userId}:${sessionId}`,
  /** Set of a user's session ids, so sessions can be listed/revoked without SCAN. */
  userSessions: (userId: string) => `auth:sessions:${userId}`,
  httpCache: (language: string, url: string) => `http-cache:${language}:${url}`,
} as const;

const assertPositiveInt = (name: string, value: number) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer, got ${value}`);
  }
};

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly cacheClient: Redis) {
    for (const [name, lua] of Object.entries(SCRIPTS)) {
      this.cacheClient.defineCommand(name, { numberOfKeys: 1, lua });
    }
  }

  private serialize(value: unknown): string {
    const json = JSON.stringify(value);
    if (json === undefined) {
      throw new TypeError('Cannot cache undefined, functions or symbols');
    }
    return json;
  }

  private deserialize<T>(raw: string): T {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async ping(): Promise<boolean> {
    return (await this.cacheClient.ping()) === 'PONG';
  }

  async setCache<T = unknown>({ key, value, options = {} }: SetCache<T>): Promise<boolean> {
    const { EX, PX, NX, XX, KEEPTTL } = options;

    if ([EX !== undefined, PX !== undefined, !!KEEPTTL].filter(Boolean).length > 1) {
      throw new Error('EX, PX and KEEPTTL are mutually exclusive');
    }
    if (NX && XX) {
      throw new Error('NX and XX are mutually exclusive');
    }
    if (EX !== undefined) assertPositiveInt('EX', EX);
    if (PX !== undefined) assertPositiveInt('PX', PX);

    const args: (string | number)[] = [];
    if (EX !== undefined) args.push('EX', EX);
    if (PX !== undefined) args.push('PX', PX);
    if (KEEPTTL) args.push('KEEPTTL');
    if (NX) args.push('NX');
    if (XX) args.push('XX');

    const result = await this.cacheClient.call('SET', key, this.serialize(value), ...args);
    return result === 'OK';
  }

  async getCache<T = unknown>({ key }: CacheKey): Promise<T | null> {
    const value = await this.cacheClient.get(key);
    return value !== null ? this.deserialize<T>(value) : null;
  }

  async setHash({ key, values, ttl }: CacheKey & { values: Record<string, string | number>; ttl?: number }): Promise<void> {
    const tx = this.cacheClient.multi().hset(key, values);
    if (ttl !== undefined) {
      assertPositiveInt('ttl', ttl);
      tx.expire(key, ttl);
    }
    await tx.exec();
  }

  /** Returns null when the hash does not exist. */
  async getHash({ key }: CacheKey): Promise<Record<string, string> | null> {
    const hash = await this.cacheClient.hgetall(key);
    return Object.keys(hash).length ? hash : null;
  }

  async getHashField({ key, field }: CacheKey & { field: string }): Promise<string | null> {
    return this.cacheClient.hget(key, field);
  }

  /** Writes `values` only if `field` still equals `expected` (atomic, safe against concurrent callers). */
  async compareAndSetHash({
    key,
    field,
    expected,
    values,
    ttl = 0,
  }: CacheKey & { field: string; expected: string; values: Record<string, string | number>; ttl?: number }): Promise<'updated' | 'mismatch' | 'missing'> {
    const pairs = Object.entries(values).flatMap(([k, v]) => [k, String(v)]);
    if (!pairs.length) throw new Error('compareAndSetHash needs at least one value');
    const result = await this.cacheClient.hashCompareAndSet(key, field, expected, ttl, ...pairs);
    return result === 1 ? 'updated' : result === 0 ? 'mismatch' : 'missing';
  }

  /** Adds members and, when `ttl` is given, (re)sets the set's expiry. */
  async addToSet({ key, members, ttl }: CacheKey & { members: string[]; ttl?: number }): Promise<void> {
    if (!members.length) return;
    const tx = this.cacheClient.multi().sadd(key, ...members);
    if (ttl !== undefined) {
      assertPositiveInt('ttl', ttl);
      tx.expire(key, ttl);
    }
    await tx.exec();
  }

  async getSetMembers({ key }: CacheKey): Promise<string[]> {
    return this.cacheClient.smembers(key);
  }

  async removeFromSet({ key, members }: CacheKey & { members: string[] }): Promise<number> {
    if (!members.length) return 0;
    return this.cacheClient.srem(key, ...members);
  }

  async getAndDelete<T = unknown>({ key }: CacheKey): Promise<T | null> {
    const value = await this.cacheClient.getdel(key);
    return value !== null ? this.deserialize<T>(value) : null;
  }

  async deleteCache({ key }: CacheKey): Promise<number> {
    return this.cacheClient.unlink(key);
  }

  async deleteMany({ keys }: DeleteManyCache): Promise<number> {
    if (!keys.length) return 0;
    return this.cacheClient.unlink(...keys);
  }

  async cacheExists({ key }: CacheKey): Promise<boolean> {
    return (await this.cacheClient.exists(key)) > 0;
  }

  async expireCache({ key, seconds }: ExpireCache): Promise<boolean> {
    assertPositiveInt('seconds', seconds);
    return (await this.cacheClient.expire(key, seconds)) === 1;
  }

  async getTTL({ key }: CacheKey): Promise<number> {
    return this.cacheClient.ttl(key);
  }

  async persistCache({ key }: CacheKey): Promise<boolean> {
    return (await this.cacheClient.persist(key)) === 1;
  }

  async incrementCache({ key, amount = 1, ttl = 0 }: IncrementCache): Promise<number> {
    if (ttl > 0) {
      assertPositiveInt('ttl', ttl);
      return this.cacheClient.incrWithTtl(key, amount, ttl);
    }
    return this.cacheClient.incrby(key, amount);
  }

  async decrementCache({ key, amount = 1 }: Omit<IncrementCache, 'ttl'>): Promise<number> {
    return this.cacheClient.decrby(key, amount);
  }

  async getOrSet<T>({ key, ttl, factory }: GetOrSetCache<T>): Promise<T> {
    assertPositiveInt('ttl', ttl);

    try {
      const cached = await this.getCache<T>({ key });
      if (cached !== null) return cached;
    } catch (error) {
      this.logger.warn(`Cache read failed for "${key}": ${(error as Error).message}`);
    }

    const fresh = await factory();
    if (fresh !== undefined) {
      await this.setCache({ key, value: fresh, options: { EX: ttl } }).catch((error: Error) => {
        this.logger.warn(`Cache write failed for "${key}": ${error.message}`);
      });
    }
    return fresh;
  }

  async rateLimit({ key, limit, windowSeconds }: RateLimit): Promise<RateLimitResult> {
    assertPositiveInt('limit', limit);
    assertPositiveInt('windowSeconds', windowSeconds);

    const [count, ttl] = await this.cacheClient.rateLimit(key, windowSeconds);
    const allowed = count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      retryAfter: allowed ? 0 : Math.max(0, ttl),
    };
  }

  async findCacheKeys({ pattern = '*', count = 100 }: FindCacheKeys = {}): Promise<string[]> {
    const keys = new Set<string>();
    const stream = this.cacheClient.scanStream({ match: pattern, count });

    for await (const batch of stream as AsyncIterable<string[]>) {
      for (const key of batch) keys.add(key);
    }
    return [...keys];
  }

  async deleteByPattern({ pattern, count = 200 }: Required<Pick<FindCacheKeys, 'pattern'>> & Pick<FindCacheKeys, 'count'>): Promise<number> {
    let deleted = 0;
    const stream = this.cacheClient.scanStream({ match: pattern, count });

    for await (const batch of stream as AsyncIterable<string[]>) {
      if (batch.length) deleted += await this.cacheClient.unlink(...batch);
    }
    this.logger.debug(`Deleted ${deleted} keys matching "${pattern}"`);
    return deleted;
  }
}
