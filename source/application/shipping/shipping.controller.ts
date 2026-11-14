import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CalculateShippingDto } from './dto/shipping.dto.js';
import { ShippingService } from './shipping.service.js';
import { CartService } from '../cart/cart.service.js';
import { AddressRepository } from '../../database/repository/address.repository.js';
import { Auth, CurrentUser } from '../../dependency/decorator/_INDEX.js';
import { sumMoney } from '../../dependency/util/money.js';

@ApiTags('Shipping')
@Controller('shipping')
export class ShippingController {
  constructor(
    private readonly shipping: ShippingService,
    private readonly cart: CartService,
    private readonly addresses: AddressRepository,
  ) {}

  @Get('methods')
  methods() {
    return this.shipping.listActive();
  }

  /** Quote for the customer's current cart delivered to one of their addresses. */
  @Auth()
  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  async calculate(@CurrentUser('id') userId: string, @Body() { addressId, shippingMethodId }: CalculateShippingDto) {
    const address = await this.addresses.findOne({ where: { id: addressId, userId } });
    if (!address) throw new NotFoundException('Address not found');

    const [method, lines] = await Promise.all([this.shipping.activeMethod(shippingMethodId), this.cart.getCheckoutLines(userId)]);
    return this.shipping.quote(method, { country: address.country, subtotal: sumMoney(lines.map((line) => line.lineTotal)) });
  }
}
