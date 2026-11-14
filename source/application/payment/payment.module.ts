import { Module } from '@nestjs/common';

import { AdminPaymentController, PaymentController } from './payment.controller.js';
import { PaymentService } from './payment.service.js';
import { NotificationModule } from '../notification/notification.module.js';
import { OrderModule } from '../order/order.module.js';
import { ShipmentModule } from '../shipment/shipment.module.js';

@Module({
  imports: [OrderModule, ShipmentModule, NotificationModule],
  controllers: [PaymentController, AdminPaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
