import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { WatchIdDto } from './dto/wishlist.dto.js';
import { WishlistService } from './wishlist.service.js';
import { Auth, CurrentUser } from '../../dependency/decorator/_INDEX.js';

@Auth()
@ApiTags('Wishlist')
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.wishlist.list(userId);
  }

  @Post('items')
  add(@CurrentUser('id') userId: string, @Body() { watchId }: WatchIdDto) {
    return this.wishlist.add(userId, watchId);
  }

  @Delete('items/:watchId')
  remove(@CurrentUser('id') userId: string, @Param('watchId', ParseUUIDPipe) watchId: string) {
    return this.wishlist.remove(userId, watchId);
  }

  @Delete()
  clear(@CurrentUser('id') userId: string) {
    return this.wishlist.clear(userId);
  }
}
