import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUrl } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

import { PaginationQueryDto } from '../../../dependency/dto/pagination.dto.js';
import { OptionalText, RequiredText, toBoolean } from '../../../dependency/dto/validators.js';

export class CreateBrandDto {
  @RequiredText(120)
  name!: string;

  @OptionalText(2000)
  description?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  logo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBrandDto extends PartialType(CreateBrandDto) {}

export class BrandQueryDto extends PaginationQueryDto {
  @OptionalText(120)
  search?: string;
}

export class AdminBrandQueryDto extends BrandQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}
