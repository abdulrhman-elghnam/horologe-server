import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsDate, IsOptional, IsUUID } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

import { OptionalText, RequiredText } from '../../../dependency/dto/validators.js';

export class CreateCollectionDto {
  @RequiredText(120)
  name!: string;

  @OptionalText(2000)
  description?: string;

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
  isActive?: boolean;
}

export class UpdateCollectionDto extends PartialType(CreateCollectionDto) {}

export class AddCollectionWatchesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  watchIds!: string[];
}
