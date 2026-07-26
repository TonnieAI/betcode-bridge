import crypto from 'crypto';
import { getPaymentSecretKey, getPaymentWebhookSecret } from '../../_lib/supabase.js';
import type {
  InitializePaymentPayload,
  NormalizedTransaction,
  PaymentProvider,
  PaymentInitializationResult,
  WebhookHandlingResult,
} from './types.js';

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    status?: string;
    id?: string | number;
    channel?: string;
    amount?: number;
    currency?: string;
    paid_at?: string;
    reference?: string;
    metadata?: Record<string, unknown>;
  };
}

interface PaystackWebhook {
  event?: string;
  data?: {
    reference?: string;
    status?: string;
    id?: string | number;
    channel?: string;
    paid_at?: string;
    amount?: number;
    currency?: string;
    metadata?: Record<string, unknown>;
  };
}

export class PaystackProvider implements PaymentProvider {
  readonly name = 'paystack' as const;
  readonly supportedCurrencies = ['NGN', 'GHS'];

  async initializePayment(payload: InitializePaymentPayload): Promise<PaymentInitializationResult> {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getPaymentSecretKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: payload.email,
        amount: Math.round(payload.amountMajor * 100),
        reference: payload.reference,
        currency: payload.currency,
        callback_url: payload.callbackUrl,
        metadata: payload.metadata,
      }),
    });

    const data = (await response.json()) as PaystackInitializeResponse;

    if (!response.ok || !data.status || !data.data?.authorization_url) {
      throw new Error(data.message || 'Paystack initialization failed');
    }

    return {
      authorizationUrl: data.data.authorization_url,
      reference: payload.reference,
    };
  }

  async verifyPayment(reference: string): Promise<NormalizedTransaction> {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${getPaymentSecretKey()}`,
        'Content-Type': 'application/json',
      },
    });

    const payload = (await response.json()) as PaystackVerifyResponse;

    if (!response.ok || !payload.status || !payload.data) {
      throw new Error(payload.message || 'Paystack verification failed');
    }

    return this.normalizeTransaction(payload, 'verify');
  }

  handleWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): WebhookHandlingResult {
    const signatureHeader = headers['x-paystack-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader || '';
    const signatureValid = this.verifyWebhookSignature(rawBody, signature);

    let parsed: unknown = {};
    try {
      parsed = JSON.parse(rawBody) as PaystackWebhook;
    } catch {
      parsed = {};
    }

    return {
      signatureValid,
      transaction: this.normalizeTransaction(parsed, 'webhook'),
    };
  }

  normalizeTransaction(payload: unknown, source: 'verify' | 'webhook'): NormalizedTransaction {
    const typedPayload = payload as PaystackVerifyResponse | PaystackWebhook;

    if (source === 'verify') {
      const verifyPayload = typedPayload as PaystackVerifyResponse;
      const verifyData = verifyPayload.data;
      return {
        eventType: 'verify',
        reference: verifyData?.reference || '',
        ok: verifyData?.status === 'success',
        status: verifyData?.status || 'unknown',
        gatewayTransactionId: verifyData?.id ? String(verifyData.id) : null,
        paymentMethod: verifyData?.channel || null,
        paidAt: verifyData?.paid_at || null,
        amountMinor: Number.isFinite(verifyData?.amount ?? NaN) ? (verifyData?.amount as number) : null,
        currency: verifyData?.currency || null,
        metadata: verifyData?.metadata || null,
        rawPayload: verifyPayload as unknown as Record<string, unknown>,
      };
    }

    const webhookPayload = typedPayload as PaystackWebhook;
    return {
      eventType: webhookPayload.event || 'unknown',
      reference: webhookPayload.data?.reference || '',
      ok: webhookPayload.data?.status === 'success',
      status: webhookPayload.data?.status || 'unknown',
      gatewayTransactionId: webhookPayload.data?.id ? String(webhookPayload.data.id) : null,
      paymentMethod: webhookPayload.data?.channel || null,
      paidAt: webhookPayload.data?.paid_at || null,
      amountMinor: Number.isFinite(webhookPayload.data?.amount ?? NaN) ? (webhookPayload.data?.amount as number) : null,
      currency: webhookPayload.data?.currency || null,
      metadata: webhookPayload.data?.metadata || null,
      rawPayload: webhookPayload as unknown as Record<string, unknown>,
    };
  }

  private verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!signature) return false;
    const hash = crypto.createHmac('sha512', getPaymentWebhookSecret()).update(rawBody).digest('hex');
    return hash === signature;
  }
}
