import type { PaymentProvider, PaymentProviderName } from './types.js';
import { PaystackProvider } from './paystack.js';
import { StripeProvider } from './stripe.js';
import { FlutterwaveProvider } from './flutterwave.js';

export function getPaymentProviderClient(name: PaymentProviderName): PaymentProvider {
  switch (name) {
    case 'paystack':
      return new PaystackProvider();
    case 'stripe':
      return new StripeProvider();
    case 'flutterwave':
      return new FlutterwaveProvider();
    default:
      return new PaystackProvider();
  }
}
