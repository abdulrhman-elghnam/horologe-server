import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../database/model/_INDEX.js';
import { UserRepository } from '../../database/repository/_INDEX.js';

const ENTITIES = [User];
const REPOSITORIES = [UserRepository];

@Global()
@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  providers: REPOSITORIES,
  exports: [TypeOrmModule, ...REPOSITORIES],
})
export class RepositoryModule {}
