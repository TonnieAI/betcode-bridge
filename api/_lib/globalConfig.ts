export type PaymentProviderName = 'paystack' | 'stripe' | 'flutterwave';

export const SUPPORTED_CURRENCIES = ['USD', 'GBP', 'EUR', 'NGN', 'ZAR', 'GHS', 'KES', 'MZN'] as const;

export const PROVIDER_BY_CURRENCY: Record<string, PaymentProviderName> = {
  USD: 'stripe',
  GBP: 'stripe',
  EUR: 'stripe',
  NGN: 'paystack',
  ZAR: 'flutterwave',
  GHS: 'paystack',
  KES: 'flutterwave',
  MZN: 'flutterwave',
};

export const PROVIDER_BY_COUNTRY: Record<string, PaymentProviderName> = {
  US: 'stripe',
  GB: 'stripe',
  FR: 'stripe',
  ZA: 'flutterwave',
  GH: 'paystack',
  KE: 'flutterwave',
  MZ: 'flutterwave',
  NG: 'paystack',
};

export function resolvePaymentProvider(country: string | null | undefined, currency: string | null | undefined, fallback: PaymentProviderName): PaymentProviderName {
  const normalizedCountry = (country || '').toUpperCase();
  const normalizedCurrency = (currency || '').toUpperCase();

  return PROVIDER_BY_CURRENCY[normalizedCurrency] || PROVIDER_BY_COUNTRY[normalizedCountry] || fallback;
}
