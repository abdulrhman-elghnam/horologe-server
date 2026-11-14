import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CartService } from './cart.service.js';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto.js';
import { Auth, CurrentUser } from '../../dependency/decorator/_INDEX.js';

@Auth()
@ApiTags('Cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get(@CurrentUser('id') userId: string) {
    return this.cart.getCart(userId);
  }

  @Post('items')
  add(@CurrentUser('id') userId: string, @Body() body: AddCartItemDto) {
    return this.cart.addItem(userId, body);
  }

  @Patch('items/:itemId')
  update(@CurrentUser('id') userId: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() { quantity }: UpdateCartItemDto) {
    return this.cart.updateItem(userId, itemId, quantity);
  }

  @Delete('items/:itemId')
  remove(@CurrentUser('id') userId: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.cart.removeItem(userId, itemId);
  }

  @Delete()
  clear(@CurrentUser('id') userId: string) {
    return this.cart.clear(userId);
  }
}
