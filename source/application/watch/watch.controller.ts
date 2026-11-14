import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';

import {
  AdminWatchQueryDto,
  CreateVariantDto,
  CreateWatchDto,
  ImageMetaDto,
  UpdateVariantDto,
  UpdateWatchDto,
  VariantPriceDto,
  WatchQueryDto,
  WatchStatusDto,
} from './dto/watch.dto.js';
import { WatchAdminService } from './watch-admin.service.js';
import { WatchCatalogService } from './watch-catalog.service.js';
import { AdminOnly, Audit, CurrentUser, RateLimit } from '../../dependency/decorator/_INDEX.js';
import { StatusDto } from '../../dependency/dto/common.dto.js';
import { UploadImagePipe } from '../../dependency/pipe/upload.pipe.js';

@ApiTags('Catalog · Watches')
@Controller('watches')
export class WatchController {
  constructor(private readonly catalog: WatchCatalogService) {}

  /** ?page&limit&search&brandId&categoryId&collectionId&gender&movement&minPrice&maxPrice&sortBy=price|createdAt|name|rating|popularity&sortOrder */
  @Get()
  list(@Query() query: WatchQueryDto) {
    return this.catalog.search(query);
  }

  @Get('featured')
  featured() {
    return this.catalog.featured();
  }

  @Get('new-arrivals')
  newArrivals() {
    return this.catalog.newArrivals();
  }

  @Get('best-sellers')
  bestSellers() {
    return this.catalog.bestSellers();
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.catalog.findPublicBySlug(slug);
  }
}

/** One pipe instance validates every uploaded file. */
const imageFiles = new UploadImagePipe({ maxSize: 10 * 1024 * 1024 });

@AdminOnly()
@ApiTags('Admin · Watches')
@Controller('admin/watches')
export class AdminWatchController {
  constructor(
    private readonly catalog: WatchCatalogService,
    private readonly admin: WatchAdminService,
  ) {}

  @Get()
  list(@Query() query: AdminWatchQueryDto) {
    return this.catalog.search(query, { admin: true });
  }

  @Get(':watchId')
  get(@Param('watchId', ParseUUIDPipe) watchId: string) {
    return this.catalog.findForAdmin(watchId);
  }

  @Audit('watch.create', 'watch')
  @Post()
  create(@Body() body: CreateWatchDto, @CurrentUser('id') adminId: string) {
    return this.admin.create(body, adminId);
  }

  @Audit('watch.update', 'watch', 'watchId')
  @Patch(':watchId')
  update(@Param('watchId', ParseUUIDPipe) watchId: string, @Body() body: UpdateWatchDto) {
    return this.admin.update(watchId, body);
  }

  @Audit('watch.delete', 'watch', 'watchId')
  @Delete(':watchId')
  @HttpCode(HttpStatus.OK)
  remove(@Param('watchId', ParseUUIDPipe) watchId: string) {
    return this.admin.remove(watchId);
  }

  @Audit('watch.status.update', 'watch', 'watchId')
  @Patch(':watchId/status')
  setStatus(@Param('watchId', ParseUUIDPipe) watchId: string, @Body() { status }: WatchStatusDto) {
    return this.admin.setStatus(watchId, status);
  }

  /** multipart/form-data: one or more `images` files (JPEG/PNG) and an optional `alt`. */
  @RateLimit.upload()
  @Audit('watch.images.add', 'watch', 'watchId')
  @Post(':watchId/images')
  @UseInterceptors(FilesInterceptor('images', 12))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['images'],
      properties: {
        images: { type: 'array', maxItems: 12, items: { type: 'string', format: 'binary' }, description: 'JPEG or PNG files' },
        alt: { type: 'string', description: 'Alt text applied to the uploaded images' },
      },
    },
  })
  addImages(@Param('watchId', ParseUUIDPipe) watchId: string, @UploadedFiles() files: Express.Multer.File[], @Body() { alt }: ImageMetaDto) {
    return this.admin.addImages(
      watchId,
      (files ?? []).map((file) => imageFiles.transform(file)!),
      alt,
    );
  }

  @Audit('watch.images.delete', 'watch', 'watchId')
  @Delete(':watchId/images/:imageId')
  @HttpCode(HttpStatus.OK)
  removeImage(@Param('watchId', ParseUUIDPipe) watchId: string, @Param('imageId', ParseUUIDPipe) imageId: string) {
    return this.admin.removeImage(watchId, imageId);
  }

  @Audit('variant.create', 'watch', 'watchId')
  @Post(':watchId/variants')
  addVariant(@Param('watchId', ParseUUIDPipe) watchId: string, @Body() body: CreateVariantDto, @CurrentUser('id') adminId: string) {
    return this.admin.addVariant(watchId, body, adminId);
  }

  @Audit('variant.update', 'variant', 'variantId')
  @Patch(':watchId/variants/:variantId')
  updateVariant(@Param('watchId', ParseUUIDPipe) watchId: string, @Param('variantId', ParseUUIDPipe) variantId: string, @Body() body: UpdateVariantDto) {
    return this.admin.updateVariant(watchId, variantId, body);
  }

  @Audit('variant.price.update', 'variant', 'variantId')
  @Patch(':watchId/variants/:variantId/price')
  updatePrice(@Param('watchId', ParseUUIDPipe) watchId: string, @Param('variantId', ParseUUIDPipe) variantId: string, @Body() body: VariantPriceDto) {
    return this.admin.updatePrice(watchId, variantId, body);
  }

  @Audit('variant.status.update', 'variant', 'variantId')
  @Patch(':watchId/variants/:variantId/status')
  setVariantStatus(@Param('watchId', ParseUUIDPipe) watchId: string, @Param('variantId', ParseUUIDPipe) variantId: string, @Body() { isActive }: StatusDto) {
    return this.admin.setVariantStatus(watchId, variantId, isActive);
  }

  @Audit('variant.delete', 'variant', 'variantId')
  @Delete(':watchId/variants/:variantId')
  @HttpCode(HttpStatus.OK)
  removeVariant(@Param('watchId', ParseUUIDPipe) watchId: string, @Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.admin.removeVariant(watchId, variantId);
  }
}
