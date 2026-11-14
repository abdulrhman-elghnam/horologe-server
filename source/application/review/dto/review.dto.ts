import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../dependency/dto/pagination.dto.js';
import { Int, OptionalText } from '../../../dependency/dto/validators.js';
import { ReviewStatusEnum } from '../../../dependency/value/database.enum.js';

export class CreateReviewDto {
  @Int(1, 5)
  rating!: number;

  @OptionalText(120)
  title?: string;

  @OptionalText(3000)
  comment?: string;
}

export class UpdateReviewDto extends PartialType(CreateReviewDto) {}

export class ReviewQueryDto extends PaginationQueryDto {}

export class AdminReviewQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ReviewStatusEnum)
  status?: ReviewStatusEnum;

  @IsOptional()
  @IsUUID()
  watchId?: string;
}
