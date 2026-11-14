import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDate, IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';

import { PaginationQueryDto } from '../../../dependency/dto/pagination.dto.js';
import { Money, OptionalInt, OptionalMoney, OptionalText, toBoolean, trimUpper } from '../../../dependency/dto/validators.js';
import { DiscountTypeEnum } from '../../../dependency/value/database.enum.js';

const CODE = /^[A-Z0-9_-]{3,40}$/;

export class ValidateCouponDto {
  @Transform(trimUpper)
  @Matches(CODE, { message: 'code must be 3-40 letters, numbers, dashes or underscores' })
  code!: string;
}

export class CreateCouponDto extends ValidateCouponDto {
  @OptionalText(300)
  description?: string;

  @IsEnum(DiscountTypeEnum)
  discountType!: DiscountTypeEnum;

  /** Percent (1-100) for `percentage`, amount for `fixed_amount`. */
  @Money()
  discountValue!: number;

  @OptionalMoney()
  minOrderAmount?: number;

  @OptionalMoney()
  maxDiscount?: number;

  @OptionalInt(1, 10_000_000)
  usageLimit?: number;

  @OptionalInt(1, 1_000)
  perUserLimit?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @IsBoolean()
  firstOrderOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  eligibleWatchIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  eligibleCategoryIds?: string[];
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

export class CouponQueryDto extends PaginationQueryDto {
  @OptionalText(40)
  search?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}
