import { Global, Module } from '@nestjs/common';

import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimeService } from './realtime.service.js';

/** Global: any feature can push live events through RealtimeService. */
@Global()
@Module({
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
