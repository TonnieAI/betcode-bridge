import {
  createSupabaseAdminClient,
  getFlutterwaveApiBaseUrl,
  getFlutterwaveSecretKey,
  getFlutterwaveWebhookSecretHash,
  getPaymentCallbackUrl,
  getPaymentProvider,
  getStripeSecretKey,
  getStripeWebhookSecret,
  requireAuthenticatedUser,
} from '../_lib/supabase.js';
import {
  allowMethods,
  handleApiError,
  readJsonBody,
  sendError,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from '../_lib/http.js';
import { getPaymentProviderClient } from './providers/index.js';
import type { PaymentProviderName } from './providers/types.js';
import { resolvePaymentProvider } from '../_lib/globalConfig.js';
import { convertFromNgn } from '../_lib/pricing.js';

interface CheckoutRequestBody {
  planId?: string;
  plan_id?: string;
  billingCycle?: 'monthly' | 'yearly';
  billing_cycle?: 'monthly' | 'yearly';
  country?: string;
  currency?: string;
  paymentProvider?: string;
  payment_provider?: string;
}

function parseProvider(value: string | undefined): PaymentProviderName | null {
  if (!value) return null;
  if (value === 'stripe' || value === 'flutterwave') {
    return value;
  }
  if (value === 'paystack') {
    return value;
  }
  return null;
}

type ProviderConfigStatus = {
  ok: boolean;
  provider: PaymentProviderName;
  missing: string[];
};

function generateReference(userId: string) {
  const suffix = Math.random().toString(36).slice(2, 10).toUpperCase();
  const shortUser = userId.slice(0, 8).toUpperCase();
  return `BCB-${shortUser}-${Date.now()}-${suffix}`;
}

function resolveCallbackUrl(req: ApiRequest): string {
  try {
    return getPaymentCallbackUrl();
  } catch {
    const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
    const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
    const protoHeader = req.headers['x-forwarded-proto'];
    const proto = (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader) || 'https';

    if (!host) {
      throw new Error('Missing checkout callback host');
    }

    return `${proto}://${host}/profile`;
  }
}

function getCheckoutProviderConfigStatus(provider: PaymentProviderName): ProviderConfigStatus {
  if (provider === 'stripe') {
    const missing: string[] = [];
    const key = (process.env.STRIPE_SECRET_KEY || '').trim();
    const webhook = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
    const mode = (process.env.STRIPE_MODE || '').trim();
    const apiVersion = (process.env.STRIPE_API_VERSION || '').trim();

    if (!key) missing.push('STRIPE_SECRET_KEY');
    if (!webhook) missing.push('STRIPE_WEBHOOK_SECRET');
    if (!mode) missing.push('STRIPE_MODE');
    if (!apiVersion) missing.push('STRIPE_API_VERSION');

    if (key && mode === 'test' && !key.startsWith('sk_test_')) {
      missing.push('STRIPE_SECRET_KEY_MODE_MISMATCH');
    }

    if (key && mode === 'live' && !key.startsWith('sk_live_')) {
      missing.push('STRIPE_SECRET_KEY_MODE_MISMATCH');
    }

    // Keep existing key validation behavior in place.
    if (missing.length === 0) {
      getStripeSecretKey();
      getStripeWebhookSecret();
    }

    return {
      ok: missing.length === 0,
      provider,
      missing,
    };
  }

  if (provider === 'flutterwave') {
    const missing: string[] = [];
    const secret = (process.env.FLUTTERWAVE_SECRET_KEY || '').trim();
    const webhookHash = (process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH || '').trim();
    const apiBaseUrl = (process.env.FLUTTERWAVE_API_BASE_URL || '').trim();

    if (!secret) missing.push('FLUTTERWAVE_SECRET_KEY');
    if (!webhookHash) missing.push('FLUTTERWAVE_WEBHOOK_SECRET_HASH');
    if (!apiBaseUrl) missing.push('FLUTTERWAVE_API_BASE_URL');

    if (missing.length === 0) {
      getFlutterwaveSecretKey();
      getFlutterwaveWebhookSecretHash();
      getFlutterwaveApiBaseUrl();
    }

    return {
      ok: missing.length === 0,
      provider,
      missing,
    };
  }

  const paystackSecret = (process.env.PAYMENT_SECRET_KEY || '').trim();
  const missing = paystackSecret ? [] : ['PAYMENT_SECRET_KEY'];

  return {
    ok: missing.length === 0,
    provider,
    missing,
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!allowMethods(req, res, ['POST'])) return;

  try {
    const auth = await requireAuthenticatedUser(req);
    if (!auth.user) {
      sendError(res, 401, 'Authentication required', 'auth_required');
      return;
    }

    const body = await readJsonBody<CheckoutRequestBody>(req);
    const planId = (body.planId || body.plan_id || '').trim().toLowerCase();
    const billingCycle = body.billingCycle || body.billing_cycle || 'monthly';

    if (!planId) {
      sendError(res, 400, 'Invalid checkout request', 'invalid_plan_id');
      return;
    }

    if (!['monthly', 'yearly'].includes(billingCycle)) {
      sendError(res, 400, 'Invalid checkout request', 'invalid_billing_cycle');
      return;
    }

    const admin = createSupabaseAdminClient();

    const { data: profileContext } = await admin
      .from('profiles')
      .select('country,currency')
      .eq('id', auth.user.id)
      .maybeSingle();

    const resolvedCountry = (body.country || profileContext?.country || 'US').toUpperCase();
    const resolvedCurrency = (body.currency || profileContext?.currency || 'USD').toUpperCase();

    const baseProvider = parseProvider(getPaymentProvider()) || 'paystack';
    const requestedProvider = parseProvider(body.paymentProvider || body.payment_provider);
    const selectedProvider = requestedProvider || resolvePaymentProvider(resolvedCountry, resolvedCurrency, baseProvider);

    console.info('checkout_request', {
      endpoint: 'payments/checkout',
      planId,
      billingCycle,
      country: resolvedCountry,
      currency: resolvedCurrency,
      requestedProvider: requestedProvider || null,
    });

  const { data: plan, error: planError } = await admin
    .from('plans')
    .select('*')
    .eq('id', planId)
    .eq('is_active', true)
    .maybeSingle();

    if (planError || !plan) {
      sendError(res, 404, 'Checkout initialization failed', 'plan_not_found');
      return;
    }

    if (plan.id === 'free') {
      sendError(res, 400, 'Checkout initialization failed', 'free_plan_not_checkoutable');
      return;
    }

  const requestCountry = resolvedCountry;
  const requestCurrency = resolvedCurrency || (plan.currency || 'USD').toUpperCase();

  const { data: localizedPrice } = await admin
    .from('plan_localized_prices')
    .select('localized_price,currency,payment_provider')
    .eq('plan_id', plan.id)
    .eq('country', requestCountry)
    .eq('currency', requestCurrency)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

    const providerFromPrice = parseProvider(localizedPrice?.payment_provider) || selectedProvider;

    let resolvedAmountBase: number;
    let resolvedCheckoutCurrency: string;
    const planCurrency = String(plan.currency || 'NGN').toUpperCase();

    if (localizedPrice?.localized_price != null) {
      resolvedAmountBase = Number(localizedPrice.localized_price);
      resolvedCheckoutCurrency = String(localizedPrice.currency || requestCurrency).toUpperCase();
    } else if (planCurrency === requestCurrency) {
      resolvedAmountBase = Number(plan.localized_price ?? plan.price);
      resolvedCheckoutCurrency = requestCurrency;
    } else if (planCurrency === 'NGN') {
      resolvedAmountBase = convertFromNgn(Number(plan.price), requestCurrency);
      resolvedCheckoutCurrency = requestCurrency;
      console.info('checkout_price_fallback', {
        endpoint: 'payments/checkout',
        planId,
        sourceCurrency: 'NGN',
        targetCurrency: requestCurrency,
      });
    } else {
      sendError(res, 400, 'Pricing unavailable for selected region', 'pricing_unavailable');
      return;
    }

    const amount = billingCycle === 'yearly' ? resolvedAmountBase * 12 : resolvedAmountBase;
    const currency = resolvedCheckoutCurrency;

    console.info('checkout_provider_resolution', {
      endpoint: 'payments/checkout',
      planId,
      billingCycle,
      selectedCurrency: currency,
      selectedProvider: providerFromPrice,
    });

    const providerConfigStatus = getCheckoutProviderConfigStatus(providerFromPrice);

    console.info('checkout_provider_config', {
      endpoint: 'payments/checkout',
      provider: providerConfigStatus.provider,
      requestedCountry: requestCountry,
      requestedCurrency: requestCurrency,
      envExists: {
        STRIPE_SECRET_KEY: Boolean((process.env.STRIPE_SECRET_KEY || '').trim()),
        STRIPE_WEBHOOK_SECRET: Boolean((process.env.STRIPE_WEBHOOK_SECRET || '').trim()),
        STRIPE_MODE: Boolean((process.env.STRIPE_MODE || '').trim()),
        STRIPE_API_VERSION: Boolean((process.env.STRIPE_API_VERSION || '').trim()),
        FLUTTERWAVE_SECRET_KEY: Boolean((process.env.FLUTTERWAVE_SECRET_KEY || '').trim()),
        FLUTTERWAVE_WEBHOOK_SECRET_HASH: Boolean((process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH || '').trim()),
        FLUTTERWAVE_API_BASE_URL: Boolean((process.env.FLUTTERWAVE_API_BASE_URL || '').trim()),
        PAYMENT_SECRET_KEY: Boolean((process.env.PAYMENT_SECRET_KEY || '').trim()),
      },
      missing: providerConfigStatus.missing,
    });

    if (!providerConfigStatus.ok) {
      console.error('api_error', {
        endpoint: 'payments/checkout',
        errorType: 'provider_config_invalid',
        statusCode: 500,
      });
      sendJson(res, 500, {
        error: 'Payment provider configuration missing',
        code: 'provider_config_invalid',
        provider: providerConfigStatus.provider,
        details: providerConfigStatus.missing,
      });
      return;
    }

    const provider = getPaymentProviderClient(providerFromPrice);

    if (!provider.supportedCurrencies.includes(currency)) {
      sendError(res, 400, 'Checkout initialization failed', 'unsupported_currency_for_provider');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      sendError(res, 400, 'Checkout initialization failed', 'invalid_amount');
      return;
    }

    const reference = generateReference(auth.user.id);
    const callbackUrl = resolveCallbackUrl(req);

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
      console.error('api_error', {
        endpoint: 'payments/checkout',
        errorType: 'subscription_insert_failed',
        statusCode: 500,
      });
      sendError(res, 500, 'Unable to create checkout session', 'subscription_create_failed', 'Failed to create subscription record.');
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
      console.error('api_error', {
        endpoint: 'payments/checkout',
        errorType: 'payment_insert_failed',
        statusCode: 500,
      });
      sendError(res, 500, 'Unable to create checkout session', 'payment_create_failed', 'Failed to create payment record.');
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
    } catch {
      await admin.from('subscriptions').update({ subscription_status: 'failed' }).eq('id', newSubscription.id);
      await admin.from('payments').update({ status: 'failed' }).eq('gateway_reference', reference);

      console.error('api_error', {
        endpoint: 'payments/checkout',
        errorType: 'provider_initialize_failed',
        statusCode: 502,
      });
      sendError(res, 502, 'Unable to create checkout session', 'provider_initialize_failed', 'Payment provider could not initialize checkout.');
      return;
    }
  } catch (error) {
    console.error('checkout_unhandled', {
      endpoint: 'payments/checkout',
      errorType: error instanceof Error ? error.name : typeof error,
      statusCode: 500,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    handleApiError(res, 'payments/checkout', error, 500);
  }
}
