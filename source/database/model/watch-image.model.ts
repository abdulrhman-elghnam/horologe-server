import { ApiHideProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseModel } from './base.model.js';
import type { Watch } from './watch.model.js';

@Entity({ name: 'watch_images' })
export class WatchImage extends BaseModel {
  @Index()
  @Column({ name: 'watch_id', type: 'uuid' })
  watchId: string;

  @ManyToOne('Watch', 'images', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'watch_id' })
  watch?: Watch;

  /** Storage key of the encrypted file; never exposed to clients. */
  @ApiHideProperty()
  @Column({ name: 'storage_key', type: 'varchar', length: 300, select: false })
  storageKey: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 40 })
  mimeType: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  alt: string | null;

  @Column({ type: 'int', default: 0 })
  position: number;
}
