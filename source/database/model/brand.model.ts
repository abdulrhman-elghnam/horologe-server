import { Column, Entity, Index } from 'typeorm';

import { BaseModel, trimTransformer } from './base.model.js';

@Entity({ name: 'brands' })
export class Brand extends BaseModel {
  @Column({ type: 'varchar', length: 120, transformer: trimTransformer })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 140 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
