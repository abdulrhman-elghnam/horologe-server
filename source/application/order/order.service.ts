import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AdminOrderQueryDto, OrderQueryDto } from './dto/order.dto.js';
import { OrderLifecycleService } from './order-lifecycle.service.js';
import { presentOrder } from './order.presenter.js';
import { CUSTOMER_CANCELLABLE } from './order.state.js';
import { paginateQuery } from '../../database/repository/base.repository.js';
import { OrderRepository } from '../../database/repository/order.repository.js';
import { sortColumn, sortDirection } from '../../dependency/dto/pagination.dto.js';
import { escapeLike } from '../../dependency/service/util.service.js';
import type { OrderStatusEnum } from '../../dependency/value/database.enum.js';

/** Order queries plus the customer/admin actions that delegate to OrderLifecycleService. */
@Injectable()
export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly lifecycle: OrderLifecycleService,
    private readonly config: ConfigService,
  ) {}

  // ── Customer ──

  async myOrders(userId: string, { page, limit, status, sortOrder }: OrderQueryDto) {
    const result = await this.orders.paginate({
      where: { userId, ...(status ? { status } : {}) },
      page,
      size: limit,
      options: { relations: { items: true }, order: { createdAt: sortDirection(sortOrder) } },
    });
    return { ...result, docs: result.docs.map(presentOrder) };
  }

  /** Ownership is part of the query: another customer's order is simply "not found". */
  async myOrder(userId: string, orderId: string) {
    const order = await this.orders.findOne({ where: { id: orderId, userId }, options: { relations: { items: true } } });
    if (!order) throw new NotFoundException('Order not found');
    return presentOrder(order);
  }

  async cancelMine(userId: string, orderId: string, reason?: string) {
    await this.myOrder(userId, orderId);
    const { order, refundRequired } = await this.lifecycle.run(orderId, (order, manager) => {
      if (!CUSTOMER_CANCELLABLE.has(order.status)) throw new ForbiddenException('This order can no longer be cancelled. Request a return instead');
      return this.lifecycle.cancel(order, { actor: userId, note: reason ?? 'Cancelled by customer', manager });
    });
    return { ...presentOrder(order), refundRequired: !!refundRequired };
  }

  async requestReturn(userId: string, orderId: string, reason: string) {
    await this.myOrder(userId, orderId);
    const days = this.config.get<number>('commerce.returnWindowDays', 14);
    const { order } = await this.lifecycle.run(orderId, (order, manager) => this.lifecycle.requestReturn(order, reason, days, manager));
    return presentOrder(order);
  }

  // ── Admin ──

  async list({ page, limit, status, paymentStatus, userId, search, from, to, sortBy, sortOrder }: AdminOrderQueryDto) {
    const query = this.orders.repo().createQueryBuilder('order').leftJoinAndSelect('order.user', 'user').leftJoinAndSelect('order.items', 'item');

    if (status) query.andWhere('order.status = :status', { status });
    if (paymentStatus) query.andWhere('order.paymentStatus = :paymentStatus', { paymentStatus });
    if (userId) query.andWhere('order.userId = :userId', { userId });
    if (search) query.andWhere('order.orderNumber ILIKE :search', { search: `%${escapeLike(search)}%` });
    if (from) query.andWhere('order.createdAt >= :from', { from });
    if (to) query.andWhere('order.createdAt <= :to', { to });

    query.orderBy(
      sortColumn(sortBy, { createdAt: 'order.createdAt', total: 'order.total', status: 'order.status' }, 'order.createdAt'),
      sortDirection(sortOrder),
    );
    const result = await paginateQuery(query, page, limit);
    return { ...result, docs: result.docs.map(presentOrder) };
  }

  async get(orderId: string) {
    const order = await this.orders.findOne({ where: { id: orderId }, options: { relations: { items: true, user: true } } });
    if (!order) throw new NotFoundException('Order not found');
    return presentOrder(order);
  }

  async updateStatus(adminId: string, orderId: string, status: OrderStatusEnum, note?: string) {
    const { order, refundRequired } = await this.lifecycle.run(orderId, (order, manager) =>
      this.lifecycle.adminTransition(order, status, { actor: adminId, note, manager }),
    );
    return { ...presentOrder(order), refundRequired: !!refundRequired };
  }

  async cancelAsAdmin(adminId: string, orderId: string, reason: string) {
    const { order, refundRequired } = await this.lifecycle.run(orderId, (order, manager) =>
      this.lifecycle.cancel(order, { actor: adminId, note: reason, manager }),
    );
    return { ...presentOrder(order), refundRequired: !!refundRequired };
  }
}
