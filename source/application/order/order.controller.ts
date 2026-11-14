import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';

import { CheckoutService } from './checkout.service.js';
import { AdminCancelOrderDto, AdminOrderQueryDto, CancelOrderDto, CheckoutDto, OrderQueryDto, ReturnOrderDto, UpdateOrderStatusDto } from './dto/order.dto.js';
import { OrderService } from './order.service.js';
import { AdminOnly, Auth, Audit, CurrentUser } from '../../dependency/decorator/_INDEX.js';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/;

@Auth()
@ApiTags('Orders')
@Controller('orders')
export class OrderController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly orders: OrderService,
  ) {}

  /** Send an `Idempotency-Key` header (8-100 chars) to make retries safe. */
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: '8-100 letters, numbers, dashes or underscores. Retrying with the same key returns the same order instead of creating a new one.',
    schema: { type: 'string', example: 'checkout-3f1c2a9e-7b4d' },
  })
  @Post('checkout')
  checkout(@CurrentUser('id') userId: string, @Body() body: CheckoutDto, @Headers('idempotency-key') idempotencyKey?: string) {
    if (idempotencyKey !== undefined && !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key must be 8-100 letters, numbers, dashes or underscores');
    }
    return this.checkoutService.checkout(userId, body, idempotencyKey);
  }

  @Get('my-orders')
  myOrders(@CurrentUser('id') userId: string, @Query() query: OrderQueryDto) {
    return this.orders.myOrders(userId, query);
  }

  @Get(':orderId')
  get(@CurrentUser('id') userId: string, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.orders.myOrder(userId, orderId);
  }

  @Post(':orderId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser('id') userId: string, @Param('orderId', ParseUUIDPipe) orderId: string, @Body() { reason }: CancelOrderDto) {
    return this.orders.cancelMine(userId, orderId, reason);
  }

  @Post(':orderId/return')
  @HttpCode(HttpStatus.OK)
  requestReturn(@CurrentUser('id') userId: string, @Param('orderId', ParseUUIDPipe) orderId: string, @Body() { reason }: ReturnOrderDto) {
    return this.orders.requestReturn(userId, orderId, reason);
  }
}

@AdminOnly()
@ApiTags('Admin · Orders')
@Controller('admin/orders')
export class AdminOrderController {
  constructor(private readonly orders: OrderService) {}

  @Get()
  list(@Query() query: AdminOrderQueryDto) {
    return this.orders.list(query);
  }

  @Get(':orderId')
  get(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.orders.get(orderId);
  }

  @Audit('order.status.update', 'order', 'orderId')
  @Patch(':orderId/status')
  updateStatus(@CurrentUser('id') adminId: string, @Param('orderId', ParseUUIDPipe) orderId: string, @Body() { status, note }: UpdateOrderStatusDto) {
    return this.orders.updateStatus(adminId, orderId, status, note);
  }

  @Audit('order.cancel', 'order', 'orderId')
  @Post(':orderId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser('id') adminId: string, @Param('orderId', ParseUUIDPipe) orderId: string, @Body() { reason }: AdminCancelOrderDto) {
    return this.orders.cancelAsAdmin(adminId, orderId, reason);
  }
}
