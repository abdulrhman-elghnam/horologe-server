import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminBrandQueryDto, BrandQueryDto, CreateBrandDto, UpdateBrandDto } from './dto/brand.dto.js';
import { BrandService } from './brand.service.js';
import { AdminOnly, Audit } from '../../dependency/decorator/_INDEX.js';
import { StatusDto } from '../../dependency/dto/common.dto.js';

@ApiTags('Catalog · Brands')
@Controller('brands')
export class BrandController {
  constructor(private readonly brands: BrandService) {}

  @Get()
  list(@Query() query: BrandQueryDto) {
    return this.brands.list(query, true);
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.brands.findPublicBySlug(slug);
  }
}

@AdminOnly()
@ApiTags('Admin · Brands')
@Controller('admin/brands')
export class AdminBrandController {
  constructor(private readonly brands: BrandService) {}

  @Get()
  list(@Query() query: AdminBrandQueryDto) {
    return this.brands.list(query, false);
  }

  @Audit('brand.create', 'brand')
  @Post()
  create(@Body() body: CreateBrandDto) {
    return this.brands.create(body);
  }

  @Audit('brand.update', 'brand', 'brandId')
  @Patch(':brandId')
  update(@Param('brandId', ParseUUIDPipe) brandId: string, @Body() body: UpdateBrandDto) {
    return this.brands.update(brandId, body);
  }

  @Audit('brand.status.update', 'brand', 'brandId')
  @Patch(':brandId/status')
  setStatus(@Param('brandId', ParseUUIDPipe) brandId: string, @Body() { isActive }: StatusDto) {
    return this.brands.setStatus(brandId, isActive);
  }

  @Audit('brand.delete', 'brand', 'brandId')
  @Delete(':brandId')
  @HttpCode(HttpStatus.OK)
  remove(@Param('brandId', ParseUUIDPipe) brandId: string) {
    return this.brands.remove(brandId);
  }
}
