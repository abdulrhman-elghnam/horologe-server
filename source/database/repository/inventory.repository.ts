import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { Inventory } from '../model/inventory.model.js';
import { DatabaseRepository } from './base.repository.js';

interface StockChange {
  variantId: string;
  quantity: number;
  manager?: EntityManager;
}

/**
 * Every stock change is one conditional UPDATE, so concurrent checkouts can never oversell:
 * the WHERE clause only matches when there is enough stock; a null result means "not enough".
 */
@Injectable()
export class InventoryRepository extends DatabaseRepository<Inventory> {
  constructor(@InjectRepository(Inventory) repository: Repository<Inventory>) {
    super(repository);
  }

  findByVariantId({ variantId, manager }: { variantId: string; manager?: EntityManager }): Promise<Inventory | null> {
    return this.repo(manager).findOne({ where: { variantId } });
  }

  /** Runs `UPDATE inventories SET … WHERE variant_id = :variantId AND <guard>` and returns the new row, or null when the guard failed. */
  private async apply(
    { variantId, quantity, manager }: StockChange,
    set: Partial<Record<'availableQuantity' | 'reservedQuantity', () => string>>,
    guard: string,
  ): Promise<Inventory | null> {
    const result = await this.repo(manager)
      .createQueryBuilder()
      .update(Inventory)
      .set(set)
      .where('variant_id = :variantId', { variantId })
      .andWhere(guard)
      .setParameter('quantity', quantity)
      .returning(['id', 'variantId', 'availableQuantity', 'reservedQuantity', 'lowStockThreshold'])
      .execute();

    const row = (result.raw as Record<string, unknown>[])[0];
    if (!row) return null;
    return this.repository.create({
      id: row.id as string,
      variantId: row.variant_id as string,
      availableQuantity: Number(row.available_quantity),
      reservedQuantity: Number(row.reserved_quantity),
      lowStockThreshold: Number(row.low_stock_threshold),
    });
  }

  /** available -= q; reserved += q. Returns null when there isn't enough stock. */
  reserve(change: StockChange) {
    return this.apply(
      change,
      { availableQuantity: () => 'available_quantity - :quantity', reservedQuantity: () => 'reserved_quantity + :quantity' },
      'available_quantity >= :quantity',
    );
  }

  /** reserved -= q; available += q (pending checkout cancelled or expired). */
  release(change: StockChange) {
    return this.apply(
      change,
      { availableQuantity: () => 'available_quantity + :quantity', reservedQuantity: () => 'reserved_quantity - :quantity' },
      'reserved_quantity >= :quantity',
    );
  }

  /** reserved -= q (payment succeeded: the units are sold). */
  confirm(change: StockChange) {
    return this.apply(change, { reservedQuantity: () => 'reserved_quantity - :quantity' }, 'reserved_quantity >= :quantity');
  }

  /** available += q, or -= q for a negative q when enough stock is available. */
  adjustAvailable(change: StockChange) {
    return this.apply(change, { availableQuantity: () => 'available_quantity + :quantity' }, 'available_quantity + :quantity >= 0');
  }
}
