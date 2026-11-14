import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { seconds, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller.js';
import { AdminModule } from './application/admin/admin.module.js';
import { AuthenticationModule } from './application/authentication/authentication.module.js';
import { BrandModule } from './application/brand/brand.module.js';
import { CartModule } from './application/cart/cart.module.js';
import { CategoryModule } from './application/category/category.module.js';
import { CollectionModule } from './application/collection/collection.module.js';
import { CompareModule } from './application/compare/compare.module.js';
import { CouponModule } from './application/coupon/coupon.module.js';
import { FileModule } from './application/file/file.module.js';
import { InventoryModule } from './application/inventory/inventory.module.js';
import { NotificationModule } from './application/notification/notification.module.js';
import { OrderModule } from './application/order/order.module.js';
import { PaymentModule } from './application/payment/payment.module.js';
import { RealtimeModule } from './application/realtime/realtime.module.js';
import { ReviewModule } from './application/review/review.module.js';
import { ShipmentModule } from './application/shipment/shipment.module.js';
import { ShippingModule } from './application/shipping/shipping.module.js';
import { UserModule } from './application/user/user.module.js';
import { WatchModule } from './application/watch/watch.module.js';
import { WishlistModule } from './application/wishlist/wishlist.module.js';
import { AuditInterceptor, TransformInterceptor } from './dependency/interceptor/_INDEX.js';
import { MaintenanceMiddleware } from './dependency/middleware/maintenance-mode-middleware.js';
import { CacheModule, ConfigurationModule, DatabaseModule, RepositoryModule, SecurityModule } from './dependency/module/_INDEX.js';
import { ProviderModule } from './dependency/provider/provider.module.js';

/** Infrastructure: config, Postgres, Redis, security, payment/shipping adapters, Socket.IO. All global. */
const INFRASTRUCTURE = [
  ConfigurationModule,
  DatabaseModule,
  RepositoryModule,
  CacheModule,
  SecurityModule,
  ProviderModule,
  RealtimeModule,
  // In-memory rate limiting (Nest throttler); Redis is not used for it.
  ThrottlerModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      throttlers: [{ ttl: seconds(config.get<number>('rateLimit.ttlSeconds', 60)), limit: config.get<number>('rateLimit.limit', 100) }],
      skipIf: () => !config.get<boolean>('rateLimit.enabled', true),
    }),
  }),
];

/** Business features, one module per area of the API spec. */
const FEATURES = [
  AuthenticationModule,
  UserModule,
  BrandModule,
  CategoryModule,
  CollectionModule,
  WatchModule,
  InventoryModule,
  CartModule,
  WishlistModule,
  CompareModule,
  CouponModule,
  ShippingModule,
  OrderModule,
  ShipmentModule,
  PaymentModule,
  ReviewModule,
  NotificationModule,
  AdminModule,
  FileModule,
];

@Module({
  imports: [...INFRASTRUCTURE, ...FEATURES],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MaintenanceMiddleware).forRoutes('*');
  }
}
