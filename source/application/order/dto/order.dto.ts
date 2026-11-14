import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsIn, IsOptional, IsUUID, Matches } from 'class-validator';

import { ADMIN_SETTABLE } from '../order.state.js';
import { PaginationQueryDto } from '../../../dependency/dto/pagination.dto.js';
import { OptionalText, RequiredText, trimUpper } from '../../../dependency/dto/validators.js';
import { OrderStatusEnum, PaymentStatusEnum } from '../../../dependency/value/database.enum.js';

export class CheckoutDto {
  @IsUUID()
  addressId!: string;

  @IsUUID()
  shippingMethodId!: string;

  @IsOptional()
  @Transform(trimUpper)
  @Matches(/^[A-Z0-9_-]{3,40}$/, { message: 'couponCode is invalid' })
  couponCode?: string;

  @OptionalText(500)
  notes?: string;
}

export class CancelOrderDto {
  @OptionalText(300)
  reason?: string;
}

export class ReturnOrderDto {
  @RequiredText(500)
  reason!: string;
}

export class OrderQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrderStatusEnum)
  status?: OrderStatusEnum;
}

export class AdminOrderQueryDto extends OrderQueryDto {
  @IsOptional()
  @IsEnum(PaymentStatusEnum)
  paymentStatus?: PaymentStatusEnum;

  @IsOptional()
  @IsUUID()
  userId?: string;

  /** Order number. */
  @OptionalText(40)
  search?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

export class UpdateOrderStatusDto {
  @IsIn(ADMIN_SETTABLE)
  status!: (typeof ADMIN_SETTABLE)[number];

  @OptionalText(300)
  note?: string;
}

export class AdminCancelOrderDto {
  @RequiredText(300)
  reason!: string;
}
