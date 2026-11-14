import { Module } from '@nestjs/common';

import { AdminWatchController, WatchController } from './watch.controller.js';
import { WatchAdminService } from './watch-admin.service.js';
import { WatchCatalogService } from './watch-catalog.service.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { NotificationModule } from '../notification/notification.module.js';

@Module({
  imports: [InventoryModule, NotificationModule],
  controllers: [WatchController, AdminWatchController],
  providers: [WatchCatalogService, WatchAdminService],
  exports: [WatchCatalogService],
})
export class WatchModule {}
