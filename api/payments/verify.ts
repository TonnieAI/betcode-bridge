import {
  createSupabaseAdminClient,
  requireAuthenticatedUser,
} from '../_lib/supabase.js';
import { allowMethods, readJsonBody, sendJson, type ApiRequest, type ApiResponse } from '../_lib/http.js';
import { loadActivationContext, validateGatewayPaymentConsistency } from '../_lib/paymentValidation.js';
import { getPaymentProviderClient } from './providers/index.js';

interface VerifyRequestBody {
  reference?: string;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!allowMethods(req, res, ['POST'])) return;

  const auth = await requireAuthenticatedUser(req);
  if (!auth.user) {
    sendJson(res, 401, { success: false, message: 'Authentication required' });
    return;
  }

  const body = await readJsonBody<VerifyRequestBody>(req);
  const reference = (body.reference || '').trim();

  if (!reference) {
    sendJson(res, 400, { success: false, message: 'Payment verification failed' });
    return;
  }

  const admin = createSupabaseAdminClient();

  const localValidation = await loadActivationContext(admin, {
    reference,
    expectedUserId: auth.user.id,
  });

  if (!localValidation.ok) {
    console.error('verify: local validation failed', {
      reference,
      userId: auth.user.id,
      reason: localValidation.reason,
    });
    sendJson(res, 400, { success: false, message: 'Payment verification failed' });
    return;
  }

  const providerName = localValidation.context.payment.payment_provider;
  const provider = getPaymentProviderClient(providerName);

  let verification;
  try {
    verification = await provider.verifyPayment(reference);
  } catch (error) {
    console.error('verify: provider verification error', {
      reference,
      userId: auth.user.id,
      provider: providerName,
      error: error instanceof Error ? error.message : 'Unknown provider error',
    });
    sendJson(res, 502, { success: false, message: 'Payment verification failed' });
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

    if (!consistency.ok) {
      console.error('verify: gateway consistency failed', {
        reference,
        userId: auth.user.id,
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
            verify_source: 'verify_endpoint',
          },
        })
        .eq('gateway_reference', reference)
        .eq('status', 'pending');

      sendJson(res, 400, { success: false, message: 'Payment verification failed' });
      return;
    }

    const { error: rpcError } = await admin.rpc('activate_subscription_by_reference', {
      p_transaction_reference: reference,
      p_payment_payload: verification.rawPayload,
    });

    if (rpcError) {
      console.error('verify: activation failed', {
        reference,
        userId: auth.user.id,
        error: rpcError.message,
      });
      sendJson(res, 500, { success: false, message: 'Payment verification failed' });
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
}
