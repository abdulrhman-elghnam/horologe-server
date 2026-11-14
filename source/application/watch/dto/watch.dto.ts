import { OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsUUID, Matches, Max, Min, ValidateNested } from 'class-validator';

import { PaginationQueryDto } from '../../../dependency/dto/pagination.dto.js';
import { Money, OptionalInt, OptionalMoney, OptionalText, RequiredText } from '../../../dependency/dto/validators.js';
import { WatchDisplayEnum, WatchGenderEnum, WatchMovementEnum, WatchStatusEnum } from '../../../dependency/value/database.enum.js';

export class WatchSpecificationDto {
  @OptionalText(80)
  caseMaterial?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(10)
  @Max(70)
  caseDiameter?: number;

  @OptionalText(80)
  strapMaterial?: string;

  @OptionalText(40)
  dialColor?: string;

  @OptionalText(60)
  glassType?: string;

  @OptionalInt(0, 10_000)
  waterResistance?: number;

  @OptionalInt(0, 2_000)
  powerReserve?: number;
}

export class CreateVariantDto {
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/, { message: 'sku may contain letters, numbers, dots, dashes and underscores' })
  sku!: string;

  @OptionalText(40)
  color?: string;

  @Money()
  price!: number;

  @OptionalMoney()
  compareAtPrice?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Units on hand when the variant is created. */
  @OptionalInt(0, 100_000)
  initialStock?: number;

  @OptionalInt(0, 100_000)
  lowStockThreshold?: number;
}

/** Price changes go through PATCH …/price and status through …/status. */
export class UpdateVariantDto extends PartialType(
  OmitType(CreateVariantDto, ['price', 'compareAtPrice', 'isActive', 'initialStock', 'lowStockThreshold'] as const),
) {}

export class VariantPriceDto {
  @Money()
  price!: number;

  @OptionalMoney()
  compareAtPrice?: number;
}

export class CreateWatchDto {
  @IsUUID()
  brandId!: string;

  @RequiredText(200)
  name!: string;

  @OptionalText(120)
  model?: string;

  @OptionalText(80)
  referenceNumber?: string;

  @IsOptional()
  @IsEnum(WatchGenderEnum)
  gender?: WatchGenderEnum;

  @IsEnum(WatchMovementEnum)
  movement!: WatchMovementEnum;

  @IsOptional()
  @IsEnum(WatchDisplayEnum)
  displayType?: WatchDisplayEnum;

  @OptionalText(10_000)
  description?: string;

  @OptionalInt(0, 240)
  warrantyMonths?: number;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => WatchSpecificationDto)
  specification?: WatchSpecificationDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants?: CreateVariantDto[];
}

export class UpdateWatchDto extends PartialType(OmitType(CreateWatchDto, ['variants'] as const)) {}

export class WatchStatusDto {
  @IsEnum(WatchStatusEnum)
  status!: WatchStatusEnum;
}

export class WatchQueryDto extends PaginationQueryDto {
  @OptionalText(120)
  search?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  /** Includes direct sub-categories. */
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @IsOptional()
  @IsEnum(WatchGenderEnum)
  gender?: WatchGenderEnum;

  @IsOptional()
  @IsEnum(WatchMovementEnum)
  movement?: WatchMovementEnum;

  @OptionalMoney()
  minPrice?: number;

  @OptionalMoney()
  maxPrice?: number;
}

export class AdminWatchQueryDto extends WatchQueryDto {
  @IsOptional()
  @IsEnum(WatchStatusEnum)
  status?: WatchStatusEnum;
}

export class ImageMetaDto {
  @OptionalText(200)
  alt?: string;
}
