import { Module } from '@nestjs/common';

import { AdminBrandController, BrandController } from './brand.controller.js';
import { BrandService } from './brand.service.js';

@Module({
  controllers: [BrandController, AdminBrandController],
  providers: [BrandService],
})
export class BrandModule {}
