import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';

import { CacheService } from './dependency/service/cache.service.js';

@SkipThrottle()
@ApiTags('System')
@Controller()
export class AppController {
  constructor(
    private readonly db: DataSource,
    private readonly cache: CacheService,
  ) {}

  /** Liveness/readiness: Postgres and Redis must both answer. */
  @Get('health')
  async health() {
    const [database, redis] = await Promise.all([
      this.db.query('SELECT 1').then(
        () => true,
        () => false,
      ),
      this.cache.ping().catch(() => false),
    ]);
    if (!database || !redis) throw new ServiceUnavailableException({ message: 'Service unavailable', database, redis });
    return { status: 'ok', database, redis };
  }
}
