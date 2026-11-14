import { Address } from './address.model.js';
import { AuditLog } from './audit-log.model.js';
import { Brand } from './brand.model.js';
import { Cart, CartItem } from './cart.model.js';
import { Category } from './category.model.js';
import { Collection } from './collection.model.js';
import { Coupon, CouponUsage } from './coupon.model.js';
import { Inventory } from './inventory.model.js';
import { InventoryMovement } from './inventory-movement.model.js';
import { Notification } from './notification.model.js';
import { Order, OrderItem } from './order.model.js';
import { Payment } from './payment.model.js';
import { Review } from './review.model.js';
import { CompareItem, WishlistItem } from './saved-watch.model.js';
import { Shipment } from './shipment.model.js';
import { ShippingMethod } from './shipping-method.model.js';
import { User } from './user.model.js';
import { Watch } from './watch.model.js';
import { WatchImage } from './watch-image.model.js';
import { WatchVariant } from './watch-variant.model.js';
import { WebhookEvent } from './webhook-event.model.js';

/** Every TypeORM entity. Used by the Nest TypeORM module and the CLI data source. */
export const ENTITIES = [
  User,
  Address,
  Brand,
  Category,
  Collection,
  Watch,
  WatchImage,
  WatchVariant,
  Inventory,
  InventoryMovement,
  Cart,
  CartItem,
  WishlistItem,
  CompareItem,
  Coupon,
  CouponUsage,
  Order,
  OrderItem,
  Payment,
  WebhookEvent,
  ShippingMethod,
  Shipment,
  Review,
  Notification,
  AuditLog,
];
