import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis, type RedisOptions } from 'ioredis';

import { CacheService, REDIS_CLIENT } from '../service/cache.service.js';

const logger = new Logger('Redis');

const createRedisClient = (config: ConfigService): Redis => {
  const options: RedisOptions = {
    connectionName: 'horologe-server',
    maxRetriesPerRequest: 3,
    retryStrategy: (attempt) => Math.min(attempt * 200, 5_000),
    enableAutoPipelining: true,
  };

  const uri = config.get<string>('redis.uri');
  const client = uri
    ? new Redis(uri, options)
    : new Redis({ ...options, host: config.get<string>('redis.host', '127.0.0.1'), port: config.get<number>('redis.port', 6379) });
  client.on('error', (error) => logger.error(error.message));
  client.on('ready', () => logger.log('Connected'));
  client.on('reconnecting', (delay: number) => logger.warn(`Reconnecting in ${delay}ms`));

  return client;
};

@Global()
@Module({
  providers: [{ provide: REDIS_CLIENT, inject: [ConfigService], useFactory: createRedisClient }, CacheService],
  exports: [REDIS_CLIENT, CacheService],
})
export class CacheModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
