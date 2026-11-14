import { Module } from '@nestjs/common';

import { ShippingMethodSeeder } from './shipping-method.seeder.js';
import { ShippingController } from './shipping.controller.js';
import { ShippingService } from './shipping.service.js';
import { CartModule } from '../cart/cart.module.js';

@Module({
  imports: [CartModule],
  controllers: [ShippingController],
  providers: [ShippingService, ShippingMethodSeeder],
  exports: [ShippingService],
})
export class ShippingModule {}
