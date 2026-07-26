import type { IncomingMessage } from 'http';
import {
  createSupabaseAdminClient,
  getFlutterwaveWebhookSecretHash,
  getPaymentProvider,
  getStripeWebhookSecret,
} from '../_lib/supabase.js';
import { allowMethods, readRawBody, sendJson, type ApiRequest, type ApiResponse } from '../_lib/http.js';
import { loadActivationContext, validateGatewayPaymentConsistency } from '../_lib/paymentValidation.js';
import { getPaymentProviderClient } from './providers/index.js';
import { buildEventKey, detectProviderFromHeaders, isDuplicateWebhookEventError, normalizeProvider } from './webhookUtils.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
      // Enforce strict Stripe webhook secret usage (no fallback to generic payment secret).
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

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!allowMethods(req, res, ['POST'])) return;

  const receivedAt = new Date().toISOString();

  const fallbackProvider = normalizeProvider(getPaymentProvider());
  const providerName = detectProviderFromHeaders(req.headers, fallbackProvider);
  const provider = getPaymentProviderClient(providerName);

  const hasStripeSignatureHeader = headerPresent(req.headers, 'stripe-signature');
  const hasFlutterwaveVerifHashHeader = headerPresent(req.headers, 'verif-hash');

  if (providerName === 'stripe' || providerName === 'flutterwave') {
    try {
      assertProviderWebhookConfig(providerName);
    } catch (error) {
      const message = providerName === 'stripe'
        ? 'Stripe webhook backend configuration error'
        : 'Flutterwave webhook backend configuration error';

      console.error('webhook: provider configuration invalid', {
        provider: providerName,
        error: error instanceof Error ? error.message : 'Unknown provider configuration error',
      });

      sendJson(res, 500, { success: false, message });
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
    sendJson(res, 401, { success: false, message: 'Webhook processing failed' });
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

    console.error('webhook: failed to persist event', {
      reference,
      eventType,
      status,
      error: eventInsertError.message,
    });
    sendJson(res, 500, { success: false, message: 'Webhook processing failed' });
    return;
  }

  if (transaction.ok) {
    const localValidation = await loadActivationContext(admin, { reference });
    if (!localValidation.ok) {
      console.error('webhook: local validation failed', {
        reference,
        reason: localValidation.reason,
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

    if (!consistency.ok) {
      console.error('webhook: gateway consistency failed', {
        reference,
        reason: consistency.reason,
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
            reject_reason: consistency.reason,
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
      console.error('webhook: activation failed', {
        reference,
        error: activateError.message,
      });
      sendJson(res, 500, { success: false, message: 'Webhook processing failed' });
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
}
