import type { Order, OrderItem } from '../../database/model/order.model.js';
import { SignedUrl } from '../../dependency/presenter.js';

const presentItem = ({ imageId, order: _order, ...item }: OrderItem) => ({ ...item, image: imageId ? SignedUrl.sign('image', imageId) : null });

/** Order for the API. The idempotency key stays internal. */
export const presentOrder = (order: Order) => {
  const { items, idempotencyKey: _key, user, ...rest } = order;
  return {
    ...rest,
    ...(user ? { customer: { id: user.id, name: user.name, email: user.email } } : {}),
    ...(items ? { items: items.map(presentItem) } : {}),
  };
};

export type OrderView = ReturnType<typeof presentOrder>;
