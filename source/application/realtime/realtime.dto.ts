import { IsUUID } from 'class-validator';

export class OrderRoomDto {
  @IsUUID()
  orderId!: string;
}

export class WatchRoomDto {
  @IsUUID()
  watchId!: string;
}
