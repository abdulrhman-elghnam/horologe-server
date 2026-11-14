import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';

import { ShippingMethodRepository } from '../../database/repository/shipping-method.repository.js';

const DEFAULT_METHODS = [
  { code: 'standard', name: 'Standard delivery', basePrice: 10, freeShippingThreshold: 500, internationalSurcharge: 25, estimatedDays: 5 },
  { code: 'express', name: 'Express delivery', basePrice: 25, freeShippingThreshold: null, internationalSurcharge: 40, estimatedDays: 2 },
];

/** Creates the default shipping methods on first start (the API has no route to create them). */
@Injectable()
export class ShippingMethodSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(ShippingMethodSeeder.name);

  constructor(private readonly methods: ShippingMethodRepository) {}

  async onApplicationBootstrap() {
    if ((await this.methods.count()) > 0) return;
    await this.methods.createMany({ data: DEFAULT_METHODS });
    this.logger.log(`Created ${DEFAULT_METHODS.length} default shipping methods`);
  }
}
