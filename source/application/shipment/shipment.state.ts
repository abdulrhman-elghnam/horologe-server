import { ShipmentStatusEnum as S } from '../../dependency/value/database.enum.js';

/** Normal progress of a parcel. A status can only move forward along this list. */
const FLOW = [S.PENDING, S.READY_FOR_PICKUP, S.PICKED_UP, S.IN_TRANSIT, S.OUT_FOR_DELIVERY, S.DELIVERED];

export const TERMINAL = new Set<S>([S.DELIVERED, S.RETURNED]);

/** Statuses that mean the parcel has left the warehouse (the order becomes SHIPPED). */
export const IN_CARRIER_HANDS = new Set<S>([S.PICKED_UP, S.IN_TRANSIT, S.OUT_FOR_DELIVERY]);

export const canMoveShipment = (from: S, to: S): boolean => {
  if (from === to || TERMINAL.has(from)) return false;
  if (to === S.FAILED) return true;
  if (to === S.RETURNED) return from === S.FAILED || FLOW.indexOf(from) >= FLOW.indexOf(S.PICKED_UP);
  // After a failed attempt the carrier may try again.
  if (from === S.FAILED) return [S.IN_TRANSIT, S.OUT_FOR_DELIVERY, S.DELIVERED].includes(to);
  return FLOW.indexOf(to) > FLOW.indexOf(from);
};
