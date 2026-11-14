import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, type RawBodyRequest } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiParam, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';

import { InitializePaymentDto, RefundPaymentDto } from './dto/payment.dto.js';
import { PaymentService } from './payment.service.js';
import { AdminOnly, Auth, Audit, CurrentUser } from '../../dependency/decorator/_INDEX.js';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Auth()
  @Post('initialize')
  initialize(@CurrentUser('id') userId: string, @Body() { orderId, provider }: InitializePaymentDto) {
    return this.payments.initialize(userId, orderId, provider);
  }

  @Auth()
  @Get(':paymentId')
  get(@CurrentUser('id') userId: string, @Param('paymentId', ParseUUIDPipe) paymentId: string) {
    return this.payments.getMine(userId, paymentId);
  }

  /** Provider callback, authenticated by its signature over the raw body. */
  @SkipThrottle()
  @ApiParam({ name: 'provider', enum: ['mock'], description: 'Registered payment provider' })
  @ApiHeader({ name: 'x-mock-signature', required: true, description: 'Hex HMAC-SHA256 of the raw request body, keyed with the provider webhook secret' })
  @ApiBody({
    schema: {
      type: 'object',
      example: { eventId: 'evt_123', type: 'payment.succeeded', transactionId: 'mock_txn_abc', orderReference: '<orderId>', amount: 750, currency: 'USD' },
    },
  })
  @ApiOkResponse({ description: 'Processed, or acknowledged as a duplicate/ignored event (`applied: false` / `duplicate: true`)' })
  @ApiUnauthorizedResponse({ description: 'Signature missing or invalid' })
  @Post('webhooks/:provider')
  @HttpCode(HttpStatus.OK)
  webhook(@Param('provider') provider: string, @Req() request: RawBodyRequest<Request>) {
    return this.payments.handleWebhook(provider, request.rawBody ?? Buffer.alloc(0), request.headers);
  }
}

@AdminOnly()
@ApiTags('Admin · Payments')
@Controller('admin/payments')
export class AdminPaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Audit('payment.refund', 'payment', 'paymentId')
  @Post(':paymentId/refund')
  @HttpCode(HttpStatus.OK)
  refund(@Param('paymentId', ParseUUIDPipe) paymentId: string, @Body() { reason }: RefundPaymentDto) {
    return this.payments.refund(paymentId, reason);
  }
}
