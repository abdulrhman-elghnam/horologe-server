import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CollectionService } from './collection.service.js';
import { AddCollectionWatchesDto, CreateCollectionDto, UpdateCollectionDto } from './dto/collection.dto.js';
import { AdminOnly, Audit } from '../../dependency/decorator/_INDEX.js';
import { StatusDto } from '../../dependency/dto/common.dto.js';

@ApiTags('Catalog · Collections')
@Controller('collections')
export class CollectionController {
  constructor(private readonly collections: CollectionService) {}

  @Get()
  list() {
    return this.collections.listPublic();
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.collections.findPublicBySlug(slug);
  }
}

@AdminOnly()
@ApiTags('Admin · Collections')
@Controller('admin/collections')
export class AdminCollectionController {
  constructor(private readonly collections: CollectionService) {}

  @Get()
  list() {
    return this.collections.listAll();
  }

  @Audit('collection.create', 'collection')
  @Post()
  create(@Body() body: CreateCollectionDto) {
    return this.collections.create(body);
  }

  @Audit('collection.update', 'collection', 'collectionId')
  @Patch(':collectionId')
  update(@Param('collectionId', ParseUUIDPipe) collectionId: string, @Body() body: UpdateCollectionDto) {
    return this.collections.update(collectionId, body);
  }

  @Audit('collection.status.update', 'collection', 'collectionId')
  @Patch(':collectionId/status')
  setStatus(@Param('collectionId', ParseUUIDPipe) collectionId: string, @Body() { isActive }: StatusDto) {
    return this.collections.setStatus(collectionId, isActive);
  }

  @Audit('collection.watches.add', 'collection', 'collectionId')
  @Post(':collectionId/watches')
  addWatches(@Param('collectionId', ParseUUIDPipe) collectionId: string, @Body() { watchIds }: AddCollectionWatchesDto) {
    return this.collections.addWatches(collectionId, watchIds);
  }

  @Audit('collection.watches.remove', 'collection', 'collectionId')
  @Delete(':collectionId/watches/:watchId')
  @HttpCode(HttpStatus.OK)
  removeWatch(@Param('collectionId', ParseUUIDPipe) collectionId: string, @Param('watchId', ParseUUIDPipe) watchId: string) {
    return this.collections.removeWatch(collectionId, watchId);
  }

  @Audit('collection.delete', 'collection', 'collectionId')
  @Delete(':collectionId')
  @HttpCode(HttpStatus.OK)
  remove(@Param('collectionId', ParseUUIDPipe) collectionId: string) {
    return this.collections.remove(collectionId);
  }
}
