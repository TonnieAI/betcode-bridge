import type { BillingCycle } from '@/lib/types';

const STORAGE_KEY = 'pending_checkout_selection';

export interface PendingCheckoutSelection {
  planId: string;
  billingCycle: BillingCycle;
}

export function savePendingCheckout(selection: PendingCheckoutSelection) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
}

export function getPendingCheckout(): PendingCheckoutSelection | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PendingCheckoutSelection>;

    if (!parsed.planId || (parsed.billingCycle !== 'monthly' && parsed.billingCycle !== 'yearly')) {
      return null;
    }

    return {
      planId: parsed.planId,
      billingCycle: parsed.billingCycle,
    };
  } catch {
    return null;
  }
}

export function clearPendingCheckout() {
  localStorage.removeItem(STORAGE_KEY);
}