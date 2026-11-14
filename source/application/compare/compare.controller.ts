import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CompareService } from './compare.service.js';
import { WatchIdDto } from '../wishlist/dto/wishlist.dto.js';
import { Auth, CurrentUser } from '../../dependency/decorator/_INDEX.js';

@Auth()
@ApiTags('Compare')
@Controller('compare')
export class CompareController {
  constructor(private readonly compare: CompareService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.compare.list(userId);
  }

  @Post('items')
  add(@CurrentUser('id') userId: string, @Body() { watchId }: WatchIdDto) {
    return this.compare.add(userId, watchId);
  }

  @Delete('items/:watchId')
  remove(@CurrentUser('id') userId: string, @Param('watchId', ParseUUIDPipe) watchId: string) {
    return this.compare.remove(userId, watchId);
  }

  @Delete()
  clear(@CurrentUser('id') userId: string) {
    return this.compare.clear(userId);
  }
}
