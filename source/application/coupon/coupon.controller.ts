import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CouponService } from './coupon.service.js';
import { CouponQueryDto, CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto/coupon.dto.js';
import { AdminOnly, Auth, Audit, CurrentUser } from '../../dependency/decorator/_INDEX.js';

@Auth()
@ApiTags('Coupons')
@Controller('coupons')
export class CouponController {
  constructor(private readonly coupons: CouponService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  validate(@CurrentUser('id') userId: string, @Body() { code }: ValidateCouponDto) {
    return this.coupons.validateForCart(userId, code);
  }
}

@AdminOnly()
@ApiTags('Admin · Coupons')
@Controller('admin/coupons')
export class AdminCouponController {
  constructor(private readonly coupons: CouponService) {}

  @Get()
  list(@Query() query: CouponQueryDto) {
    return this.coupons.list(query);
  }

  @Get(':couponId')
  get(@Param('couponId', ParseUUIDPipe) couponId: string) {
    return this.coupons.get(couponId);
  }

  @Audit('coupon.create', 'coupon')
  @Post()
  create(@Body() body: CreateCouponDto) {
    return this.coupons.create(body);
  }

  @Audit('coupon.update', 'coupon', 'couponId')
  @Patch(':couponId')
  update(@Param('couponId', ParseUUIDPipe) couponId: string, @Body() body: UpdateCouponDto) {
    return this.coupons.update(couponId, body);
  }

  @Audit('coupon.activate', 'coupon', 'couponId')
  @Patch(':couponId/activate')
  activate(@Param('couponId', ParseUUIDPipe) couponId: string) {
    return this.coupons.setActive(couponId, true);
  }

  @Audit('coupon.deactivate', 'coupon', 'couponId')
  @Patch(':couponId/deactivate')
  deactivate(@Param('couponId', ParseUUIDPipe) couponId: string) {
    return this.coupons.setActive(couponId, false);
  }

  @Get(':couponId/usages')
  usages(@Param('couponId', ParseUUIDPipe) couponId: string, @Query() query: CouponQueryDto) {
    return this.coupons.usagesOf(couponId, query);
  }

  @Audit('coupon.delete', 'coupon', 'couponId')
  @Delete(':couponId')
  @HttpCode(HttpStatus.OK)
  remove(@Param('couponId', ParseUUIDPipe) couponId: string) {
    return this.coupons.remove(couponId);
  }
}
