import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { InventoryQueryDto, MovementQueryDto, StockAdjustmentDto, ThresholdDto } from './dto/inventory.dto.js';
import { InventoryService } from './inventory.service.js';
import { AdminOnly, Audit, CurrentUser } from '../../dependency/decorator/_INDEX.js';

@AdminOnly()
@ApiTags('Admin · Inventory')
@Controller('admin/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list(@Query() query: InventoryQueryDto) {
    return this.inventory.list(query);
  }

  @Get('low-stock')
  lowStock(@Query() query: InventoryQueryDto) {
    return this.inventory.lowStock(query);
  }

  @Get('variants/:variantId')
  get(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.inventory.getByVariant(variantId);
  }

  @Get('variants/:variantId/movements')
  movements(@Param('variantId', ParseUUIDPipe) variantId: string, @Query() query: MovementQueryDto) {
    return this.inventory.movementsOf(variantId, query);
  }

  @Audit('inventory.adjust', 'inventory')
  @Post('adjustments')
  adjust(@Body() body: StockAdjustmentDto, @CurrentUser('id') adminId: string) {
    return this.inventory.adjust(body, adminId);
  }

  @Audit('inventory.threshold.update', 'inventory', 'variantId')
  @Patch('variants/:variantId/threshold')
  setThreshold(@Param('variantId', ParseUUIDPipe) variantId: string, @Body() { lowStockThreshold }: ThresholdDto) {
    return this.inventory.setThreshold(variantId, lowStockThreshold);
  }
}
