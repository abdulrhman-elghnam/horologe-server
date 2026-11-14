import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsUUID, Max, Min, NotEquals } from 'class-validator';
import { Type } from 'class-transformer';

import { PaginationQueryDto } from '../../../dependency/dto/pagination.dto.js';
import { Int, OptionalText, RequiredText, toBoolean } from '../../../dependency/dto/validators.js';
import { InventoryMovementTypeEnum } from '../../../dependency/value/database.enum.js';

export class InventoryQueryDto extends PaginationQueryDto {
  /** Matches SKU or watch name. */
  @OptionalText(120)
  search?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  lowStockOnly?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  outOfStockOnly?: boolean;
}

export class MovementQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(InventoryMovementTypeEnum)
  type?: InventoryMovementTypeEnum;
}

/** Manual stock change by an admin. Positive adds units, negative removes them. */
export class StockAdjustmentDto {
  @IsUUID()
  variantId!: string;

  @Type(() => Number)
  @IsInt()
  @NotEquals(0)
  @Min(-100_000)
  @Max(100_000)
  quantity!: number;

  @IsIn([InventoryMovementTypeEnum.RESTOCK, InventoryMovementTypeEnum.ADJUSTMENT])
  type!: InventoryMovementTypeEnum.RESTOCK | InventoryMovementTypeEnum.ADJUSTMENT;

  @RequiredText(300)
  reason!: string;
}

export class ThresholdDto {
  @Int(0, 100_000)
  lowStockThreshold!: number;
}
