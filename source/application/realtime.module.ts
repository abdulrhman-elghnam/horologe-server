import { Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service.js';
import { RealtimeGateway } from './realtime.gateway.js';
import { UserModule } from './user/user.module.js';

@Module({
  providers: [RealtimeGateway, RealtimeService],
  imports: [UserModule],
  exports: [RealtimeService],
})
export class RealtimeModule {}
