import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { RealtimeModule } from './application/realtime.module.js';
import { ConfigurationModule, DatabaseModule, RepositoryModule } from './dependency/module/_INDEX.js';

@Module({
  imports: [
    ConfigurationModule,
    DatabaseModule,
    RepositoryModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
