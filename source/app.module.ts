import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { minutes, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthenticationModule } from './application/authentication/authentication.module.js';
import { RealtimeModule } from './application/realtime.module.js';
import { CacheModule, ConfigurationModule, DatabaseModule, RepositoryModule, SecurityModule } from './dependency/module/_INDEX.js';

@Module({
  imports: [
    ConfigurationModule,
    DatabaseModule,
    RepositoryModule,
    CacheModule,
    SecurityModule,
    ThrottlerModule.forRoot([{ ttl: minutes(1), limit: 100 }]),
    AuthenticationModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
