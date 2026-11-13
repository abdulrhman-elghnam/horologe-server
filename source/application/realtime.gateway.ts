import { WebSocketGateway, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { RealtimeService } from './realtime.service.js';

@WebSocketGateway()
export class RealtimeGateway {
  constructor(private readonly realtimeService: RealtimeService) {}

  // @SubscribeMessage('createRealtime')
  // create(@MessageBody() createRealtimeDto: CreateRealtimeDto) {
  //   return this.realtimeService.create(createRealtimeDto);
  // }
}
