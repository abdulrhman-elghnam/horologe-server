import { Global, Module } from '@nestjs/common';

import { MockPaymentProvider } from './mock-payment.provider.js';
import { MockShippingProvider } from './mock-shipping.provider.js';
import { PAYMENT_PROVIDERS } from './payment-provider.interface.js';
import { ProviderRegistry } from './provider.registry.js';
import { SHIPPING_PROVIDERS } from './shipping-provider.interface.js';

/** Register real gateways/carriers here next to the mocks. */
@Global()
@Module({
  providers: [
    MockPaymentProvider,
    MockShippingProvider,
    { provide: PAYMENT_PROVIDERS, useFactory: (...providers) => providers, inject: [MockPaymentProvider] },
    { provide: SHIPPING_PROVIDERS, useFactory: (...providers) => providers, inject: [MockShippingProvider] },
    ProviderRegistry,
  ],
  exports: [ProviderRegistry],
})
export class ProviderModule {}
