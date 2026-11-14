import { Module } from '@nestjs/common';

import { AdminCategoryController, CategoryController } from './category.controller.js';
import { CategoryService } from './category.service.js';

@Module({
  controllers: [CategoryController, AdminCategoryController],
  providers: [CategoryService],
})
export class CategoryModule {}
