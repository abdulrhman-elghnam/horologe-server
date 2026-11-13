import { Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service.js';
import { RealtimeGateway } from './realtime.gateway.js';

@Module({
  providers: [RealtimeGateway, RealtimeService],
})
export class RealtimeModule {}
