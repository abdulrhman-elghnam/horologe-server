import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { API_PREFIX } from './dependency/presenter.js';
import { AllExceptionsFilter } from './dependency/exception/all-exceptions.filter.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''));
  const { httpAdapter } = app.get(HttpAdapterHost);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, stopAtFirstError: true }));
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));
  
  app.set('query parser', 'extended', 'trust proxy', 'loopback');
  app.disable('x-powered-by');
  
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  await app.listen(config.get<number>('app.port', 3000));
}
await bootstrap();
