import {
  createSupabaseAdminClient,
  requireAuthenticatedUser,
} from '../_lib/supabase.js';
import { allowMethods, handleApiError, readJsonBody, sendError, sendJson, type ApiRequest, type ApiResponse } from '../_lib/http.js';
import { loadActivationContext, validateGatewayPaymentConsistency } from '../_lib/paymentValidation.js';
import { getPaymentProviderClient } from './providers/index.js';

interface VerifyRequestBody {
  reference?: string;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
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

      if (!consistency.ok) {
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
            reject_reason: consistency.reason,
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
