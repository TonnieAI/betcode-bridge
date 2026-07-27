import type { BillingCycle } from '@/lib/types';

const NGN_EQUIVALENT_BY_CURRENCY: Record<string, number> = {
  NGN: 1,
  USD: 1 / 500,
  GBP: 1 / 625,
  EUR: 1 / 557,
  ZAR: 1 / 28,
  GHS: 1 / 52,
  KES: 1 / 3.85,
  MZN: 1 / 7.8,
};

export function convertFromNgn(nairaAmount: number, currency: string): number {
  const normalizedCurrency = currency.toUpperCase();
  const rate = NGN_EQUIVALENT_BY_CURRENCY[normalizedCurrency] ?? NGN_EQUIVALENT_BY_CURRENCY.USD;
  const converted = nairaAmount * rate;
  return Number(converted.toFixed(2));
}

export function applyBillingCycle(amount: number, billingCycle: BillingCycle): number {
  return billingCycle === 'yearly' ? amount * 12 : amount;
}

export const PRICE_DISPLAY_CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'] as const;
