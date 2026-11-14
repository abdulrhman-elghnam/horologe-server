import { IsEnum, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../dependency/dto/pagination.dto.js';
import { OptionalText } from '../../../dependency/dto/validators.js';
import { ShipmentStatusEnum } from '../../../dependency/value/database.enum.js';

export class CalculateShippingDto {
  @IsUUID()
  addressId!: string;

  @IsUUID()
  shippingMethodId!: string;
}

export class CreateShipmentDto {
  @IsUUID()
  orderId!: string;

  /** Defaults to the order's shipping method. */
  @IsOptional()
  @IsUUID()
  shippingMethodId?: string;

  /** Set when the parcel was booked outside the carrier integration. */
  @OptionalText(80)
  trackingNumber?: string;

  @OptionalText(60)
  carrier?: string;
}

export class ShipmentStatusDto {
  @IsEnum(ShipmentStatusEnum)
  status!: ShipmentStatusEnum;

  @OptionalText(300)
  note?: string;

  @OptionalText(120)
  location?: string;
}

export class ShipmentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ShipmentStatusEnum)
  status?: ShipmentStatusEnum;

  /** Tracking number or order number. */
  @OptionalText(80)
  search?: string;
}
