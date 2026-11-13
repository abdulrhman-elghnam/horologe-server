import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import configuration, { NODE_ENV } from '../../app.configuration.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: [`.env.${NODE_ENV}.local`, `.env.${NODE_ENV}`, '.env'],
      load: [configuration],
    }),
  ],
})
export class ConfigurationModule {}
