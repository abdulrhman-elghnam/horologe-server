import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ENTITIES } from '../../database/model/entities.js';
import {
  AddressRepository,
  AuditLogRepository,
  BrandRepository,
  CartItemRepository,
  CartRepository,
  CategoryRepository,
  CollectionRepository,
  CompareRepository,
  CouponRepository,
  CouponUsageRepository,
  InventoryMovementRepository,
  InventoryRepository,
  NotificationRepository,
  OrderItemRepository,
  OrderRepository,
  PaymentRepository,
  ReviewRepository,
  ShipmentRepository,
  ShippingMethodRepository,
  UserRepository,
  WatchImageRepository,
  WatchRepository,
  WatchVariantRepository,
  WebhookEventRepository,
  WishlistRepository,
} from '../../database/repository/_INDEX.js';

const REPOSITORIES = [
  UserRepository,
  AddressRepository,
  BrandRepository,
  CategoryRepository,
  CollectionRepository,
  WatchRepository,
  WatchImageRepository,
  WatchVariantRepository,
  InventoryRepository,
  InventoryMovementRepository,
  CartRepository,
  CartItemRepository,
  WishlistRepository,
  CompareRepository,
  CouponRepository,
  CouponUsageRepository,
  OrderRepository,
  OrderItemRepository,
  PaymentRepository,
  WebhookEventRepository,
  ShippingMethodRepository,
  ShipmentRepository,
  ReviewRepository,
  NotificationRepository,
  AuditLogRepository,
];

/** Global data-access layer: every feature module can inject any repository. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  providers: REPOSITORIES,
  exports: [TypeOrmModule, ...REPOSITORIES],
})
export class RepositoryModule {}
