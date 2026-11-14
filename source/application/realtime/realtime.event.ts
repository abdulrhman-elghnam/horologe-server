/** Every Socket.IO event name on the `/realtime` namespace. */
export const RealtimeEvent = {
  // Connection
  READY: 'realtime:ready',
  ERROR: 'realtime:error',

  // Client -> server
  ORDER_SUBSCRIBE: 'order:subscribe',
  ORDER_UNSUBSCRIBE: 'order:unsubscribe',
  INVENTORY_SUBSCRIBE: 'inventory:subscribe',
  INVENTORY_UNSUBSCRIBE: 'inventory:unsubscribe',
  WATCH_SUBSCRIBE: 'watch:subscribe',
  WATCH_UNSUBSCRIBE: 'watch:unsubscribe',

  // Orders
  ORDER_CREATED: 'order:created',
  ORDER_CONFIRMED: 'order:confirmed',
  ORDER_PROCESSING: 'order:processing',
  ORDER_SHIPPED: 'order:shipped',
  ORDER_DELIVERED: 'order:delivered',
  ORDER_CANCELLED: 'order:cancelled',
  ORDER_STATUS_UPDATED: 'order:status-updated',

  // Payments
  PAYMENT_PENDING: 'payment:pending',
  PAYMENT_SUCCEEDED: 'payment:succeeded',
  PAYMENT_FAILED: 'payment:failed',
  PAYMENT_REFUNDED: 'payment:refunded',

  // Shipments
  SHIPMENT_CREATED: 'shipment:created',
  SHIPMENT_STATUS_UPDATED: 'shipment:status-updated',
  SHIPMENT_DELIVERED: 'shipment:delivered',

  // Inventory
  INVENTORY_UPDATED: 'inventory:updated',
  INVENTORY_LOW_STOCK: 'inventory:low-stock',
  INVENTORY_OUT_OF_STOCK: 'inventory:out-of-stock',
  INVENTORY_BACK_IN_STOCK: 'inventory:back-in-stock',

  // Watches
  WATCH_PRICE_UPDATED: 'watch:price-updated',
  WATCH_PRICE_DROPPED: 'watch:price-dropped',

  // Notifications
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',
  NOTIFICATION_COUNT_UPDATED: 'notification:count-updated',

  // Admin room
  ADMIN_ORDER_NEW: 'admin:order:new',
  ADMIN_ORDER_UPDATED: 'admin:order:updated',
  ADMIN_PAYMENT_FAILED: 'admin:payment:failed',
  ADMIN_INVENTORY_LOW_STOCK: 'admin:inventory:low-stock',
  ADMIN_REVIEW_NEW: 'admin:review:new',
  ADMIN_CUSTOMER_NEW: 'admin:customer:new',
} as const;

export type RealtimeEventName = (typeof RealtimeEvent)[keyof typeof RealtimeEvent];

export const RealtimeRoom = {
  user: (userId: string) => `user:${userId}`,
  admins: 'admins',
  admin: (adminId: string) => `admin:${adminId}`,
  order: (orderId: string) => `order:${orderId}`,
  watch: (watchId: string) => `watch:${watchId}`,
  /** Admins who opted in to live stock updates. */
  inventory: 'inventory',
  session: (sessionId: string) => `session:${sessionId}`,
} as const;
