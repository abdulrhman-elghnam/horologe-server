import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';

import type { InventoryQueryDto, MovementQueryDto, StockAdjustmentDto } from './dto/inventory.dto.js';
import { RealtimeEvent } from '../realtime/realtime.event.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { Inventory } from '../../database/model/inventory.model.js';
import type { InventoryMovement } from '../../database/model/inventory-movement.model.js';
import { paginateQuery } from '../../database/repository/base.repository.js';
import { InventoryMovementRepository } from '../../database/repository/inventory-movement.repository.js';
import { InventoryRepository } from '../../database/repository/inventory.repository.js';
import { WatchVariantRepository } from '../../database/repository/watch-variant.repository.js';
import { sortColumn, sortDirection } from '../../dependency/dto/pagination.dto.js';
import { escapeLike } from '../../dependency/service/util.service.js';
import { InventoryMovementTypeEnum } from '../../dependency/value/database.enum.js';

export interface StockLine {
  variantId: string;
  quantity: number;
}

/** Result of one stock change; pass a list of these to `publish()` after the transaction commits. */
export interface StockChange {
  inventory: Inventory;
  previousAvailable: number;
}

/**
 * Inventory model (see spec §20):
 *   reserve  : available -= q, reserved += q   (checkout)
 *   confirm  : reserved  -= q                  (payment succeeded, units sold)
 *   release  : reserved  -= q, available += q  (checkout cancelled/expired)
 *   restock  : available += q                  (return / cancellation after payment)
 * Every method takes an optional EntityManager so callers can run it inside their transaction.
 */
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly inventories: InventoryRepository,
    private readonly movements: InventoryMovementRepository,
    private readonly variants: WatchVariantRepository,
    private readonly realtime: RealtimeService,
    private readonly dataSource: DataSource,
  ) {}

  // ── Internal operations (used by other modules) ──

  async createForVariant({
    variantId,
    quantity,
    lowStockThreshold,
    adminId,
    manager,
  }: {
    variantId: string;
    quantity: number;
    lowStockThreshold?: number;
    adminId?: string;
    manager: EntityManager;
  }): Promise<StockChange> {
    const inventory = await this.inventories.create({ data: { variantId, availableQuantity: 0, reservedQuantity: 0, lowStockThreshold }, manager });
    if (quantity <= 0) return { inventory, previousAvailable: 0 };
    const change = await this.change('adjustAvailable', { variantId, quantity }, InventoryMovementTypeEnum.RESTOCK, {
      referenceId: null,
      adminId,
      reason: 'Initial stock',
      manager,
    });
    return change!;
  }

  /** Fails with 409 (naming the SKU) when any line doesn't have enough stock. Lines are locked in id order to avoid deadlocks. */
  async reserve(lines: StockLine[], referenceId: string, manager: EntityManager): Promise<StockChange[]> {
    const changes: StockChange[] = [];
    for (const line of sortLines(lines)) {
      const change = await this.change('reserve', line, InventoryMovementTypeEnum.RESERVE, { referenceId, manager });
      if (!change) throw new ConflictException({ message: 'Not enough stock for one or more items', code: 'OUT_OF_STOCK', variantId: line.variantId });
      changes.push(change);
    }
    return changes;
  }

  async release(lines: StockLine[], referenceId: string, manager: EntityManager): Promise<StockChange[]> {
    return this.applyAll('release', lines, InventoryMovementTypeEnum.RELEASE, referenceId, manager);
  }

  async confirm(lines: StockLine[], referenceId: string, manager: EntityManager): Promise<StockChange[]> {
    return this.applyAll('confirm', lines, InventoryMovementTypeEnum.SALE, referenceId, manager);
  }

  async restock(lines: StockLine[], referenceId: string, manager: EntityManager): Promise<StockChange[]> {
    return this.applyAll('adjustAvailable', lines, InventoryMovementTypeEnum.RETURN, referenceId, manager);
  }

  async checkAvailability(lines: StockLine[]): Promise<{ available: boolean; shortages: { variantId: string; requested: number; available: number }[] }> {
    const rows = await this.inventories.find({ where: { variantId: In(lines.map((line) => line.variantId)) } });
    const byVariant = new Map(rows.map((row) => [row.variantId, row.availableQuantity]));
    const shortages = lines
      .map((line) => ({ variantId: line.variantId, requested: line.quantity, available: byVariant.get(line.variantId) ?? 0 }))
      .filter((line) => line.available < line.requested);
    return { available: shortages.length === 0, shortages };
  }

  /** Pushes live stock events. Call after the transaction that made the changes has committed. */
  async publish(changes: StockChange[]): Promise<void> {
    if (!changes.length) return;
    try {
      const variants = await this.variants.find({
        where: { id: In(changes.map((change) => change.inventory.variantId)) },
        options: { select: { id: true, watchId: true, sku: true } },
      });
      const variantById = new Map(variants.map((variant) => [variant.id, variant]));

      for (const { inventory, previousAvailable } of changes) {
        const variant = variantById.get(inventory.variantId);
        const payload = {
          variantId: inventory.variantId,
          watchId: variant?.watchId,
          sku: variant?.sku,
          availableQuantity: inventory.availableQuantity,
          reservedQuantity: inventory.reservedQuantity,
          lowStockThreshold: inventory.lowStockThreshold,
        };
        this.realtime.emitToInventory(RealtimeEvent.INVENTORY_UPDATED, payload);

        if (variant) {
          // Shoppers only learn whether it's in stock and how many are left.
          this.realtime.emitToWatch(variant.watchId, RealtimeEvent.INVENTORY_UPDATED, {
            variantId: inventory.variantId,
            inStock: inventory.availableQuantity > 0,
            availableQuantity: inventory.availableQuantity,
          });
          if (previousAvailable === 0 && inventory.availableQuantity > 0) {
            this.realtime.emitToWatch(variant.watchId, RealtimeEvent.INVENTORY_BACK_IN_STOCK, { variantId: inventory.variantId, watchId: variant.watchId });
          }
        }

        const crossedDown = inventory.availableQuantity < previousAvailable;
        if (crossedDown && inventory.availableQuantity === 0) {
          this.realtime.emitToInventory(RealtimeEvent.INVENTORY_OUT_OF_STOCK, payload);
          this.realtime.emitToAdmins(RealtimeEvent.ADMIN_INVENTORY_LOW_STOCK, { ...payload, outOfStock: true });
        } else if (crossedDown && inventory.availableQuantity <= inventory.lowStockThreshold && previousAvailable > inventory.lowStockThreshold) {
          this.realtime.emitToInventory(RealtimeEvent.INVENTORY_LOW_STOCK, payload);
          this.realtime.emitToAdmins(RealtimeEvent.ADMIN_INVENTORY_LOW_STOCK, { ...payload, outOfStock: false });
        }
      }
    } catch (error) {
      this.logger.warn(`Publishing stock events failed: ${(error as Error).message}`);
    }
  }

  // ── Admin endpoints ──

  list({ page, limit, search, lowStockOnly, outOfStockOnly, sortBy, sortOrder }: InventoryQueryDto) {
    const query = this.inventories
      .repo()
      .createQueryBuilder('inventory')
      .innerJoinAndSelect('inventory.variant', 'variant')
      .innerJoin('variant.watch', 'watch')
      .addSelect(['watch.id', 'watch.name', 'watch.slug', 'watch.status']);

    if (search) query.andWhere('(variant.sku ILIKE :search OR watch.name ILIKE :search)', { search: `%${escapeLike(search)}%` });
    if (lowStockOnly) query.andWhere('inventory.availableQuantity <= inventory.lowStockThreshold');
    if (outOfStockOnly) query.andWhere('inventory.availableQuantity = 0');

    const column = sortColumn(
      sortBy,
      { available: 'inventory.availableQuantity', reserved: 'inventory.reservedQuantity', updatedAt: 'inventory.updatedAt' },
      'inventory.updatedAt',
    );
    query.orderBy(column, sortDirection(sortOrder));
    return paginateQuery(query, page, limit);
  }

  lowStock(query: InventoryQueryDto) {
    return this.list({ ...query, lowStockOnly: true, sortBy: query.sortBy ?? 'available', sortOrder: query.sortOrder });
  }

  async getByVariant(variantId: string) {
    const inventory = await this.inventories.findOne({ where: { variantId }, options: { relations: { variant: { watch: true } } } });
    if (!inventory) throw new NotFoundException('Inventory not found');
    return inventory;
  }

  async movementsOf(variantId: string, { page, limit, type, sortOrder }: MovementQueryDto) {
    await this.getByVariant(variantId);
    return this.movements.paginate({
      where: { variantId, ...(type ? { type } : {}) },
      page,
      size: limit,
      options: { order: { createdAt: sortDirection(sortOrder) } },
    });
  }

  async adjust({ variantId, quantity, type, reason }: StockAdjustmentDto, adminId: string) {
    await this.getByVariant(variantId);
    const change = await this.dataSource.transaction((manager) =>
      this.change('adjustAvailable', { variantId, quantity }, type, { referenceId: null, adminId, reason, manager }),
    );
    if (!change) throw new ConflictException('Adjustment would make available stock negative');
    await this.publish([change]);
    return change.inventory;
  }

  async setThreshold(variantId: string, lowStockThreshold: number) {
    const inventory = await this.getByVariant(variantId);
    await this.inventories.updateMany({ where: { id: inventory.id }, data: { lowStockThreshold } });
    return { ...inventory, lowStockThreshold };
  }

  // ── Helpers ──

  /** Applies one repository operation and records it in the movement ledger. Returns null when the guard failed. */
  private async change(
    operation: StockOperation,
    { variantId, quantity }: StockLine,
    type: InventoryMovementTypeEnum,
    { referenceId, adminId, reason, manager }: { referenceId: string | null; adminId?: string; reason?: string; manager: EntityManager },
  ): Promise<StockChange | null> {
    const inventory = await this.inventories[operation]({ variantId, quantity, manager });
    if (!inventory) return null;

    const { available, ledger } = EFFECT[operation];
    await this.movements.create({
      data: {
        variantId,
        adminId: adminId ?? null,
        type,
        quantity: ledger * quantity,
        reason: reason ?? null,
        referenceId,
      } satisfies Partial<InventoryMovement>,
      manager,
    });
    return { inventory, previousAvailable: inventory.availableQuantity - available * quantity };
  }

  private async applyAll(
    operation: Exclude<StockOperation, 'reserve'>,
    lines: StockLine[],
    type: InventoryMovementTypeEnum,
    referenceId: string,
    manager: EntityManager,
  ): Promise<StockChange[]> {
    const changes: StockChange[] = [];
    for (const line of sortLines(lines)) {
      const change = await this.change(operation, line, type, { referenceId, manager });
      if (!change) {
        // Should never happen for a consistent order; log loudly instead of failing the whole flow.
        this.logger.error(`Inventory ${operation} failed for variant ${line.variantId} (reference ${referenceId})`);
        continue;
      }
      changes.push(change);
    }
    return changes;
  }
}

type StockOperation = 'reserve' | 'release' | 'confirm' | 'adjustAvailable';

/**
 * How each operation moves stock.
 * - available: multiplier for the change of availableQuantity.
 * - ledger: sign of the quantity written to the movement ledger (units leaving the shelf are negative).
 */
const EFFECT: Record<StockOperation, { available: number; ledger: number }> = {
  reserve: { available: -1, ledger: -1 },
  release: { available: 1, ledger: 1 },
  confirm: { available: 0, ledger: -1 },
  adjustAvailable: { available: 1, ledger: 1 },
};

const sortLines = (lines: StockLine[]) => [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId));
