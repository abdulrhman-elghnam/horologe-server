import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './dependency/exception/all-exceptions.filter.js';
import { API_PREFIX } from './dependency/presenter.js';
import { setupSwagger } from './dependency/swagger/_INDEX.js';

async function bootstrap() {
  // rawBody: payment/shipping webhooks verify the provider's signature over the exact bytes received.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''));
  app.enableCors({ origin: config.get<string[]>('app.corsOrigin'), credentials: true });

  // DTO validation for every REST payload: unknown fields are rejected, values converted to the DTO types.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, stopAtFirstError: true }));
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter));

  app.set('query parser', 'extended');
  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');
  app.enableShutdownHooks();

  if (config.get<boolean>('docs.enabled')) setupSwagger(app);

  await app.listen(config.get<number>('app.port', 3000));
}
await bootstrap();
