import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn, type ValueTransformer } from 'typeorm';

import { IUser } from '../../dependency/interface/database.interface.js';
import { AuthProviderEnum, SystemRoleEnum } from '../../dependency/value/security.enum.js';

const trim: ValueTransformer = {
  to: (value?: string | null) => (typeof value === 'string' ? value.trim() : value),
  from: (value: string | null) => value,
};

const lowerTrim: ValueTransformer = {
  to: (value?: string | null) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  from: (value: string | null) => value,
};

@Entity({ name: 'users' })
export class User implements IUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120, transformer: trim })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, transformer: lowerTrim })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', nullable: true, select: false })
  passwordHash?: string | null;

  @Column({ type: 'varchar', length: 120, transformer: trim })
  city: string;

  @Column({ type: 'varchar', length: 32, nullable: true, transformer: trim })
  phone?: string | null;

  @Column({ name: 'avatar_key', type: 'varchar', nullable: true })
  avatarKey?: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', nullable: true, transformer: trim })
  avatarUrl?: string | null;

  @Index()
  @Column({ type: 'enum', enum: SystemRoleEnum, enumName: 'user_role', default: SystemRoleEnum.CUSTOMER })
  role: SystemRoleEnum;

  @Column({ type: 'enum', enum: AuthProviderEnum, enumName: 'auth_provider', default: AuthProviderEnum.SYSTEM })
  provider: AuthProviderEnum;


  @Index({ unique: true })
  @Column({ name: 'google_id', type: 'varchar', nullable: true, select: false })
  googleId?: string | null;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt?: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 2, nullable: true })
  language?: 'en' | 'ar' | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;


  @VersionColumn()
  version: number;
}
