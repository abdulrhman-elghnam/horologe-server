import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, Matches } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

import { PaginationQueryDto } from '../../../dependency/dto/pagination.dto.js';
import { OptionalText, RequiredText, toBoolean, trim } from '../../../dependency/dto/validators.js';
import { SystemRoleEnum } from '../../../dependency/value/security.enum.js';

const PHONE = /^\+?[0-9\s-]{7,20}$/;

export class UpdateProfileDto {
  @OptionalText(120)
  name?: string;

  @OptionalText(120)
  city?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(PHONE, { message: 'phone must be a valid phone number' })
  phone?: string;

  @IsOptional()
  @IsIn(['en', 'ar'])
  language?: 'en' | 'ar';
}

export class CreateAddressDto {
  @RequiredText(120)
  recipientName!: string;

  @Transform(trim)
  @Matches(PHONE, { message: 'phone must be a valid phone number' })
  phone!: string;

  @RequiredText(80)
  country!: string;

  @RequiredText(120)
  city!: string;

  @RequiredText(200)
  street!: string;

  @OptionalText(80)
  building?: string;

  @OptionalText(80)
  apartment?: string;

  @OptionalText(20)
  postalCode?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}

export class AdminUserQueryDto extends PaginationQueryDto {
  /** Matches name or email. */
  @OptionalText(120)
  search?: string;

  @IsOptional()
  @IsEnum(SystemRoleEnum)
  role?: SystemRoleEnum;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}
