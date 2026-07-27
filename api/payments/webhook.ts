import type { IncomingMessage } from 'http';
import {
  createSupabaseAdminClient,
  getFlutterwaveWebhookSecretHash,
  getPaymentProvider,
  getStripeWebhookSecret,
} from '../_lib/supabase.js';
import { allowMethods, handleApiError, readRawBody, sendError, sendJson, type ApiRequest, type ApiResponse } from '../_lib/http.js';
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

      if (!consistency.ok) {
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
