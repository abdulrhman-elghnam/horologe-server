import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { InventoryMovementTypeEnum } from '../../dependency/value/database.enum.js';

/** Append-only stock ledger. `quantity` is signed relative to availableQuantity. */
@Entity({ name: 'inventory_movements' })
@Index(['variantId', 'createdAt'])
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  /** Admin who made a manual adjustment; null for system movements. */
  @Column({ name: 'admin_id', type: 'uuid', nullable: true })
  adminId: string | null;

  @Column({ type: 'enum', enum: InventoryMovementTypeEnum, enumName: 'inventory_movement_type' })
  type: InventoryMovementTypeEnum;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'varchar', length: 300, nullable: true })
  reason: string | null;

  /** Order id (or other source) that caused the movement. */
  @Index()
  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
