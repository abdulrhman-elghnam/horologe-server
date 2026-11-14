import { OrderStatusEnum as S } from '../../dependency/value/database.enum.js';
import { ADMIN_SETTABLE, canTransition, CUSTOMER_CANCELLABLE, STATUS_MESSAGE } from './order.state.js';

describe('order state machine', () => {
  it('follows the happy path from pending to returned', () => {
    const path = [S.PENDING, S.CONFIRMED, S.PROCESSING, S.SHIPPED, S.DELIVERED, S.RETURN_REQUESTED, S.RETURNED];
    for (let i = 1; i < path.length; i++) expect(canTransition(path[i - 1], path[i])).toBe(true);
  });

  it('never skips payment or moves backwards', () => {
    expect(canTransition(S.PENDING, S.SHIPPED)).toBe(false);
    expect(canTransition(S.SHIPPED, S.PROCESSING)).toBe(false);
    expect(canTransition(S.SHIPPED, S.CANCELLED)).toBe(false);
  });

  it('treats cancelled and returned as final', () => {
    for (const to of Object.values(S)) {
      expect(canTransition(S.CANCELLED, to)).toBe(false);
      expect(canTransition(S.RETURNED, to)).toBe(false);
    }
  });

  it('only lets payments confirm an order', () => {
    expect(ADMIN_SETTABLE).not.toContain(S.CONFIRMED);
    expect(CUSTOMER_CANCELLABLE.has(S.PROCESSING)).toBe(false);
  });

  it('has a customer message for every status', () => {
    for (const status of Object.values(S)) expect(STATUS_MESSAGE[status]('HX-1').title).toBeTruthy();
  });
});
