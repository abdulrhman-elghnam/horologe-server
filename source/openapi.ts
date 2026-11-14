/**
 * Writes the OpenAPI document to public/documentation/swagger.json without starting the server.
 * `preview: true` builds the module graph but never instantiates providers, so no Postgres/Redis is needed.
 *
 *   npm run docs:openapi                 # -> public/documentation/swagger.json
 *   node distribution/openapi.js <file>  # -> any path
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { API_PREFIX } from './dependency/presenter.js';
import { buildOpenApiDocument } from './dependency/swagger/_INDEX.js';

const output = process.argv[2] ?? join(import.meta.dirname, '..', 'public', 'documentation', 'swagger.json');

const app = await NestFactory.create(AppModule, { preview: true, logger: ['error'] });
app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''));

const document = buildOpenApiDocument(app);
await writeFile(output, `${JSON.stringify(document, null, 2)}\n`);
await app.close();

console.log(`OpenAPI document written to ${output} (${Object.keys(document.paths).length} paths)`);
