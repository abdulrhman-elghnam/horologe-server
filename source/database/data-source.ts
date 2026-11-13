// TypeORM CLI entry point (see the `typeorm` npm scripts). Not imported by the app.
import 'reflect-metadata';
import { DataSource } from 'typeorm';

import configuration from '../app.configuration.js';
import { databaseOptions, type DatabaseConfig } from './database.options.js';
import * as entities from './model/_INDEX.js';

const env = process.env.NODE_ENV ?? 'development';
for (const file of [`.env.${env}.local`, `.env.${env}`, '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Missing env files are fine; earlier files win because loadEnvFile never overwrites.
  }
}

export default new DataSource({
  ...databaseOptions(configuration().database as DatabaseConfig),
  entities: Object.values(entities),
});
