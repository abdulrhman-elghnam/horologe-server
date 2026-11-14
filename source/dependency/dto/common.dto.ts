import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional } from 'class-validator';

import { RequiredText, toBoolean } from './validators.js';

/** Body of every `PATCH …/status` route that toggles isActive. */
export class StatusDto {
  @Transform(toBoolean)
  @IsBoolean()
  isActive!: boolean;
}

export class ReasonDto {
  @RequiredText(500)
  reason!: string;
}

/** `?from=2026-01-01&to=2026-02-01` */
export class DateRangeQueryDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}
