import { Column, Entity, Index, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany } from 'typeorm';

import { BaseModel, MoneyColumn, numericTransformer, trimTransformer } from './base.model.js';
import { Brand } from './brand.model.js';
import { Category } from './category.model.js';
import type { Collection } from './collection.model.js';
import { WatchImage } from './watch-image.model.js';
import { WatchVariant } from './watch-variant.model.js';
import { WatchDisplayEnum, WatchGenderEnum, WatchMovementEnum, WatchStatusEnum } from '../../dependency/value/database.enum.js';

/** Technical specification, stored as embedded `spec_*` columns on the watches table. */
export class WatchSpecification {
  @Column({ name: 'case_material', type: 'varchar', length: 80, nullable: true })
  caseMaterial: string | null;

  @Column({ name: 'case_diameter', type: 'numeric', precision: 5, scale: 1, nullable: true, transformer: numericTransformer })
  caseDiameter: number | null;

  @Column({ name: 'strap_material', type: 'varchar', length: 80, nullable: true })
  strapMaterial: string | null;

  @Column({ name: 'dial_color', type: 'varchar', length: 40, nullable: true })
  dialColor: string | null;

  @Column({ name: 'glass_type', type: 'varchar', length: 60, nullable: true })
  glassType: string | null;

  /** Metres. */
  @Column({ name: 'water_resistance', type: 'int', nullable: true })
  waterResistance: number | null;

  /** Hours. */
  @Column({ name: 'power_reserve', type: 'int', nullable: true })
  powerReserve: number | null;
}

@Entity({ name: 'watches' })
export class Watch extends BaseModel {
  @Index()
  @Column({ name: 'brand_id', type: 'uuid' })
  brandId: string;

  @ManyToOne(() => Brand, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'brand_id' })
  brand?: Brand;

  @Column({ type: 'varchar', length: 200, transformer: trimTransformer })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 220 })
  slug: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  model: string | null;

  @Column({ name: 'reference_number', type: 'varchar', length: 80, nullable: true })
  referenceNumber: string | null;

  @Index()
  @Column({ type: 'enum', enum: WatchGenderEnum, enumName: 'watch_gender', default: WatchGenderEnum.UNISEX })
  gender: WatchGenderEnum;

  @Index()
  @Column({ type: 'enum', enum: WatchMovementEnum, enumName: 'watch_movement' })
  movement: WatchMovementEnum;

  @Column({ name: 'display_type', type: 'enum', enum: WatchDisplayEnum, enumName: 'watch_display', default: WatchDisplayEnum.ANALOG })
  displayType: WatchDisplayEnum;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'warranty_months', type: 'int', default: 24 })
  warrantyMonths: number;

  @Index()
  @Column({ type: 'enum', enum: WatchStatusEnum, enumName: 'watch_status', default: WatchStatusEnum.DRAFT })
  status: WatchStatusEnum;

  @Index()
  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured: boolean;

  @Column(() => WatchSpecification, { prefix: 'spec' })
  specification: WatchSpecification;

  // ── Denormalised read-model fields, kept in sync by services ──
  /** Lowest active variant price; used for filtering and sorting. */
  @Index()
  @MoneyColumn({ name: 'min_price', nullable: true })
  minPrice: number | null;

  @Column({ name: 'sold_count', type: 'int', default: 0 })
  soldCount: number;

  @Column({ name: 'rating_average', type: 'numeric', precision: 3, scale: 2, default: 0, transformer: numericTransformer })
  ratingAverage: number;

  @Column({ name: 'rating_count', type: 'int', default: 0 })
  ratingCount: number;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @OneToMany(() => WatchVariant, (variant) => variant.watch)
  variants?: WatchVariant[];

  @OneToMany(() => WatchImage, (image) => image.watch)
  images?: WatchImage[];

  @ManyToMany(() => Category)
  @JoinTable({
    name: 'watch_categories',
    joinColumn: { name: 'watch_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
  })
  categories?: Category[];

  @ManyToMany('Collection', 'watches')
  collections?: Collection[];
}
