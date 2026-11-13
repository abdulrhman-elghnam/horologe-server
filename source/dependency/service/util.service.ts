import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { Socket } from 'socket.io';
import { IAuthReq } from '../interface/ctx.interface.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_PATTERN.test(value);


export const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { driverError?: { code?: string } }).driverError?.code === '23505';

export const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class UtilService {

  constructor(
    private readonly configService: ConfigService
  ) {}

  isUuid = isUuid;

  assertUuid = (id: unknown, label = 'id'): string => {
    if (!isUuid(id)) {
      throw new BadRequestException(`Invalid ${label}`);
    }
    return id;
  };

  generateSlug = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9؀-ۿ]+/g, '-')
      .replace(/^-+|-+$/g, '');

  createNumberOtp = (): number => randomInt(100_000, 1_000_000);

  createReferenceCode = (prefix: string, length = 6): string => {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
    }
    return `${prefix}-${code}`;
  };

  getAuthSocket = (client: Socket): string | undefined => {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    const fromAuth = auth?.authorization ?? auth?.token;
    return (typeof fromAuth === 'string' ? fromAuth : undefined) || client.handshake.headers.authorization;
  };

  frontendUrl(path = ''): string {
    const base = this.configService.get<string>('app.frontendUrl', 'http://localhost:3000').replace(/\/$/, '');
    return `${base}${path}`;
  }

  issuer(request: IAuthReq): string {
    const configuredIssuer = this.configService.get<string>('auth.issuer');
    if (configuredIssuer) {
      return configuredIssuer;
    }

    const host = request.get('host');
    if (!host) {
      throw new BadRequestException('Could not determine token issuer');
    }
    return `${request.protocol}://${host}`;
  }
}
