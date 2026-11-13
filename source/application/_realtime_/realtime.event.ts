export const RealtimeEvent = {
  READY: 'realtime:ready',
  ERROR: 'realtime:error',
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',
  NOTIFICATION_COUNT_UPDATED: 'notification:count-updated',
} as const;

export const RealtimeRoom = {
  user: (userId: string) => `user:${userId}`,
  admins: 'admins',
  admin: (adminId: string) => `admin:${adminId}`,
  order: (orderId: string) => `order:${orderId}`,
  watch: (watchId: string) => `watch:${watchId}`,
  session: (sessionId: string) => `session:${sessionId}`,
} as const;
