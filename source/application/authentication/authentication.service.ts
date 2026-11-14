import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { IsNull } from 'typeorm';

import { UserRepository } from '../../database/repository/user.repository.js';
import type { User } from '../../database/model/user.model.js';
import {
  CacheService,
  MailService,
  RedisKeys,
  SecurityService,
  TokenService,
  UtilService,
  isUniqueViolation,
  isUuid,
  type AuthTokens,
  type SessionClient,
  type SessionView,
} from '../../dependency/service/_INDEX.js';
import { AuthProviderEnum, SystemRoleEnum } from '../../dependency/value/security.enum.js';

import type { ChangePasswordDto, EmailDto, GoogleCredentialDto, LoginDto, RegisterDto, ResetPasswordDto, VerifyEmailDto } from './dto/authentication.dto.js';
import { RealtimeEvent } from '../realtime/realtime.event.js';
import { RealtimeService } from '../realtime/realtime.service.js';

const PASSWORD_RESET_TTL_SECONDS = 15 * 60;
const EMAIL_OTP_TTL_SECONDS = 10 * 60;
const EMAIL_OTP_MAX_ATTEMPTS = 5;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

interface GoogleClaims {
  email: string;
  sub: string;
  name?: string;
}

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);

  private readonly dummyPasswordHash: Promise<string>;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly security: SecurityService,
    private readonly tokens: TokenService,
    private readonly cache: CacheService,
    private readonly util: UtilService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeService,
  ) {
    this.dummyPasswordHash = this.security.hash(randomBytes(16).toString('hex'));
  }

  async register(input: RegisterDto): Promise<{ email: string; emailVerificationRequired: true }> {
    if (await this.userRepository.emailExists(input.email)) {
      throw new ConflictException('An account with this email already exists');
    }

    let user: User;
    try {
      user = await this.userRepository.createAuthUser({
        name: input.name,
        email: input.email,
        passwordHash: await this.security.hash(input.password),
        city: input.city,
        phone: input.phone ?? null,

        role: SystemRoleEnum.CUSTOMER,
        provider: AuthProviderEnum.SYSTEM,
        emailVerifiedAt: null,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }

    await this.issueVerificationCode(user.email).catch((error: Error) => this.logger.error(`Verification email failed: ${error.message}`));
    this.realtime.emitToAdmins(RealtimeEvent.ADMIN_CUSTOMER_NEW, { userId: user.id, name: user.name, createdAt: user.createdAt });

    return { email: user.email, emailVerificationRequired: true };
  }

  async resendVerification({ email }: EmailDto): Promise<{ sent: true }> {
    const user = await this.userRepository.findByEmailWithoutPassword(email);
    if (user && !user.emailVerifiedAt && user.provider === AuthProviderEnum.SYSTEM) {
      await this.issueVerificationCode(user.email);
    }
    return { sent: true };
  }

  async verifyEmail({ email, otp }: VerifyEmailDto): Promise<{ verified: true }> {
    const codeKey = RedisKeys.emailVerification(email);
    const attemptsKey = RedisKeys.emailVerificationAttempts(email);

    const hashedCode = await this.cache.getCache<string>({ key: codeKey });
    if (!hashedCode) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const attempts = await this.cache.incrementCache({ key: attemptsKey, ttl: EMAIL_OTP_TTL_SECONDS });
    if (attempts > EMAIL_OTP_MAX_ATTEMPTS) {
      await this.cache.deleteMany({ keys: [codeKey, attemptsKey] });
      throw new HttpException('Too many incorrect codes. Request a new one', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!(await this.security.compare(otp, hashedCode))) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const user = await this.userRepository.findByEmailWithoutPassword(email);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.userRepository.updateMany({ where: { id: user.id, emailVerifiedAt: IsNull() }, data: { emailVerifiedAt: new Date() } });
    await this.cache.deleteMany({ keys: [codeKey, attemptsKey] });

    return { verified: true };
  }

  async login({ email, password }: LoginDto, issuer: string, client: SessionClient): Promise<AuthTokens> {
    const user = await this.userRepository.findByEmail(email);
    const passwordMatches = await this.security.compare(password, user?.passwordHash ?? (await this.dummyPasswordHash));

    if (!user || !user.passwordHash || user.provider !== AuthProviderEnum.SYSTEM || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new ForbiddenException('This account has been disabled');
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({ message: 'Email address is not verified', code: 'EMAIL_NOT_VERIFIED' });
    }

    return this.tokens.createSession({ user, issuer, client });
  }

  async google({ idToken, city }: GoogleCredentialDto, issuer: string, client: SessionClient): Promise<AuthTokens & { created: boolean }> {
    const claims = await this.verifyGoogleIdToken(idToken);
    const existing = await this.userRepository.findByEmailWithoutPassword(claims.email);

    if (existing) {
      if (existing.provider !== AuthProviderEnum.GOOGLE || existing.googleId !== claims.sub) {
        throw new ConflictException('This email is already registered with another sign-in method');
      }
      if (!existing.isActive) {
        throw new ForbiddenException('This account has been disabled');
      }
      return { ...(await this.tokens.createSession({ user: existing, issuer, client })), created: false };
    }

    try {
      const user = await this.userRepository.createAuthUser({
        name: claims.name?.trim() || claims.email.split('@')[0],
        email: claims.email,
        city,
        role: SystemRoleEnum.CUSTOMER,
        provider: AuthProviderEnum.GOOGLE,
        googleId: claims.sub,

        emailVerifiedAt: new Date(),
      });
      this.realtime.emitToAdmins(RealtimeEvent.ADMIN_CUSTOMER_NEW, { userId: user.id, name: user.name, createdAt: user.createdAt });
      return { ...(await this.tokens.createSession({ user, issuer, client })), created: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('An account with this email or Google account already exists');
      }
      throw error;
    }
  }

  refresh(refreshToken: string, issuer: string): Promise<AuthTokens> {
    return this.tokens.rotateRefreshToken({ token: refreshToken, issuer });
  }

  async logout(userId: string, sessionId: string): Promise<{ loggedOut: true }> {
    await this.tokens.revokeSession({ userId, sessionId });
    this.realtime.disconnectSession(sessionId);
    return { loggedOut: true };
  }

  listSessions(userId: string, currentSessionId: string): Promise<SessionView[]> {
    return this.tokens.listSessions({ userId, currentSessionId });
  }

  async revokeSession(userId: string, sessionId: string): Promise<{ revoked: true }> {
    await this.tokens.revokeSessionOrThrow({ userId, sessionId });
    this.realtime.disconnectSession(sessionId);
    return { revoked: true };
  }

  async revokeOtherSessions(userId: string, currentSessionId: string): Promise<{ revoked: number }> {
    const revoked = await this.tokens.revokeAllSessions({ userId, exceptSessionId: currentSessionId });
    revoked.forEach((id) => this.realtime.disconnectSession(id));
    return { revoked: revoked.length };
  }

  async forgotPassword({ email }: EmailDto): Promise<{ sent: true }> {
    const user = await this.userRepository.findByEmailWithoutPassword(email);
    if (!user || user.provider !== AuthProviderEnum.SYSTEM || !user.isActive) {
      return { sent: true };
    }

    const token = randomBytes(32).toString('base64url');
    const key = RedisKeys.passwordReset(sha256(token));

    await this.cache.setCache({ key, value: user.id, options: { EX: PASSWORD_RESET_TTL_SECONDS } });

    try {
      await this.mail.sendPasswordReset({
        email: user.email,
        link: this.util.frontendUrl(`/reset-password?token=${token}`),
        minutes: PASSWORD_RESET_TTL_SECONDS / 60,
      });
    } catch (error) {
      await this.cache.deleteCache({ key });
      throw error;
    }

    return { sent: true };
  }

  async resetPassword({ token, password }: ResetPasswordDto): Promise<{ reset: true }> {
    const userId = await this.cache.getAndDelete<string>({ key: RedisKeys.passwordReset(sha256(token)) });
    const user = isUuid(userId) ? await this.userRepository.findById({ id: userId }) : null;
    if (!user || user.provider !== AuthProviderEnum.SYSTEM || !user.isActive) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    await this.userRepository.updateMany({
      where: { id: user.id },
      data: {
        passwordHash: await this.security.hash(password),

        ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }),
      },
    });

    await this.tokens.revokeAllSessions({ userId: user.id });
    this.realtime.disconnectUser(user.id);
    return { reset: true };
  }

  async changePassword(
    user: User,
    sessionId: string,
    { currentPassword, newPassword }: ChangePasswordDto,
  ): Promise<{ changed: true; revokedSessions: number }> {
    const account = await this.userRepository.findByIdWithPassword(user.id);
    if (!account || account.provider !== AuthProviderEnum.SYSTEM || !account.passwordHash) {
      throw new BadRequestException('Password changes are unavailable for this sign-in method');
    }
    if (!(await this.security.compare(currentPassword, account.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const update = await this.userRepository.updateMany({
      where: { id: account.id, passwordHash: account.passwordHash },
      data: { passwordHash: await this.security.hash(newPassword) },
    });
    if (update.affected !== 1) {
      throw new ConflictException('Password changed before this request could be completed');
    }

    const revoked = await this.tokens.revokeAllSessions({ userId: account.id, exceptSessionId: sessionId });
    revoked.forEach((id) => this.realtime.disconnectSession(id));
    const revokedSessions = revoked.length;
    await this.mail
      .sendPasswordChanged({ email: account.email, name: account.name })
      .catch((error: Error) => this.logger.error(`Password-changed email failed: ${error.message}`));

    return { changed: true, revokedSessions };
  }

  private async issueVerificationCode(email: string): Promise<void> {
    const code = this.util.createNumberOtp();
    await this.cache.setCache({
      key: RedisKeys.emailVerification(email),
      value: await this.security.hash(String(code)),
      options: { EX: EMAIL_OTP_TTL_SECONDS },
    });

    await this.cache.deleteCache({ key: RedisKeys.emailVerificationAttempts(email) });
    await this.mail.sendVerificationCode({ email, code, minutes: EMAIL_OTP_TTL_SECONDS / 60 });
  }

  private async verifyGoogleIdToken(idToken: string): Promise<GoogleClaims> {
    const clientId = this.config.get<string>('google.clientId');
    if (!clientId) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }

    const endpoint = new URL('https://oauth2.googleapis.com/tokeninfo');
    endpoint.searchParams.set('id_token', idToken);

    let response: Response;
    try {
      response = await fetch(endpoint, { signal: AbortSignal.timeout(5_000) });
    } catch (error) {
      throw new ServiceUnavailableException('Google credential verification is unavailable', { cause: error });
    }
    if (!response.ok) {
      throw new UnauthorizedException('Invalid Google credential');
    }

    const claims = (await response.json()) as Record<string, unknown>;
    const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
    if (
      claims.aud !== clientId ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(String(claims.iss)) ||
      typeof claims.email !== 'string' ||
      !claims.email.trim() ||
      !emailVerified ||
      typeof claims.sub !== 'string' ||
      !claims.sub
    ) {
      throw new UnauthorizedException('Invalid Google credential');
    }

    return {
      email: claims.email.trim().toLowerCase(),
      sub: claims.sub,
      ...(typeof claims.name === 'string' ? { name: claims.name } : {}),
    };
  }
}
