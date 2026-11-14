import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

import { BaseModel, trimTransformer } from './base.model.js';
import { Watch } from './watch.model.js';

@Entity({ name: 'collections' })
export class Collection extends BaseModel {
  @Column({ type: 'varchar', length: 120, transformer: trimTransformer })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 140 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'start_date', type: 'timestamptz', nullable: true })
  startDate: Date | null;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @ManyToMany(() => Watch, (watch) => watch.collections)
  @JoinTable({
    name: 'collection_watches',
    joinColumn: { name: 'collection_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'watch_id', referencedColumnName: 'id' },
  })
  watches?: Watch[];
}
