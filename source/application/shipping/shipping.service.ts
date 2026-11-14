import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EntityManager } from 'typeorm';

import type { ShippingMethod } from '../../database/model/shipping-method.model.js';
import { ShippingMethodRepository } from '../../database/repository/shipping-method.repository.js';
import { roundMoney } from '../../dependency/util/money.js';

export interface ShippingQuote {
  method: ShippingMethod;
  cost: number;
  estimatedDays: number;
  estimatedDelivery: string;
}

/** Shipping methods and price quotes. Shipments themselves live in ShipmentModule. */
@Injectable()
export class ShippingService {
  constructor(
    private readonly methods: ShippingMethodRepository,
    private readonly config: ConfigService,
  ) {}

  listActive() {
    return this.methods.find({ where: { isActive: true }, options: { order: { basePrice: 'ASC' } } });
  }

  async activeMethod(id: string, manager?: EntityManager): Promise<ShippingMethod> {
    const method = await this.methods.findOne({ where: { id, isActive: true }, manager });
    if (!method) throw new BadRequestException('Shipping method is not available');
    return method;
  }

  /**
   * cost = basePrice (+ internationalSurcharge outside the home country),
   * free when the subtotal reaches the method's freeShippingThreshold.
   */
  quote(method: ShippingMethod, { country, subtotal }: { country: string; subtotal: number }): ShippingQuote {
    const free = method.freeShippingThreshold !== null && subtotal >= method.freeShippingThreshold;
    const international = country.trim().toLowerCase() !== this.config.get<string>('shipping.homeCountry', 'egypt');
    const cost = free ? 0 : roundMoney(method.basePrice + (international ? method.internationalSurcharge : 0));

    const delivery = new Date();
    delivery.setUTCDate(delivery.getUTCDate() + method.estimatedDays);
    return { method, cost, estimatedDays: method.estimatedDays, estimatedDelivery: delivery.toISOString().slice(0, 10) };
  }

  async getMethod(id: string) {
    const method = await this.methods.findById({ id });
    if (!method) throw new NotFoundException('Shipping method not found');
    return method;
  }
}
