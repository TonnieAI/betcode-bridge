import {
  createSupabaseAdminClient,
  getPaymentCallbackUrl,
  getPaymentProvider,
  requireAuthenticatedUser,
} from '../_lib/supabase.js';
import { allowMethods, readJsonBody, sendJson, type ApiRequest, type ApiResponse } from '../_lib/http.js';
import { getPaymentProviderClient } from './providers/index.js';
import type { PaymentProviderName } from './providers/types.js';
import { resolvePaymentProvider } from '../_lib/globalConfig.js';

interface CheckoutRequestBody {
  planId?: string;
  billingCycle?: 'monthly' | 'yearly';
  country?: string;
  currency?: string;
}

function normalizeProvider(value: string): PaymentProviderName {
  if (value === 'stripe' || value === 'flutterwave') {
    return value;
  }
  return 'paystack';
}

function generateReference(userId: string) {
  const suffix = Math.random().toString(36).slice(2, 10).toUpperCase();
  const shortUser = userId.slice(0, 8).toUpperCase();
  return `BCB-${shortUser}-${Date.now()}-${suffix}`;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!allowMethods(req, res, ['POST'])) return;

  const auth = await requireAuthenticatedUser(req);
  if (!auth.user) {
    sendJson(res, 401, { success: false, message: 'Authentication required' });
    return;
  }

  const body = await readJsonBody<CheckoutRequestBody>(req);
  const planId = (body.planId || '').trim().toLowerCase();
  const billingCycle = body.billingCycle || 'monthly';

  if (!planId) {
    sendJson(res, 400, { success: false, message: 'Invalid checkout request' });
    return;
  }

  if (!['monthly', 'yearly'].includes(billingCycle)) {
    sendJson(res, 400, { success: false, message: 'Invalid checkout request' });
    return;
  }

  const admin = createSupabaseAdminClient();
  const baseProvider = normalizeProvider(getPaymentProvider());
  const selectedProvider = resolvePaymentProvider(body.country, body.currency, baseProvider);

  const { data: plan, error: planError } = await admin
    .from('plans')
    .select('*')
    .eq('id', planId)
    .eq('is_active', true)
    .maybeSingle();

  if (planError || !plan) {
    sendJson(res, 404, { success: false, message: 'Checkout initialization failed' });
    return;
  }

  if (plan.id === 'free') {
    sendJson(res, 400, { success: false, message: 'Checkout initialization failed' });
    return;
  }

  const requestCountry = (body.country || 'GLOBAL').toUpperCase();
  const requestCurrency = (body.currency || plan.currency || 'USD').toUpperCase();

  const { data: localizedPrice } = await admin
    .from('plan_localized_prices')
    .select('localized_price,currency,payment_provider')
    .eq('plan_id', plan.id)
    .eq('country', requestCountry)
    .eq('currency', requestCurrency)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  const providerFromPrice = normalizeProvider(localizedPrice?.payment_provider || selectedProvider);
  const amountBase = Number(localizedPrice?.localized_price ?? plan.localized_price ?? plan.price);
  const amount = billingCycle === 'yearly' ? amountBase * 12 : amountBase;
  const currency = (localizedPrice?.currency || requestCurrency || plan.currency || 'USD').toUpperCase();
  const provider = getPaymentProviderClient(providerFromPrice);

  if (!provider.supportedCurrencies.includes(currency)) {
    sendJson(res, 400, { success: false, message: 'Checkout initialization failed' });
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    sendJson(res, 400, { success: false, message: 'Checkout initialization failed' });
    return;
  }

  const reference = generateReference(auth.user.id);
  const callbackUrl = getPaymentCallbackUrl();

  const { data: existingPending } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', auth.user.id)
    .eq('subscription_status', 'pending');

  if (existingPending && existingPending.length > 0) {
    const pendingIds = existingPending.map((row: { id: string }) => row.id);

    await admin
      .from('subscriptions')
      .update({ subscription_status: 'cancelled', cancelled_at: new Date().toISOString() })
      .in('id', pendingIds);

    await admin
      .from('payments')
      .update({ status: 'cancelled' })
      .in('subscription_id', pendingIds);
  }

  const { data: newSubscription, error: subscriptionError } = await admin
    .from('subscriptions')
    .insert({
      user_id: auth.user.id,
      plan_id: plan.id,
      payment_provider: providerFromPrice,
      transaction_reference: reference,
      subscription_status: 'pending',
      amount,
      currency,
      billing_cycle: billingCycle,
      metadata: {
        initiated_from: 'checkout_api',
        selected_country: requestCountry,
        selected_currency: requestCurrency,
        resolved_provider: providerFromPrice,
      },
    })
    .select('id')
    .single();

  if (subscriptionError || !newSubscription) {
    console.error('checkout: failed to create pending subscription', {
      userId: auth.user.id,
      planId,
      error: subscriptionError?.message,
    });
    sendJson(res, 500, { success: false, message: 'Checkout initialization failed' });
    return;
  }

  const { error: paymentInsertError } = await admin
    .from('payments')
    .insert({
      user_id: auth.user.id,
      subscription_id: newSubscription.id,
      gateway_reference: reference,
      amount,
      status: 'pending',
      payment_provider: providerFromPrice,
      currency,
      metadata: {
        initialized_by: 'checkout_api',
      },
    });

  if (paymentInsertError) {
    console.error('checkout: failed to create pending payment', {
      userId: auth.user.id,
      planId,
      reference,
      error: paymentInsertError.message,
    });
    sendJson(res, 500, { success: false, message: 'Checkout initialization failed' });
    return;
  }

  try {
    const initialized = await provider.initializePayment({
      email: auth.user.email,
      amountMajor: amount,
      currency,
      reference,
      callbackUrl,
      metadata: {
        user_id: auth.user.id,
        plan_id: plan.id,
        subscription_id: newSubscription.id,
        billing_cycle: billingCycle,
        country: requestCountry,
        currency,
      },
    });

    sendJson(res, 200, {
      authorizationUrl: initialized.authorizationUrl,
      reference,
    });
    return;
  } catch (error) {
    await admin.from('subscriptions').update({ subscription_status: 'failed' }).eq('id', newSubscription.id);
    await admin.from('payments').update({ status: 'failed' }).eq('gateway_reference', reference);

    console.error('checkout: provider initialize failed', {
      userId: auth.user.id,
      planId,
      reference,
      provider: providerFromPrice,
      message: error instanceof Error ? error.message : 'Unknown provider error',
    });
    sendJson(res, 502, { success: false, message: 'Checkout initialization failed' });
    return;
  }
}
