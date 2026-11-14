import { Module } from '@nestjs/common';

import { AdminShipmentController, ShipmentController } from './shipment.controller.js';
import { ShipmentService } from './shipment.service.js';
import { NotificationModule } from '../notification/notification.module.js';
import { OrderModule } from '../order/order.module.js';
import { ShippingModule } from '../shipping/shipping.module.js';

@Module({
  imports: [OrderModule, ShippingModule, NotificationModule],
  controllers: [ShipmentController, AdminShipmentController],
  providers: [ShipmentService],
  exports: [ShipmentService],
})
export class ShipmentModule {}
