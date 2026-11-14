import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseModel } from './base.model.js';
import { User } from './user.model.js';

@Entity({ name: 'addresses' })
// At most one default address per user.
@Index('UQ_addresses_user_default', ['userId'], { unique: true, where: '"is_default" = true' })
export class Address extends BaseModel {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'recipient_name', type: 'varchar', length: 120 })
  recipientName: string;

  @Column({ type: 'varchar', length: 32 })
  phone: string;

  @Column({ type: 'varchar', length: 80 })
  country: string;

  @Column({ type: 'varchar', length: 120 })
  city: string;

  @Column({ type: 'varchar', length: 200 })
  street: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  building: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  apartment: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
  postalCode: string | null;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;
}
