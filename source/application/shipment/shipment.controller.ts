import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, type RawBodyRequest } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiParam, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';

import { ShipmentService } from './shipment.service.js';
import { CreateShipmentDto, ShipmentQueryDto, ShipmentStatusDto } from '../shipping/dto/shipping.dto.js';
import { AdminOnly, Audit, CurrentUser } from '../../dependency/decorator/_INDEX.js';

@ApiTags('Shipping')
@Controller('shipping')
export class ShipmentController {
  constructor(private readonly shipments: ShipmentService) {}

  /** Public by design: the tracking number is the secret, and the response carries no personal data. */
  @Get('track/:trackingNumber')
  track(@Param('trackingNumber') trackingNumber: string) {
    return this.shipments.track(trackingNumber);
  }

  /** Carrier callback. Authenticated by the provider's signature over the raw body, not by a user token. */
  @SkipThrottle()
  @ApiParam({ name: 'provider', enum: ['mock'], description: 'Registered shipping provider' })
  @ApiHeader({ name: 'x-mock-signature', required: true, description: 'Hex HMAC-SHA256 of the raw request body, keyed with the provider webhook secret' })
  @ApiBody({ schema: { type: 'object', example: { eventId: 'evt_456', trackingNumber: 'HX123456789', status: 'delivered', location: 'Alexandria' } } })
  @ApiOkResponse({ description: 'Processed, or acknowledged as a duplicate/ignored event (`applied: false` / `duplicate: true`)' })
  @ApiUnauthorizedResponse({ description: 'Signature missing or invalid' })
  @Post('webhooks/:provider')
  @HttpCode(HttpStatus.OK)
  webhook(@Param('provider') provider: string, @Req() request: RawBodyRequest<Request>) {
    return this.shipments.handleWebhook(provider, request.rawBody ?? Buffer.alloc(0), request.headers);
  }
}

@AdminOnly()
@ApiTags('Admin · Shipments')
@Controller('admin/shipments')
export class AdminShipmentController {
  constructor(private readonly shipments: ShipmentService) {}

  @Get()
  list(@Query() query: ShipmentQueryDto) {
    return this.shipments.list(query);
  }

  @Get(':shipmentId')
  get(@Param('shipmentId', ParseUUIDPipe) shipmentId: string) {
    return this.shipments.get(shipmentId);
  }

  @Audit('shipment.create', 'shipment')
  @Post()
  create(@CurrentUser('id') adminId: string, @Body() { orderId, ...input }: CreateShipmentDto) {
    return this.shipments.createForOrder(orderId, input, adminId);
  }

  @Audit('shipment.status.update', 'shipment', 'shipmentId')
  @Patch(':shipmentId/status')
  updateStatus(@Param('shipmentId', ParseUUIDPipe) shipmentId: string, @Body() body: ShipmentStatusDto) {
    return this.shipments.adminUpdateStatus(shipmentId, body);
  }
}
