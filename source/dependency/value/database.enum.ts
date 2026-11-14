// Domain enums shared by entities, DTOs and services. Values are stored as Postgres enums.

export enum SortOrderEnum {
  ASC = 'asc',
  DESC = 'desc',
}

// ─── Catalog ────────────────────────────────────────────────────────────────
export enum WatchStatusEnum {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum WatchGenderEnum {
  MEN = 'men',
  WOMEN = 'women',
  UNISEX = 'unisex',
}

export enum WatchMovementEnum {
  AUTOMATIC = 'automatic',
  MANUAL = 'manual',
  QUARTZ = 'quartz',
  SOLAR = 'solar',
  KINETIC = 'kinetic',
  SMART = 'smart',
}

export enum WatchDisplayEnum {
  ANALOG = 'analog',
  DIGITAL = 'digital',
  HYBRID = 'hybrid',
}

// ─── Inventory ──────────────────────────────────────────────────────────────
export enum InventoryMovementTypeEnum {
  RESTOCK = 'restock',
  ADJUSTMENT = 'adjustment',
  RESERVE = 'reserve',
  RELEASE = 'release',
  SALE = 'sale',
  RETURN = 'return',
}

// ─── Coupons ────────────────────────────────────────────────────────────────
export enum DiscountTypeEnum {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
}

export enum CouponUsageStatusEnum {
  RESERVED = 'reserved',
  CONFIRMED = 'confirmed',
  RELEASED = 'released',
}

// ─── Orders & payments ──────────────────────────────────────────────────────
export enum OrderStatusEnum {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURN_REQUESTED = 'return_requested',
  RETURNED = 'returned',
}

export enum PaymentStatusEnum {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

// ─── Shipping ───────────────────────────────────────────────────────────────
export enum ShipmentStatusEnum {
  PENDING = 'pending',
  READY_FOR_PICKUP = 'ready_for_pickup',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETURNED = 'returned',
}

// ─── Reviews & notifications ────────────────────────────────────────────────
export enum ReviewStatusEnum {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum NotificationTypeEnum {
  ORDER = 'order',
  PAYMENT = 'payment',
  SHIPMENT = 'shipment',
  REVIEW = 'review',
  PRICE = 'price',
  INVENTORY = 'inventory',
  SYSTEM = 'system',
}
