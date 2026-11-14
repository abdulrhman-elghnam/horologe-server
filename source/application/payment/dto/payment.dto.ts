import { IsOptional, IsUUID, Matches } from 'class-validator';

import { OptionalText } from '../../../dependency/dto/validators.js';

export class InitializePaymentDto {
  @IsUUID()
  orderId!: string;

  /** Payment provider; defaults to PAYMENT_PROVIDER. */
  @IsOptional()
  @Matches(/^[a-z0-9_-]{2,40}$/)
  provider?: string;
}

export class RefundPaymentDto {
  @OptionalText(300)
  reason?: string;
}
