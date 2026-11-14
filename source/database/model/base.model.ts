import { Column, CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn, type ColumnOptions, type ValueTransformer } from 'typeorm';

/** Every table gets a uuid id and snake_case timestamps. */
export abstract class BaseModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

/** Postgres returns numeric columns as strings; expose them as numbers. */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value: string | null) => (value === null || value === undefined ? value : Number(value)),
};

/** Money column: numeric(12,2) read back as a JS number. */
export const MoneyColumn = (options: ColumnOptions = {}) => Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer, ...options });

export const trimTransformer: ValueTransformer = {
  to: (value?: string | null) => (typeof value === 'string' ? value.trim() : value),
  from: (value: string | null) => value,
};
