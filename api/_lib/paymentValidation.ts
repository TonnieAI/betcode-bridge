import type { SupabaseClient } from '@supabase/supabase-js';

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  amount: number;
  currency: string;
  billing_cycle: 'monthly' | 'yearly';
  subscription_status: 'active' | 'pending' | 'failed' | 'cancelled' | 'expired';
  metadata: Record<string, unknown> | null;
}

interface PaymentRow {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'cancelled' | 'refunded';
  payment_provider: 'paystack' | 'flutterwave' | 'stripe';
}

export interface ActivationContext {
  subscription: SubscriptionRow;
  payment: PaymentRow;
  expectedAmount: number;
  expectedAmountMinor: number;
}

interface LoadOptions {
  reference: string;
  expectedUserId?: string;
}

export async function loadActivationContext(admin: SupabaseClient, options: LoadOptions): Promise<{ ok: true; context: ActivationContext } | { ok: false; reason: string }> {
  const { reference, expectedUserId } = options;

  const { data: subscription, error: subscriptionError } = await admin
    .from('subscriptions')
    .select('id,user_id,plan_id,amount,currency,billing_cycle,subscription_status,metadata')
    .eq('transaction_reference', reference)
    .maybeSingle();

  if (subscriptionError || !subscription) {
    return { ok: false, reason: 'reference_not_found' };
  }

  if (expectedUserId && subscription.user_id !== expectedUserId) {
    return { ok: false, reason: 'user_mismatch' };
  }

  if (subscription.subscription_status !== 'pending') {
    return { ok: false, reason: 'subscription_not_pending' };
  }

  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .select('id,user_id,amount,currency,status,payment_provider')
    .eq('gateway_reference', reference)
    .maybeSingle();

  if (paymentError || !payment) {
    return { ok: false, reason: 'payment_not_found' };
  }

  if (payment.user_id !== subscription.user_id) {
    return { ok: false, reason: 'payment_user_mismatch' };
  }

  if (payment.status !== 'pending') {
    return { ok: false, reason: 'payment_already_processed' };
  }

  const expectedAmount = Number(subscription.amount);

  if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
    return { ok: false, reason: 'invalid_expected_amount' };
  }

  if (Number(payment.amount) !== expectedAmount) {
    return { ok: false, reason: 'payment_amount_mismatch' };
  }

  return {
    ok: true,
    context: {
      subscription: subscription as SubscriptionRow,
      payment: payment as PaymentRow,
      expectedAmount,
      expectedAmountMinor: Math.round(expectedAmount * 100),
    },
  };
}

interface GatewayValidationInput {
  context: ActivationContext;
  gatewayAmountMinor?: number;
  gatewayCurrency?: string;
  gatewayMetadata?: Record<string, unknown>;
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function validateGatewayPaymentConsistency(input: GatewayValidationInput): { ok: true } | { ok: false; reason: string } {
  const { context, gatewayAmountMinor, gatewayCurrency, gatewayMetadata } = input;

  if (!Number.isFinite(gatewayAmountMinor ?? NaN)) {
    return { ok: false, reason: 'missing_gateway_amount' };
  }

  if (gatewayAmountMinor !== context.expectedAmountMinor) {
    return { ok: false, reason: 'gateway_amount_mismatch' };
  }

  const normalizedCurrency = (gatewayCurrency || '').toUpperCase();
  if (!normalizedCurrency) {
    return { ok: false, reason: 'missing_gateway_currency' };
  }

  if (normalizedCurrency !== String(context.subscription.currency || '').toUpperCase()) {
    return { ok: false, reason: 'currency_mismatch' };
  }

  if (!gatewayMetadata) {
    return { ok: false, reason: 'missing_gateway_metadata' };
  }

  const metadataUserId = normalizeString(gatewayMetadata.user_id);
  const metadataPlanId = normalizeString(gatewayMetadata.plan_id);
  const metadataSubscriptionId = normalizeString(gatewayMetadata.subscription_id);
  const metadataBillingCycle = normalizeString(gatewayMetadata.billing_cycle);
  const metadataCountry = normalizeString(gatewayMetadata.country);
  const metadataCurrency = normalizeString(gatewayMetadata.currency);
  const expectedCountry = normalizeString(context.subscription.metadata?.selected_country);
  const expectedCurrency = String(context.subscription.currency || '').toUpperCase();

  if (!metadataUserId || metadataUserId !== context.subscription.user_id) {
    return { ok: false, reason: 'metadata_user_mismatch' };
  }

  if (!metadataPlanId || metadataPlanId !== context.subscription.plan_id) {
    return { ok: false, reason: 'metadata_plan_mismatch' };
  }

  if (!metadataSubscriptionId || metadataSubscriptionId !== context.subscription.id) {
    return { ok: false, reason: 'metadata_subscription_mismatch' };
  }

  if (!metadataBillingCycle || metadataBillingCycle !== context.subscription.billing_cycle) {
    return { ok: false, reason: 'metadata_billing_cycle_mismatch' };
  }

  if (expectedCountry && (!metadataCountry || metadataCountry.toUpperCase() !== expectedCountry.toUpperCase())) {
    return { ok: false, reason: 'metadata_country_mismatch' };
  }

  if (!metadataCurrency || metadataCurrency.toUpperCase() !== expectedCurrency) {
    return { ok: false, reason: 'metadata_currency_mismatch' };
  }

  return { ok: true };
}
