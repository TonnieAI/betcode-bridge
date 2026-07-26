import type { PaymentProviderName } from './providers/types.js';

export function normalizeProvider(value: string): PaymentProviderName {
  if (value === 'stripe' || value === 'flutterwave') {
    return value;
  }
  return 'paystack';
}

export function detectProviderFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  fallback: PaymentProviderName,
): PaymentProviderName {
  if (headers['stripe-signature']) return 'stripe';
  if (headers['verif-hash'] || headers['x-flw-signature']) return 'flutterwave';
  if (headers['x-paystack-signature']) return 'paystack';
  return fallback;
}

export function buildEventKey(provider: PaymentProviderName, event: string, reference: string, status: string) {
  return `${provider}:${event}:${reference}:${status}`;
}

export function isDuplicateWebhookEventError(message: string | null | undefined): boolean {
  const text = (message || '').toLowerCase();
  return text.includes('duplicate') || text.includes('unique');
}
