import 'reflect-metadata';
import { DataSource } from 'typeorm';
import configuration from '../app.configuration.js';
import { databaseOptions, type DatabaseConfig } from './database.options.js';
import * as entities from './model/_INDEX.js';


const env = process.env.NODE_ENV ?? 'development';
try {
  process.loadEnvFile(`.env.${env}`);
} catch (error) {
  console.error({ error });
}

export default new DataSource({
  ...databaseOptions(configuration().database as DatabaseConfig),
  entities: Object.values(entities),
});
