import type { IncomingMessage } from 'http';
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
} from './_lib/supabase.js';
import {
  allowMethods,
  handleApiError,
  readJsonBody,
  readRawBody,
  sendError,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from './_lib/http.js';
import { loadActivationContext, validateGatewayPaymentConsistency } from './_lib/paymentValidation.js';
import { resolvePaymentProvider } from './_lib/globalConfig.js';
import { convertFromNgn, getCurrencySymbol } from './_lib/pricing.js';
import { getPaymentProviderClient } from './payments/providers/index.js';
import type { PaymentProviderName } from './payments/providers/types.js';
import { buildEventKey, detectProviderFromHeaders, isDuplicateWebhookEventError, normalizeProvider } from './payments/webhookUtils.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

type PaymentAction = 'checkout' | 'verify' | 'webhook' | 'overview';

function getAction(req: ApiRequest): PaymentAction | null {
  const url = new URL(req.url || '/', 'http://localhost');
  const action = (url.searchParams.get('action') || '').trim().toLowerCase();

  if (action === 'checkout' || action === 'verify' || action === 'webhook' || action === 'overview') {
    return action;
  }

  return null;
}

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

interface VerifyRequestBody {
  reference?: string;
}

type PlanRow = {
  id: string;
  name: string;
  price: number;
  currency: string;
  country?: string | null;
  currency_symbol?: string | null;
  payment_provider?: 'paystack' | 'flutterwave' | 'stripe' | null;
  localized_price?: number | null;
  duration: 'monthly' | 'yearly';
  usage_limit: number;
  features: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type LocalizedPriceRow = {
  plan_id: string;
  country: string;
  currency: string;
  currency_symbol: string;
  payment_provider: 'paystack' | 'flutterwave' | 'stripe';
  localized_price: number;
};

function parseProvider(value: string | undefined): PaymentProviderName | null {
  if (!value) return null;
  if (value === 'stripe' || value === 'flutterwave' || value === 'paystack') {
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

function headerPresent(headers: Record<string, string | string[] | undefined>, name: string): boolean {
  const raw = headers[name];
  if (Array.isArray(raw)) return Boolean(raw[0]);
  return Boolean(raw);
}

function assertProviderWebhookConfig(provider: 'stripe' | 'flutterwave'): void {
  if (provider === 'stripe') {
    const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
    const trimmed = secret.trim();

    console.info('webhook: provider configuration', {
      provider,
      exists: Boolean(trimmed),
      length: trimmed.length,
    });

    if (!trimmed) {
      getStripeWebhookSecret();
    }
    return;
  }

  const hash = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH || '';
  const trimmed = hash.trim();

  console.info('webhook: provider configuration', {
    provider,
    exists: Boolean(trimmed),
    length: trimmed.length,
  });

  if (!trimmed) {
    getFlutterwaveWebhookSecretHash();
  }
}

async function handleCheckout(req: ApiRequest, res: ApiResponse) {
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

async function handleVerify(req: ApiRequest, res: ApiResponse) {
  if (!allowMethods(req, res, ['POST'])) return;

  try {
    const auth = await requireAuthenticatedUser(req);
    if (!auth.user) {
      sendError(res, 401, 'Authentication required', 'auth_required');
      return;
    }

    const body = await readJsonBody<VerifyRequestBody>(req);
    const reference = (body.reference || '').trim();

    if (!reference) {
      sendError(res, 400, 'Payment verification failed', 'missing_reference');
      return;
    }

    const admin = createSupabaseAdminClient();

    const localValidation = await loadActivationContext(admin, {
      reference,
      expectedUserId: auth.user.id,
    });

    if (!localValidation.ok) {
      console.error('api_error', {
        endpoint: 'payments/verify',
        errorType: 'local_validation_failed',
        statusCode: 400,
      });
      sendError(res, 400, 'Payment verification failed', 'local_validation_failed');
      return;
    }

    const providerName = localValidation.context.payment.payment_provider;
    const provider = getPaymentProviderClient(providerName);

    let verification;
    try {
      verification = await provider.verifyPayment(reference);
    } catch {
      console.error('api_error', {
        endpoint: 'payments/verify',
        errorType: 'provider_verification_failed',
        statusCode: 502,
      });
      sendError(res, 502, 'Payment verification failed', 'provider_verification_failed');
      return;
    }

    const isSuccess = verification.ok;

    if (isSuccess) {
      const consistency = validateGatewayPaymentConsistency({
        context: localValidation.context,
        gatewayAmountMinor: verification.amountMinor ?? undefined,
        gatewayCurrency: verification.currency ?? undefined,
        gatewayMetadata: verification.metadata ?? undefined,
      });

      if (consistency.ok === false) {
        const rejectReason = consistency.reason;

        console.error('api_error', {
          endpoint: 'payments/verify',
          errorType: 'gateway_consistency_failed',
          statusCode: 400,
        });

        await admin
          .from('subscriptions')
          .update({ subscription_status: 'failed' })
          .eq('transaction_reference', reference)
          .eq('subscription_status', 'pending');

        await admin
          .from('payments')
          .update({
            status: 'failed',
            metadata: {
              reject_reason: rejectReason,
              verify_source: 'verify_endpoint',
            },
          })
          .eq('gateway_reference', reference)
          .eq('status', 'pending');

        sendError(res, 400, 'Payment verification failed', 'gateway_consistency_failed');
        return;
      }

      const { error: rpcError } = await admin.rpc('activate_subscription_by_reference', {
        p_transaction_reference: reference,
        p_payment_payload: verification.rawPayload,
      });

      if (rpcError) {
        console.error('api_error', {
          endpoint: 'payments/verify',
          errorType: 'activation_failed',
          statusCode: 500,
        });
        sendError(res, 500, 'Payment verification failed', 'activation_failed');
        return;
      }

      await admin
        .from('payments')
        .update({
          status: 'success',
          transaction_id: verification.gatewayTransactionId,
          payment_method: verification.paymentMethod,
          paid_at: verification.paidAt || new Date().toISOString(),
          metadata: verification.rawPayload,
        })
        .eq('gateway_reference', reference);

      sendJson(res, 200, {
        success: true,
        status: 'active',
        reference,
      });
      return;
    }

    const failedStatus = verification.status === 'abandoned' ? 'cancelled' : 'failed';

    await admin
      .from('subscriptions')
      .update({ subscription_status: failedStatus })
      .eq('transaction_reference', reference)
      .eq('user_id', auth.user.id)
      .eq('subscription_status', 'pending');

    await admin
      .from('payments')
      .update({
        status: failedStatus,
        metadata: verification.rawPayload,
      })
      .eq('gateway_reference', reference)
      .eq('user_id', auth.user.id)
      .eq('status', 'pending');

    sendJson(res, 200, {
      success: false,
      status: failedStatus,
      reference,
    });
  } catch (error) {
    handleApiError(res, 'payments/verify', error, 500);
  }
}

async function handleWebhook(req: ApiRequest, res: ApiResponse) {
  if (!allowMethods(req, res, ['POST'])) return;

  try {
    const receivedAt = new Date().toISOString();

    const fallbackProvider = normalizeProvider(getPaymentProvider());
    const providerName = detectProviderFromHeaders(req.headers, fallbackProvider);
    const provider = getPaymentProviderClient(providerName);

    const hasStripeSignatureHeader = headerPresent(req.headers, 'stripe-signature');
    const hasFlutterwaveVerifHashHeader = headerPresent(req.headers, 'verif-hash');

    if (providerName === 'stripe' || providerName === 'flutterwave') {
      try {
        assertProviderWebhookConfig(providerName);
      } catch {
        console.error('api_error', {
          endpoint: 'payments/webhook',
          errorType: `${providerName}_config_invalid`,
          statusCode: 500,
        });
        const message = providerName === 'stripe'
          ? 'Stripe webhook backend configuration error'
          : 'Flutterwave webhook backend configuration error';
        sendError(res, 500, message, 'provider_config_invalid');
        return;
      }
    }

    console.info('webhook: received', {
      receivedAt,
      provider: providerName,
      hasStripeSignatureHeader,
      hasFlutterwaveVerifHashHeader,
    });

    const rawBody = await readRawBody(req as IncomingMessage);
    const webhook = provider.handleWebhook(rawBody, req.headers);

    console.info('webhook: signature verification', {
      receivedAt,
      provider: providerName,
      hasStripeSignatureHeader,
      hasFlutterwaveVerifHashHeader,
      passed: webhook.signatureValid,
    });

    if (!webhook.signatureValid) {
      sendError(res, 401, 'Webhook processing failed', 'invalid_signature');
      return;
    }

    const transaction = webhook.transaction;
    const eventType = transaction.eventType || 'unknown';
    const reference = transaction.reference || '';
    const status = transaction.status || 'unknown';

    if (!reference) {
      sendJson(res, 200, { received: true, ignored: true, reason: 'No reference in payload' });
      return;
    }

    const admin = createSupabaseAdminClient();

    const eventKey = buildEventKey(providerName, eventType, reference, status);

    const { error: eventInsertError } = await admin
      .from('payment_webhook_events')
      .insert({
        provider: providerName,
        event_key: eventKey,
        event_type: eventType,
        payload: transaction.rawPayload,
      });

    if (eventInsertError) {
      const duplicate = isDuplicateWebhookEventError(eventInsertError.message);

      if (duplicate) {
        sendJson(res, 200, { received: true, deduplicated: true });
        return;
      }

      console.error('api_error', {
        endpoint: 'payments/webhook',
        errorType: 'event_persist_failed',
        statusCode: 500,
      });
      sendError(res, 500, 'Webhook processing failed', 'event_persist_failed');
      return;
    }

    if (transaction.ok) {
      const localValidation = await loadActivationContext(admin, { reference });
      if (!localValidation.ok) {
        console.error('api_error', {
          endpoint: 'payments/webhook',
          errorType: 'local_validation_failed',
          statusCode: 200,
        });
        sendJson(res, 200, { received: true, ignored: true });
        return;
      }

      const consistency = validateGatewayPaymentConsistency({
        context: localValidation.context,
        gatewayAmountMinor: transaction.amountMinor ?? undefined,
        gatewayCurrency: transaction.currency ?? undefined,
        gatewayMetadata: transaction.metadata ?? undefined,
      });

      if (consistency.ok === false) {
        const rejectReason = consistency.reason;

        console.error('api_error', {
          endpoint: 'payments/webhook',
          errorType: 'gateway_consistency_failed',
          statusCode: 200,
        });

        await admin
          .from('subscriptions')
          .update({ subscription_status: 'failed' })
          .eq('transaction_reference', reference)
          .eq('subscription_status', 'pending');

        await admin
          .from('payments')
          .update({
            status: 'failed',
            metadata: {
              reject_reason: rejectReason,
              verify_source: 'webhook',
            },
          })
          .eq('gateway_reference', reference)
          .eq('status', 'pending');

        sendJson(res, 200, { received: true, rejected: true });
        return;
      }

      const { error: activateError } = await admin.rpc('activate_subscription_by_reference', {
        p_transaction_reference: reference,
        p_payment_payload: transaction.rawPayload,
      });

      if (activateError) {
        console.error('api_error', {
          endpoint: 'payments/webhook',
          errorType: 'activation_failed',
          statusCode: 500,
        });
        sendError(res, 500, 'Webhook processing failed', 'activation_failed');
        return;
      }

      await admin
        .from('payments')
        .update({
          status: 'success',
          transaction_id: transaction.gatewayTransactionId,
          payment_method: transaction.paymentMethod,
          paid_at: transaction.paidAt || new Date().toISOString(),
          metadata: transaction.rawPayload,
        })
        .eq('gateway_reference', reference)
        .eq('status', 'pending');
    } else if (status === 'failed' || status === 'cancelled' || status === 'abandoned') {
      const failedStatus = status === 'abandoned' ? 'cancelled' : 'failed';

      await admin
        .from('subscriptions')
        .update({
          subscription_status: failedStatus,
          ...(failedStatus === 'cancelled' ? { cancelled_at: new Date().toISOString() } : {}),
        })
        .eq('transaction_reference', reference)
        .eq('subscription_status', 'pending');

      await admin
        .from('payments')
        .update({
          status: failedStatus,
          metadata: transaction.rawPayload,
        })
        .eq('gateway_reference', reference)
        .eq('status', 'pending');
    }

    sendJson(res, 200, { received: true });
  } catch (error) {
    handleApiError(res, 'payments/webhook', error, 500);
  }
}

async function handleOverview(req: ApiRequest, res: ApiResponse) {
  if (!allowMethods(req, res, ['GET'])) return;

  try {
    const auth = await requireAuthenticatedUser(req);
    if (!auth.user) {
      sendError(res, 401, 'Authentication required', 'auth_required');
      return;
    }

    const admin = createSupabaseAdminClient();

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('country,currency')
      .eq('id', auth.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('api_error', {
        endpoint: 'payments/overview',
        errorType: 'profile_context_load_failed',
        statusCode: 200,
      });
    }

    const profileCountry = String(profile?.country || 'GLOBAL').toUpperCase();
    const profileCurrency = String(profile?.currency || '').toUpperCase();

    const [plansResult, localizedResult, subscriptionResult, paymentsResult] = await Promise.all([
      admin
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true }),
      profileCurrency
        ? admin
            .from('plan_localized_prices')
            .select('plan_id,country,currency,currency_symbol,payment_provider,localized_price')
            .eq('country', profileCountry)
            .eq('currency', profileCurrency)
            .eq('is_active', true)
        : Promise.resolve({ data: [], error: null }),
      admin
        .from('subscriptions')
        .select('*')
        .eq('user_id', auth.user.id)
        .in('subscription_status', ['active', 'pending', 'failed', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('payments')
        .select('*')
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (plansResult.error) {
      console.error('api_error', {
        endpoint: 'payments/overview',
        errorType: 'plans_load_failed',
        statusCode: 500,
      });
      sendError(res, 500, 'Failed to load billing overview', 'plans_load_failed');
      return;
    }

    if (localizedResult.error) {
      console.error('api_error', {
        endpoint: 'payments/overview',
        errorType: 'localized_prices_load_failed',
        statusCode: 500,
      });
      sendError(res, 500, 'Failed to load billing overview', 'localized_prices_load_failed');
      return;
    }

    if (subscriptionResult.error) {
      console.error('api_error', {
        endpoint: 'payments/overview',
        errorType: 'subscription_load_failed',
        statusCode: 500,
      });
      sendError(res, 500, 'Failed to load billing overview', 'subscription_load_failed');
      return;
    }

    if (paymentsResult.error) {
      console.error('api_error', {
        endpoint: 'payments/overview',
        errorType: 'payments_load_failed',
        statusCode: 500,
      });
      sendError(res, 500, 'Failed to load billing overview', 'payments_load_failed');
      return;
    }

    const localizedByPlan = new Map<string, LocalizedPriceRow>();
    for (const row of (localizedResult.data || []) as LocalizedPriceRow[]) {
      localizedByPlan.set(row.plan_id, row);
    }

    const plans = ((plansResult.data || []) as PlanRow[]).map((plan) => {
      const localized = localizedByPlan.get(plan.id);
      if (!localized) {
        const normalizedCurrency = profileCurrency || plan.currency;
        const normalizedPlanCurrency = (plan.currency || '').toUpperCase();

        if (normalizedPlanCurrency === 'NGN' && normalizedCurrency) {
          const fallbackPrice = convertFromNgn(Number(plan.price), normalizedCurrency);

          return {
            ...plan,
            country: profileCountry,
            currency: normalizedCurrency,
            currency_symbol: getCurrencySymbol(normalizedCurrency),
            payment_provider: resolvePaymentProvider(profileCountry, normalizedCurrency, (plan.payment_provider || 'paystack') as 'paystack' | 'flutterwave' | 'stripe'),
            localized_price: fallbackPrice,
          };
        }

        return plan;
      }

      return {
        ...plan,
        country: localized.country,
        currency: localized.currency,
        currency_symbol: localized.currency_symbol,
        payment_provider: localized.payment_provider,
        localized_price: localized.localized_price,
      };
    });

    sendJson(res, 200, {
      success: true,
      plans,
      subscription: subscriptionResult.data || null,
      payments: paymentsResult.data || [],
    });
  } catch (error) {
    handleApiError(res, 'payments/overview', error, 500);
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const action = getAction(req);

  if (!action) {
    sendError(res, 400, 'Invalid payments action', 'invalid_action');
    return;
  }

  if (action === 'checkout') {
    await handleCheckout(req, res);
    return;
  }

  if (action === 'verify') {
    await handleVerify(req, res);
    return;
  }

  if (action === 'webhook') {
    await handleWebhook(req, res);
    return;
  }

  await handleOverview(req, res);
}
