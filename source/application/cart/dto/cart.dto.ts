import { IsUUID } from 'class-validator';

import { Int } from '../../../dependency/dto/validators.js';

export const MAX_QUANTITY_PER_ITEM = 10;

export class AddCartItemDto {
  @IsUUID()
  variantId!: string;

  @Int(1, MAX_QUANTITY_PER_ITEM)
  quantity!: number;
}

export class UpdateCartItemDto {
  @Int(1, MAX_QUANTITY_PER_ITEM)
  quantity!: number;
}
