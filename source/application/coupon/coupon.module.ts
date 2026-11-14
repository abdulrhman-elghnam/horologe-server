import { Module } from '@nestjs/common';

import { AdminCouponController, CouponController } from './coupon.controller.js';
import { CouponService } from './coupon.service.js';
import { CartModule } from '../cart/cart.module.js';

@Module({
  imports: [CartModule],
  controllers: [CouponController, AdminCouponController],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
