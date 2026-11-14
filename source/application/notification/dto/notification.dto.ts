import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../dependency/dto/pagination.dto.js';
import { toBoolean } from '../../../dependency/dto/validators.js';
import { NotificationTypeEnum } from '../../../dependency/value/database.enum.js';

export class NotificationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @IsEnum(NotificationTypeEnum)
  type?: NotificationTypeEnum;
}
