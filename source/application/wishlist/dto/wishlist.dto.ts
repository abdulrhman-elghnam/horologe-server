import { IsUUID } from 'class-validator';

/** Body of POST /wishlist/items and POST /compare/items. */
export class WatchIdDto {
  @IsUUID()
  watchId!: string;
}
