import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { databaseOptions, type DatabaseConfig } from '../../database/database.options.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...databaseOptions(config.getOrThrow<DatabaseConfig>('database')),
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
