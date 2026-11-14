import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEmail, IsIn, IsOptional, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

import { DateRangeQueryDto } from '../../../dependency/dto/common.dto.js';
import { PaginationQueryDto } from '../../../dependency/dto/pagination.dto.js';
import { OptionalInt, OptionalText, RequiredText, toBoolean, trim } from '../../../dependency/dto/validators.js';

export const REPORT_GROUPS = ['day', 'week', 'month'] as const;

export class ReportQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsIn(REPORT_GROUPS)
  groupBy?: (typeof REPORT_GROUPS)[number];

  /** Rows in "top N" lists. */
  @OptionalInt(1, 100)
  limit?: number;
}

export class CreateAdminDto {
  @RequiredText(120)
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** At least 12 characters with letters and numbers: admin accounts get a stronger rule. */
  @MinLength(12)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, { message: 'password must contain at least one letter and one number' })
  password!: string;

  @RequiredText(120)
  city!: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^\+?[0-9\s-]{7,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string;
}

export class UpdateAdminDto {
  @OptionalText(120)
  name?: string;

  @OptionalText(120)
  city?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^\+?[0-9\s-]{7,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string;
}

export class AdminListQueryDto extends PaginationQueryDto {
  @OptionalText(120)
  search?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}

export class AuditLogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  adminId?: string;

  @OptionalText(80)
  action?: string;

  @OptionalText(60)
  resource?: string;

  @OptionalText(100)
  resourceId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}
