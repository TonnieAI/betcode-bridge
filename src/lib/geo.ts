export type SupportedLanguage = 'en' | 'pt' | 'fr';

export interface CountryOption {
  code: string;
  name: string;
  region: string;
  defaultCurrency: string;
  supportedCurrencies: string[];
  preferredPaymentProvider: 'paystack' | 'stripe' | 'flutterwave';
}

export const SUPPORTED_CURRENCIES = ['USD', 'GBP', 'EUR', 'NGN', 'ZAR', 'GHS', 'KES', 'MZN'] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const SUPPORTED_LANGUAGES: Array<{ code: SupportedLanguage; label: string; flag: string }> = [
  { code: 'en', label: 'English', flag: 'GB' },
  { code: 'pt', label: 'Portuguese', flag: 'PT' },
  { code: 'fr', label: 'French', flag: 'FR' },
];

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'US', name: 'United States', region: 'North America', defaultCurrency: 'USD', supportedCurrencies: ['USD'], preferredPaymentProvider: 'stripe' },
  { code: 'GB', name: 'United Kingdom', region: 'Europe', defaultCurrency: 'GBP', supportedCurrencies: ['GBP', 'EUR'], preferredPaymentProvider: 'stripe' },
  { code: 'FR', name: 'France', region: 'Europe', defaultCurrency: 'EUR', supportedCurrencies: ['EUR'], preferredPaymentProvider: 'stripe' },
  { code: 'ZA', name: 'South Africa', region: 'Africa', defaultCurrency: 'ZAR', supportedCurrencies: ['ZAR', 'USD'], preferredPaymentProvider: 'flutterwave' },
  { code: 'GH', name: 'Ghana', region: 'Africa', defaultCurrency: 'GHS', supportedCurrencies: ['GHS', 'USD'], preferredPaymentProvider: 'paystack' },
  { code: 'KE', name: 'Kenya', region: 'Africa', defaultCurrency: 'KES', supportedCurrencies: ['KES', 'USD'], preferredPaymentProvider: 'flutterwave' },
  { code: 'MZ', name: 'Mozambique', region: 'Africa', defaultCurrency: 'MZN', supportedCurrencies: ['MZN', 'USD', 'EUR'], preferredPaymentProvider: 'flutterwave' },
  { code: 'NG', name: 'Nigeria', region: 'Africa', defaultCurrency: 'NGN', supportedCurrencies: ['NGN', 'USD'], preferredPaymentProvider: 'paystack' },
];

export function getCountryOption(code: string | null | undefined): CountryOption {
  const normalized = (code || '').toUpperCase();
  return COUNTRY_OPTIONS.find((country) => country.code === normalized) || COUNTRY_OPTIONS[0];
}

export function getCurrencySymbol(currency: string): string {
  const map: Record<string, string> = {
    USD: '$',
    GBP: '£',
    EUR: '€',
    NGN: '₦',
    ZAR: 'R',
    GHS: 'GH₵',
    KES: 'KSh',
    MZN: 'MT',
  };

  return map[currency.toUpperCase()] || currency.toUpperCase();
}
