import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CategoryService } from './category.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { AdminOnly, Audit } from '../../dependency/decorator/_INDEX.js';
import { StatusDto } from '../../dependency/dto/common.dto.js';

@ApiTags('Catalog · Categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categories: CategoryService) {}

  @Get()
  list() {
    return this.categories.listActive();
  }

  @Get('tree')
  tree() {
    return this.categories.tree();
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.categories.findPublicBySlug(slug);
  }
}

@AdminOnly()
@ApiTags('Admin · Categories')
@Controller('admin/categories')
export class AdminCategoryController {
  constructor(private readonly categories: CategoryService) {}

  @Get()
  list() {
    return this.categories.listAll();
  }

  @Audit('category.create', 'category')
  @Post()
  create(@Body() body: CreateCategoryDto) {
    return this.categories.create(body);
  }

  @Audit('category.update', 'category', 'categoryId')
  @Patch(':categoryId')
  update(@Param('categoryId', ParseUUIDPipe) categoryId: string, @Body() body: UpdateCategoryDto) {
    return this.categories.update(categoryId, body);
  }

  @Audit('category.status.update', 'category', 'categoryId')
  @Patch(':categoryId/status')
  setStatus(@Param('categoryId', ParseUUIDPipe) categoryId: string, @Body() { isActive }: StatusDto) {
    return this.categories.setStatus(categoryId, isActive);
  }

  @Audit('category.delete', 'category', 'categoryId')
  @Delete(':categoryId')
  @HttpCode(HttpStatus.OK)
  remove(@Param('categoryId', ParseUUIDPipe) categoryId: string) {
    return this.categories.remove(categoryId);
  }
}
