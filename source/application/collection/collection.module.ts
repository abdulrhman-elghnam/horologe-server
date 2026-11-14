import { Module } from '@nestjs/common';

import { AdminCollectionController, CollectionController } from './collection.controller.js';
import { CollectionService } from './collection.service.js';

@Module({
  controllers: [CollectionController, AdminCollectionController],
  providers: [CollectionService],
})
export class CollectionModule {}
