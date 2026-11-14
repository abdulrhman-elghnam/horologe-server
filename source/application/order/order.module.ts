import { Module } from '@nestjs/common';

import { CheckoutService } from './checkout.service.js';
import { OrderExpiryService } from './order-expiry.service.js';
import { OrderLifecycleService } from './order-lifecycle.service.js';
import { AdminOrderController, OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';
import { CartModule } from '../cart/cart.module.js';
import { CouponModule } from '../coupon/coupon.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { ShippingModule } from '../shipping/shipping.module.js';

@Module({
  imports: [CartModule, CouponModule, InventoryModule, NotificationModule, ShippingModule],
  controllers: [OrderController, AdminOrderController],
  providers: [CheckoutService, OrderService, OrderLifecycleService, OrderExpiryService],
  exports: [OrderLifecycleService],
})
export class OrderModule {}
