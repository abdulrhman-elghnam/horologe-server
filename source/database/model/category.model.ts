import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseModel, trimTransformer } from './base.model.js';

@Entity({ name: 'categories' })
export class Category extends BaseModel {
  @Column({ type: 'varchar', length: 120, transformer: trimTransformer })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 140 })
  slug: string;

  @Index()
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: Category | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
