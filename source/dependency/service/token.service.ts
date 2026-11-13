import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from 'jsonwebtoken';

import { randomUUID } from 'node:crypto';

import { CacheService, RedisKeys } from './cache.service.js';
import { isUuid } from './util.service.js';
import { SystemRoleEnum, TokenEnum } from '../value/security.enum.js';
import type { IAuthReq } from '../interface/ctx.interface.js';

import type { User } from '../../database/model/user.model.js';
import { UserRepository } from '../../database/repository/user.repository.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

/** Claims every token issued here carries (on top of iss/iat/exp). */
export interface AuthTokenPayload extends JwtPayload {
  sub: string;
  jti: string;
  /** Session id: shared by the access/refresh pair and kept across refreshes. */
  sid: string;
}

export interface SessionClient {
  ip?: string;
  userAgent?: string;
}

export interface SessionView {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

const MAX_USER_AGENT_LENGTH = 256;

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly accessTokenExpiresIn: number;
  private readonly refreshTokenExpiresIn: number;
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cache: CacheService,
    private readonly userRepository: UserRepository,
  ) {
    this.accessTokenExpiresIn = Number(this.configService.getOrThrow<string>('ACCESS_TOKEN_EXPIRES_IN'));
    this.refreshTokenExpiresIn = Number(this.configService.getOrThrow<string>('REFRESH_TOKEN_EXPIRES_IN'));
    this.accessSecret = this.configService.getOrThrow<string>('ACCESS_USER_TOKEN_SIGNATURE');
    this.refreshSecret = this.configService.getOrThrow<string>('REFRESH_USER_TOKEN_SIGNATURE');

    for (const [name, value] of [
      ['ACCESS_TOKEN_EXPIRES_IN', this.accessTokenExpiresIn],
      ['REFRESH_TOKEN_EXPIRES_IN', this.refreshTokenExpiresIn],
    ] as const) {
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer number of seconds`);
      }
    }
    if (this.accessSecret === this.refreshSecret) {
      throw new Error('ACCESS_USER_TOKEN_SIGNATURE and REFRESH_USER_TOKEN_SIGNATURE must differ');
    }
  }

  getBearerToken(request: IAuthReq): string {
    const [scheme, token, ...extra] = request.headers.authorization?.trim().split(/\s+/) ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token || extra.length > 0) {
      throw new UnauthorizedException('Invalid authorization format');
    }
    return token;
  }

  private secretFor(tokenType: TokenEnum): string {
    return tokenType === TokenEnum.REFRESH ? this.refreshSecret : this.accessSecret;
  }

  private jtiField(tokenType: TokenEnum): 'accessJti' | 'refreshJti' {
    return tokenType === TokenEnum.REFRESH ? 'refreshJti' : 'accessJti';
  }

  private async signPair({ user, sessionId, issuer }: { user: Pick<User, 'id' | 'role'>; sessionId: string; issuer: string }) {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();
    const sign = (tokenType: TokenEnum, jwtid: string, expiresIn: number) =>
      this.jwtService.signAsync(
        { sid: sessionId },
        { secret: this.secretFor(tokenType), subject: user.id, audience: [tokenType, user.role], issuer, jwtid, expiresIn },
      );

    const [accessToken, refreshToken] = await Promise.all([
      sign(TokenEnum.ACCESS, accessJti, this.accessTokenExpiresIn),
      sign(TokenEnum.REFRESH, refreshJti, this.refreshTokenExpiresIn),
    ]);
    const tokens: AuthTokens = { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: this.accessTokenExpiresIn };
    return { tokens, accessJti, refreshJti };
  }

  /** Starts a new login session and returns its token pair. */
  async createSession({ user, issuer, client = {} }: { user: Pick<User, 'id' | 'role'>; issuer: string; client?: SessionClient }): Promise<AuthTokens> {
    const sessionId = randomUUID();
    const { tokens, accessJti, refreshJti } = await this.signPair({ user, sessionId, issuer });
    const now = new Date().toISOString();

    await this.cache.setHash({
      key: RedisKeys.session(user.id, sessionId),
      values: {
        accessJti,
        refreshJti,
        ip: client.ip ?? '',
        userAgent: (client.userAgent ?? '').slice(0, MAX_USER_AGENT_LENGTH),
        createdAt: now,
        lastUsedAt: now,
      },
      ttl: this.refreshTokenExpiresIn,
    });
    await this.cache.addToSet({ key: RedisKeys.userSessions(user.id), members: [sessionId], ttl: this.refreshTokenExpiresIn });

    return tokens;
  }

  /**
   * Verifies signature, type, claims and that the session still accepts this exact token,
   * then loads the user. Used by AuthGuard for every protected request.
   */
  async decodeToken({ token, tokenType = TokenEnum.ACCESS }: { token: string; tokenType?: TokenEnum }): Promise<{ user: User; decoded: AuthTokenPayload }> {
    let decoded: AuthTokenPayload;
    try {
      // Access and refresh tokens use different secrets, so a token of the wrong type fails here.
      decoded = await this.jwtService.verifyAsync<AuthTokenPayload>(token, { secret: this.secretFor(tokenType) });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const [claimedType, claimedRole] = Array.isArray(decoded.aud) ? decoded.aud : [];
    if (
      claimedType !== tokenType ||
      !Object.values(SystemRoleEnum).includes(claimedRole as SystemRoleEnum) ||
      !isUuid(decoded.sub) ||
      !isUuid(decoded.sid) ||
      !isUuid(decoded.jti)
    ) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const activeJti = await this.cache.getHashField({ key: RedisKeys.session(decoded.sub, decoded.sid), field: this.jtiField(tokenType) });
    if (activeJti !== decoded.jti) {
      // A validly signed refresh token from a live session that has already been rotated means it was
      // used twice: likely stolen. End the session so the thief's newer tokens die too.
      if (tokenType === TokenEnum.REFRESH && activeJti !== null) {
        this.logger.warn(`Refresh token reuse detected for user ${decoded.sub}, session ${decoded.sid}; revoking session`);
        await this.revokeSession({ userId: decoded.sub, sessionId: decoded.sid });
      }
      throw new UnauthorizedException('Invalid login session');
    }

    const user = await this.userRepository.findById({ id: decoded.sub });
    if (!user || !user.isActive || user.role !== claimedRole) {
      // Role changes and deactivation invalidate existing tokens immediately.
      throw new UnauthorizedException('Invalid login session');
    }

    return { user, decoded };
  }

  /**
   * Exchanges a refresh token for a new pair in the same session. Each refresh token works once;
   * presenting an already-used one revokes the whole session (it was likely stolen).
   */
  async rotateRefreshToken({ token, issuer }: { token: string; issuer: string }): Promise<AuthTokens> {
    let decoded: AuthTokenPayload;
    try {
      decoded = await this.jwtService.verifyAsync<AuthTokenPayload>(token, { secret: this.refreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const [claimedType] = Array.isArray(decoded.aud) ? decoded.aud : [];
    if (claimedType !== TokenEnum.REFRESH || !isUuid(decoded.sub) || !isUuid(decoded.sid) || !isUuid(decoded.jti)) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.userRepository.findById({ id: decoded.sub });
    if (!user || !user.isActive) {
      await this.revokeSession({ userId: decoded.sub, sessionId: decoded.sid }).catch(() => undefined);
      throw new UnauthorizedException('Invalid login session');
    }

    const { tokens, accessJti, refreshJti } = await this.signPair({ user, sessionId: decoded.sid, issuer });
    const result = await this.cache.compareAndSetHash({
      key: RedisKeys.session(user.id, decoded.sid),
      field: 'refreshJti',
      expected: decoded.jti,
      values: { accessJti, refreshJti, lastUsedAt: new Date().toISOString() },
      ttl: this.refreshTokenExpiresIn,
    });

    if (result === 'mismatch') {
      this.logger.warn(`Refresh token reuse detected for user ${user.id}, session ${decoded.sid}; revoking session`);
      await this.revokeSession({ userId: user.id, sessionId: decoded.sid });
    }
    if (result !== 'updated') {
      throw new UnauthorizedException('Refresh token already used or session ended');
    }

    await this.cache.expireCache({ key: RedisKeys.userSessions(user.id), seconds: this.refreshTokenExpiresIn });
    return tokens;
  }

  async listSessions({ userId, currentSessionId }: { userId: string; currentSessionId?: string }): Promise<SessionView[]> {
    const ids = await this.cache.getSetMembers({ key: RedisKeys.userSessions(userId) });
    const hashes = await Promise.all(ids.map((id) => this.cache.getHash({ key: RedisKeys.session(userId, id) })));

    const expired = ids.filter((_, i) => !hashes[i]);
    if (expired.length) {
      await this.cache.removeFromSet({ key: RedisKeys.userSessions(userId), members: expired });
    }

    return ids
      .flatMap((id, i) => {
        const hash = hashes[i];
        if (!hash) return [];
        return [
          {
            id,
            ip: hash.ip || null,
            userAgent: hash.userAgent || null,
            createdAt: hash.createdAt,
            lastUsedAt: hash.lastUsedAt,
            current: id === currentSessionId,
          },
        ];
      })
      .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  }

  /** Ends one session. The key includes the userId, so a user can only revoke their own sessions. */
  async revokeSession({ userId, sessionId }: { userId: string; sessionId: string }): Promise<boolean> {
    const [deleted] = await Promise.all([
      this.cache.deleteCache({ key: RedisKeys.session(userId, sessionId) }),
      this.cache.removeFromSet({ key: RedisKeys.userSessions(userId), members: [sessionId] }),
    ]);
    return deleted > 0;
  }

  async revokeSessionOrThrow({ userId, sessionId }: { userId: string; sessionId: string }): Promise<void> {
    if (!(await this.revokeSession({ userId, sessionId }))) {
      throw new NotFoundException('Session not found');
    }
  }

  /** Ends every session of the user, optionally keeping one (e.g. the current device). Returns the ended session ids. */
  async revokeAllSessions({ userId, exceptSessionId }: { userId: string; exceptSessionId?: string }): Promise<string[]> {
    const ids = (await this.cache.getSetMembers({ key: RedisKeys.userSessions(userId) })).filter((id) => id !== exceptSessionId);
    if (!ids.length) return [];

    await Promise.all([
      this.cache.deleteMany({ keys: ids.map((id) => RedisKeys.session(userId, id)) }),
      this.cache.removeFromSet({ key: RedisKeys.userSessions(userId), members: ids }),
    ]);
    return ids;
  }
}
