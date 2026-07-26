import crypto from 'crypto';
import { getStripeApiVersion, getStripeMode, getStripeSecretKey } from '../../_lib/supabase.js';
import type {
  InitializePaymentPayload,
  NormalizedTransaction,
  PaymentInitializationResult,
  PaymentProvider,
  WebhookHandlingResult,
} from './types.js';

interface StripeCheckoutSessionResponse {
  id: string;
  object: 'checkout.session';
  payment_status?: string;
  status?: string;
  url?: string;
  amount_total?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  client_reference_id?: string;
  payment_intent?: string;
}

interface StripePaymentIntentResponse {
  id: string;
  status?: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  payment_method_types?: string[];
}

interface StripeListResponse<T> {
  data: T[];
}

interface StripeWebhookEnvelope {
  id: string;
  type: string;
  data?: {
    object?: Record<string, unknown>;
  };
}

function buildStripeHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getStripeSecretKey()}`,
  };

  const apiVersion = getStripeApiVersion();
  if (apiVersion && apiVersion.toLowerCase() !== 'latest') {
    headers['Stripe-Version'] = apiVersion;
  }

  return headers;
}

function assertStripeModeIsConsistent(): void {
  const mode = getStripeMode();
  const key = getStripeSecretKey();

  if (mode === 'test' && key.startsWith('sk_live_')) {
    throw new Error('Stripe mode mismatch: STRIPE_MODE=test requires a test secret key');
  }

  if (mode === 'live' && key.startsWith('sk_test_')) {
    throw new Error('Stripe mode mismatch: STRIPE_MODE=live requires a live secret key');
  }
}

function toFormBody(fields: Record<string, string>): string {
  const params = new URLSearchParams();
  Object.entries(fields).forEach(([key, value]) => {
    params.append(key, value);
  });
  return params.toString();
}

function mapStripeStatus(input: { paymentStatus?: string; sessionStatus?: string; intentStatus?: string }): { ok: boolean; status: string } {
  const paymentStatus = input.paymentStatus || '';
  const sessionStatus = input.sessionStatus || '';
  const intentStatus = input.intentStatus || '';

  if (paymentStatus === 'paid' || intentStatus === 'succeeded') {
    return { ok: true, status: 'success' };
  }

  if (sessionStatus === 'expired') {
    return { ok: false, status: 'abandoned' };
  }

  if (sessionStatus === 'failed') {
    return { ok: false, status: 'failed' };
  }

  if (intentStatus === 'canceled' || intentStatus === 'requires_payment_method' || intentStatus === 'payment_failed') {
    return { ok: false, status: 'failed' };
  }

  return { ok: false, status: 'pending' };
}

export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe' as const;
  readonly supportedCurrencies = ['USD', 'GBP', 'EUR'];

  async initializePayment(payload: InitializePaymentPayload): Promise<PaymentInitializationResult> {
    assertStripeModeIsConsistent();
    const currency = payload.currency.toLowerCase();
    if (!this.supportedCurrencies.includes(payload.currency.toUpperCase())) {
      throw new Error(`Stripe does not support currency ${payload.currency}`);
    }

    const body = toFormBody({
      mode: 'payment',
      success_url: `${payload.callbackUrl}?reference=${encodeURIComponent(payload.reference)}`,
      cancel_url: `${payload.callbackUrl}?payment_cancelled=true`,
      client_reference_id: payload.reference,
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][unit_amount]': String(Math.round(payload.amountMajor * 100)),
      'line_items[0][price_data][product_data][name]': 'BetCode Bridge Subscription',
      'line_items[0][quantity]': '1',
      'metadata[reference]': payload.reference,
      'metadata[user_id]': String(payload.metadata.user_id || ''),
      'metadata[plan_id]': String(payload.metadata.plan_id || ''),
      'metadata[subscription_id]': String(payload.metadata.subscription_id || ''),
      'metadata[billing_cycle]': String(payload.metadata.billing_cycle || ''),
      'metadata[country]': String(payload.metadata.country || ''),
      'metadata[currency]': String(payload.metadata.currency || payload.currency),
      'payment_intent_data[metadata][reference]': payload.reference,
      'payment_intent_data[metadata][user_id]': String(payload.metadata.user_id || ''),
      'payment_intent_data[metadata][plan_id]': String(payload.metadata.plan_id || ''),
      'payment_intent_data[metadata][subscription_id]': String(payload.metadata.subscription_id || ''),
      'payment_intent_data[metadata][billing_cycle]': String(payload.metadata.billing_cycle || ''),
      'payment_intent_data[metadata][country]': String(payload.metadata.country || ''),
      'payment_intent_data[metadata][currency]': String(payload.metadata.currency || payload.currency),
      customer_email: payload.email,
    });

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        ...buildStripeHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const data = (await response.json()) as StripeCheckoutSessionResponse & { error?: { message?: string } };

    if (!response.ok || !data.url) {
      throw new Error(data.error?.message || 'Stripe initialization failed');
    }

    return {
      authorizationUrl: data.url,
      reference: payload.reference,
    };
  }

  async verifyPayment(reference: string): Promise<NormalizedTransaction> {
    assertStripeModeIsConsistent();
    const session = await this.getSessionByReference(reference);
    return this.normalizeTransaction(session, 'verify');
  }

  handleWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): WebhookHandlingResult {
    const signatureHeader = headers['stripe-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader || '';
    const signatureValid = this.verifyWebhookSignature(rawBody, signature);

    let parsed: unknown = {};
    try {
      parsed = JSON.parse(rawBody) as StripeWebhookEnvelope;
    } catch {
      parsed = {};
    }

    return {
      signatureValid,
      transaction: this.normalizeTransaction(parsed, 'webhook'),
    };
  }

  normalizeTransaction(payload: unknown, source: 'verify' | 'webhook'): NormalizedTransaction {
    if (source === 'verify') {
      const session = payload as StripeCheckoutSessionResponse;
      const mapped = mapStripeStatus({
        paymentStatus: session.payment_status,
        sessionStatus: session.status,
      });

      return {
        eventType: 'verify',
        reference: session.client_reference_id || String(session.metadata?.reference || ''),
        ok: mapped.ok,
        status: mapped.status,
        gatewayTransactionId: session.payment_intent || null,
        paymentMethod: 'card',
        paidAt: null,
        amountMinor: Number.isFinite(session.amount_total ?? NaN) ? (session.amount_total as number) : null,
        currency: session.currency?.toUpperCase() || null,
        metadata: (session.metadata as Record<string, unknown>) || null,
        rawPayload: session as unknown as Record<string, unknown>,
      };
    }

    const event = payload as StripeWebhookEnvelope;
    const objectData = (event.data?.object || {}) as Record<string, unknown>;
    const metadata = (objectData.metadata || {}) as Record<string, unknown>;
    const paymentStatus = typeof objectData.payment_status === 'string' ? objectData.payment_status : undefined;
    const sessionStatus = typeof objectData.status === 'string' ? objectData.status : undefined;
    const intentStatus = typeof objectData.status === 'string' && event.type.startsWith('payment_intent.')
      ? objectData.status
      : undefined;
    const subscriptionStatus = typeof objectData.status === 'string' && event.type.startsWith('customer.subscription.')
      ? objectData.status
      : undefined;
    let mapped = mapStripeStatus({ paymentStatus, sessionStatus, intentStatus });

    if (event.type.includes('succeeded') || event.type === 'checkout.session.completed') {
      mapped = { ok: true, status: 'success' };
    }

    if (event.type.includes('failed') || event.type.includes('expired')) {
      mapped = event.type.includes('expired')
        ? { ok: false, status: 'abandoned' }
        : { ok: false, status: 'failed' };
    }

    if (event.type === 'customer.subscription.deleted' || subscriptionStatus === 'canceled') {
      mapped = { ok: false, status: 'cancelled' };
    } else if (
      event.type === 'customer.subscription.updated'
      && (subscriptionStatus === 'incomplete_expired' || subscriptionStatus === 'unpaid' || subscriptionStatus === 'past_due')
    ) {
      mapped = { ok: false, status: 'failed' };
    }

    return {
      eventType: event.type || 'unknown',
      reference: String(objectData.client_reference_id || metadata.reference || ''),
      ok: mapped.ok,
      status: mapped.status,
      gatewayTransactionId: objectData.payment_intent ? String(objectData.payment_intent) : (objectData.id ? String(objectData.id) : null),
      paymentMethod: 'card',
      paidAt: typeof objectData.created === 'number' ? new Date((objectData.created as number) * 1000).toISOString() : null,
      amountMinor: Number.isFinite(objectData.amount_total ?? NaN)
        ? Number(objectData.amount_total)
        : Number.isFinite(objectData.amount_received ?? NaN)
          ? Number(objectData.amount_received)
          : Number.isFinite(objectData.amount ?? NaN)
            ? Number(objectData.amount)
            : null,
      currency: typeof objectData.currency === 'string' ? objectData.currency.toUpperCase() : null,
      metadata,
      rawPayload: event as unknown as Record<string, unknown>,
    };
  }

  private verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!signature) return false;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) return false;

    const elements = signature.split(',').map((part) => part.trim());
    const timestamp = elements.find((entry) => entry.startsWith('t='))?.slice(2);
    const signatures = elements.filter((entry) => entry.startsWith('v1=')).map((entry) => entry.slice(3));

    if (!timestamp || signatures.length === 0) {
      return false;
    }

    const signedPayload = `${timestamp}.${rawBody}`;
    const expected = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');

    return signatures.some((candidate) => {
      const a = Buffer.from(candidate);
      const b = Buffer.from(expected);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    });
  }

  private async getSessionByReference(reference: string): Promise<StripeCheckoutSessionResponse> {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions?limit=100', {
      method: 'GET',
      headers: buildStripeHeaders(),
    });

    const payload = (await response.json()) as StripeListResponse<StripeCheckoutSessionResponse> & { error?: { message?: string } };

    if (!response.ok) {
      throw new Error(payload.error?.message || 'Stripe verification failed');
    }

    const session = payload.data.find((item) => item.client_reference_id === reference || item.metadata?.reference === reference);

    if (!session) {
      throw new Error('Stripe verification failed: reference not found');
    }

    return session;
  }
}
