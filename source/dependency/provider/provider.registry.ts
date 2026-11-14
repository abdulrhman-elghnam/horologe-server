import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PAYMENT_PROVIDERS, type PaymentProvider } from './payment-provider.interface.js';
import { SHIPPING_PROVIDERS, type ShippingProvider } from './shipping-provider.interface.js';

/** Looks up payment/shipping adapters by name (the `:provider` route param). */
@Injectable()
export class ProviderRegistry {
  private readonly payment: Map<string, PaymentProvider>;
  private readonly shipping: Map<string, ShippingProvider>;

  constructor(
    @Inject(PAYMENT_PROVIDERS) payment: PaymentProvider[],
    @Inject(SHIPPING_PROVIDERS) shipping: ShippingProvider[],
    private readonly config: ConfigService,
  ) {
    this.payment = new Map(payment.map((provider) => [provider.name, provider]));
    this.shipping = new Map(shipping.map((provider) => [provider.name, provider]));
  }

  paymentProvider(name?: string): PaymentProvider {
    const provider = this.payment.get(name ?? this.config.get<string>('payment.defaultProvider', 'mock'));
    if (!provider) throw new NotFoundException('Payment provider not found');
    return provider;
  }

  paymentProviderNames(): string[] {
    return [...this.payment.keys()];
  }

  shippingProvider(name?: string): ShippingProvider {
    const provider = this.shipping.get(name ?? this.config.get<string>('shipping.provider', 'mock'));
    if (!provider) throw new NotFoundException('Shipping provider not found');
    return provider;
  }
}
