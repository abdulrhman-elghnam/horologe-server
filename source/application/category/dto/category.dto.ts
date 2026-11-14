import { IsBoolean, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

import { OptionalText, RequiredText } from '../../../dependency/dto/validators.js';

export class CreateCategoryDto {
  @RequiredText(120)
  name!: string;

  /** null or omitted = top-level category. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  parentId?: string | null;

  @OptionalText(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
