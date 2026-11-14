import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { DataSource, LessThan } from 'typeorm';

import { OrderLifecycleService, type OrderEffects } from './order-lifecycle.service.js';
import { OrderRepository } from '../../database/repository/order.repository.js';
import { OrderStatusEnum } from '../../dependency/value/database.enum.js';

const SWEEP_EVERY_MS = 60_000;
const BATCH_SIZE = 50;

/**
 * Cancels PENDING orders whose payment window passed and gives their stock and coupon back (spec §20 step 12).
 * Safe with several server instances: each order is taken with FOR UPDATE SKIP LOCKED and re-checked.
 */
@Injectable()
export class OrderExpiryService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OrderExpiryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly orders: OrderRepository,
    private readonly lifecycle: OrderLifecycleService,
    private readonly dataSource: DataSource,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.sweep(), SWEEP_EVERY_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  async sweep(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let expired = 0;
    try {
      const due = await this.orders.find({
        where: { status: OrderStatusEnum.PENDING, expiresAt: LessThan(new Date()) },
        options: { select: { id: true }, order: { expiresAt: 'ASC' } },
        take: BATCH_SIZE,
      });
      for (const { id } of due) {
        if (await this.expire(id)) expired++;
      }
      if (expired) this.logger.log(`Expired ${expired} unpaid orders`);
    } catch (error) {
      this.logger.error(`Order expiry sweep failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
    return expired;
  }

  private async expire(orderId: string): Promise<boolean> {
    const effects: OrderEffects | null = await this.dataSource.transaction(async (manager) => {
      const order = await this.lifecycle.lock(orderId, manager, { skipLocked: true });
      if (!order || order.status !== OrderStatusEnum.PENDING || !order.expiresAt || order.expiresAt > new Date()) return null;
      return this.lifecycle.failPayment(order, 'Payment window expired', manager);
    });
    if (effects) await this.lifecycle.publish(effects);
    return !!effects;
  }
}
