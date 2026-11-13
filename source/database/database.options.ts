import { join } from 'node:path';

import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions.js';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
  ssl?: boolean;
  synchronize?: boolean;
  logging?: boolean;
}

// Shared by DatabaseModule (runtime) and data-source.ts (TypeORM CLI) so both hit the same database.
export const databaseOptions = (db: DatabaseConfig): PostgresConnectionOptions => ({
  type: 'postgres',
  host: db.host,
  port: db.port,
  username: db.username,
  password: db.password,
  database: db.name,
  ssl: db.ssl ? { rejectUnauthorized: false } : false,
  synchronize: db.synchronize ?? false,
  logging: db.logging ?? false,
  // Compiled migrations, resolved relative to this file inside distribution/.
  migrations: [join(import.meta.dirname, 'migration', '*.js')],
});
