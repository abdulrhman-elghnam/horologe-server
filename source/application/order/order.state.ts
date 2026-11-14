import { OrderStatusEnum as S } from '../../dependency/value/database.enum.js';
import { RealtimeEvent, type RealtimeEventName } from '../realtime/realtime.event.js';

/**
 * Order state machine. Every status change in the app goes through `canTransition`.
 *
 *   PENDING ──pay──▶ CONFIRMED ─▶ PROCESSING ─▶ SHIPPED ─▶ DELIVERED ─▶ RETURN_REQUESTED ─▶ RETURNED
 *      │                 │            │                        │               │
 *      └──── CANCELLED ◀─┴────────────┘                        └─▶ RETURNED    └─▶ DELIVERED (return rejected)
 */
const TRANSITIONS: Record<S, S[]> = {
  [S.PENDING]: [S.CONFIRMED, S.CANCELLED],
  [S.CONFIRMED]: [S.PROCESSING, S.CANCELLED],
  [S.PROCESSING]: [S.SHIPPED, S.CANCELLED],
  [S.SHIPPED]: [S.DELIVERED],
  [S.DELIVERED]: [S.RETURN_REQUESTED, S.RETURNED],
  [S.RETURN_REQUESTED]: [S.RETURNED, S.DELIVERED],
  [S.CANCELLED]: [],
  [S.RETURNED]: [],
};

export const canTransition = (from: S, to: S): boolean => TRANSITIONS[from].includes(to);

/** Statuses an admin may set through PATCH /admin/orders/:id/status (CONFIRMED comes only from a payment). */
export const ADMIN_SETTABLE = [S.PROCESSING, S.SHIPPED, S.DELIVERED, S.RETURNED] as const;

/** Customers may cancel until the order is being prepared. */
export const CUSTOMER_CANCELLABLE = new Set<S>([S.PENDING, S.CONFIRMED]);

/** Specific socket event for each status (order:status-updated is always sent as well). */
export const STATUS_EVENT: Partial<Record<S, RealtimeEventName>> = {
  [S.CONFIRMED]: RealtimeEvent.ORDER_CONFIRMED,
  [S.PROCESSING]: RealtimeEvent.ORDER_PROCESSING,
  [S.SHIPPED]: RealtimeEvent.ORDER_SHIPPED,
  [S.DELIVERED]: RealtimeEvent.ORDER_DELIVERED,
  [S.CANCELLED]: RealtimeEvent.ORDER_CANCELLED,
};

/** Customer-facing notification text per status. */
export const STATUS_MESSAGE: Record<S, (orderNumber: string) => { title: string; message: string }> = {
  [S.PENDING]: (n) => ({ title: 'Order placed', message: `Order ${n} was placed. Complete the payment to confirm it.` }),
  [S.CONFIRMED]: (n) => ({ title: 'Order confirmed', message: `Payment received. Order ${n} is confirmed.` }),
  [S.PROCESSING]: (n) => ({ title: 'Order in preparation', message: `We are preparing order ${n}.` }),
  [S.SHIPPED]: (n) => ({ title: 'Order shipped', message: `Order ${n} is on its way.` }),
  [S.DELIVERED]: (n) => ({ title: 'Order delivered', message: `Order ${n} was delivered. Enjoy your watch!` }),
  [S.CANCELLED]: (n) => ({ title: 'Order cancelled', message: `Order ${n} was cancelled.` }),
  [S.RETURN_REQUESTED]: (n) => ({ title: 'Return requested', message: `We received your return request for order ${n}.` }),
  [S.RETURNED]: (n) => ({ title: 'Return completed', message: `The return of order ${n} is complete.` }),
};
