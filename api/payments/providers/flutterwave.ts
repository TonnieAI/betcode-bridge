import { getFlutterwaveApiBaseUrl, getFlutterwaveSecretKey, getFlutterwaveWebhookSecretHash } from '../../_lib/supabase.js';
import type {
  InitializePaymentPayload,
  NormalizedTransaction,
  PaymentInitializationResult,
  PaymentProvider,
  WebhookHandlingResult,
} from './types.js';

interface FlutterwaveInitResponse {
  status: string;
  message: string;
  data?: {
    link?: string;
  };
}

interface FlutterwaveVerifyResponse {
  status: string;
  message: string;
  data?: {
    id?: number;
    tx_ref?: string;
    status?: string;
    amount?: number;
    currency?: string;
    charged_amount?: number;
    customer?: {
      email?: string;
    };
    payment_type?: string;
    meta?: Record<string, unknown>;
    created_at?: string;
  };
}

interface FlutterwaveWebhookPayload {
  event?: string;
  data?: {
    id?: number;
    tx_ref?: string;
    status?: string;
    amount?: number;
    currency?: string;
    charged_amount?: number;
    payment_type?: string;
    meta?: Record<string, unknown>;
    created_at?: string;
  };
}

function mapFlutterwaveStatus(status: string | undefined): { ok: boolean; normalizedStatus: string } {
  const normalized = (status || '').toLowerCase();

  if (normalized === 'successful') {
    return { ok: true, normalizedStatus: 'success' };
  }

  if (normalized === 'failed' || normalized === 'cancelled') {
    return { ok: false, normalizedStatus: 'failed' };
  }

  if (normalized === 'abandoned') {
    return { ok: false, normalizedStatus: 'abandoned' };
  }

  return { ok: false, normalizedStatus: 'pending' };
}

export class FlutterwaveProvider implements PaymentProvider {
  readonly name = 'flutterwave' as const;
  readonly supportedCurrencies = ['NGN', 'GHS', 'KES', 'ZAR', 'MZN'];

  private getApiBaseUrl(): string {
    return getFlutterwaveApiBaseUrl().replace(/\/$/, '');
  }

  async initializePayment(payload: InitializePaymentPayload): Promise<PaymentInitializationResult> {
    const currency = payload.currency.toUpperCase();

    if (!this.supportedCurrencies.includes(currency)) {
      throw new Error(`Flutterwave does not support currency ${currency}`);
    }

    const response = await fetch(`${this.getApiBaseUrl()}/v3/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getFlutterwaveSecretKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: payload.reference,
        amount: payload.amountMajor,
        currency,
        redirect_url: `${payload.callbackUrl}?reference=${encodeURIComponent(payload.reference)}`,
        customer: {
          email: payload.email,
        },
        customization: {
          title: 'BetCode Bridge Subscription',
          description: 'Subscription payment',
        },
        meta: {
          reference: payload.reference,
          user_id: payload.metadata.user_id,
          plan_id: payload.metadata.plan_id,
          subscription_id: payload.metadata.subscription_id,
          billing_cycle: payload.metadata.billing_cycle,
          country: payload.metadata.country,
          currency: payload.metadata.currency || currency,
        },
      }),
    });

    const result = (await response.json()) as FlutterwaveInitResponse;

    if (!response.ok || result.status !== 'success' || !result.data?.link) {
      throw new Error(result.message || 'Flutterwave initialization failed');
    }

    return {
      authorizationUrl: result.data.link,
      reference: payload.reference,
    };
  }

  async verifyPayment(reference: string): Promise<NormalizedTransaction> {
    const response = await fetch(`${this.getApiBaseUrl()}/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${getFlutterwaveSecretKey()}`,
        'Content-Type': 'application/json',
      },
    });

    const result = (await response.json()) as FlutterwaveVerifyResponse;

    if (!response.ok || result.status !== 'success' || !result.data) {
      throw new Error(result.message || 'Flutterwave verification failed');
    }

    return this.normalizeTransaction(result, 'verify');
  }

  handleWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): WebhookHandlingResult {
    const hashHeader = headers['verif-hash'];
    const signature = Array.isArray(hashHeader) ? hashHeader[0] : hashHeader || '';
    const signatureValid = this.verifyWebhookSignature(signature);

    let parsed: unknown = {};
    try {
      parsed = JSON.parse(rawBody) as FlutterwaveWebhookPayload;
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
      const verifyPayload = payload as FlutterwaveVerifyResponse;
      const data = verifyPayload.data;
      const mapped = mapFlutterwaveStatus(data?.status);
      return {
        eventType: 'verify',
        reference: data?.tx_ref || '',
        ok: mapped.ok,
        status: mapped.normalizedStatus,
        gatewayTransactionId: data?.id ? String(data.id) : null,
        paymentMethod: data?.payment_type || null,
        paidAt: data?.created_at || null,
        amountMinor: Number.isFinite(data?.charged_amount ?? NaN)
          ? Math.round(Number(data?.charged_amount) * 100)
          : Number.isFinite(data?.amount ?? NaN)
            ? Math.round(Number(data?.amount) * 100)
            : null,
        currency: data?.currency || null,
        metadata: data?.meta || null,
        rawPayload: verifyPayload as unknown as Record<string, unknown>,
      };
    }

    const webhookPayload = payload as FlutterwaveWebhookPayload;
    const data = webhookPayload.data;
    const statusFromEvent = webhookPayload.event === 'charge.success' ? 'successful' : data?.status;
    const mapped = mapFlutterwaveStatus(statusFromEvent);

    return {
      eventType: webhookPayload.event || 'unknown',
      reference: data?.tx_ref || '',
      ok: mapped.ok,
      status: mapped.normalizedStatus,
      gatewayTransactionId: data?.id ? String(data.id) : null,
      paymentMethod: data?.payment_type || null,
      paidAt: data?.created_at || null,
      amountMinor: Number.isFinite(data?.charged_amount ?? NaN)
        ? Math.round(Number(data?.charged_amount) * 100)
        : Number.isFinite(data?.amount ?? NaN)
          ? Math.round(Number(data?.amount) * 100)
          : null,
      currency: data?.currency || null,
      metadata: data?.meta || null,
      rawPayload: webhookPayload as unknown as Record<string, unknown>,
    };
  }

  private verifyWebhookSignature(signature: string): boolean {
    const expected = getFlutterwaveWebhookSecretHash();

    if (!signature || !expected) return false;
    return signature.trim() === expected.trim();
  }
}
