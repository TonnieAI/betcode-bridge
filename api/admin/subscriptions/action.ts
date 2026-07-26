import { createSupabaseAdminClient, requireAdminUser } from '../../_lib/supabase.js';
import { allowMethods, readJsonBody, sendJson, type ApiRequest, type ApiResponse } from '../../_lib/http.js';

interface AdminActionBody {
  subscriptionId?: string;
  action?: 'activate' | 'cancel';
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!allowMethods(req, res, ['POST'])) return;

  const auth = await requireAdminUser(req);
  if (!auth.user) {
    sendJson(res, 403, { success: false, message: 'Admin authorization required' });
    return;
  }

  const body = await readJsonBody<AdminActionBody>(req);
  const subscriptionId = body.subscriptionId || '';
  const action = body.action;

  if (!subscriptionId || !action) {
    sendJson(res, 400, { success: false, message: 'Invalid request payload' });
    return;
  }

  const admin = createSupabaseAdminClient();

  const { data: subscription, error: lookupError } = await admin
    .from('subscriptions')
    .select('id,user_id,transaction_reference')
    .eq('id', subscriptionId)
    .maybeSingle();

  if (lookupError || !subscription) {
    sendJson(res, 404, { success: false, message: 'Subscription not found' });
    return;
  }

  if (action === 'activate') {
    const { error } = await admin.rpc('activate_subscription_by_reference', {
      p_transaction_reference: subscription.transaction_reference,
      p_payment_payload: {
        admin_manual_activation: true,
        activated_by: auth.user.id,
      },
    });

    if (error) {
      console.error('admin_action: activation failed', {
        subscriptionId,
        adminUserId: auth.user.id,
        error: error.message,
      });
      sendJson(res, 500, { success: false, message: 'Subscription action failed' });
      return;
    }

    sendJson(res, 200, { success: true, status: 'active' });
    return;
  }

  const { error } = await admin.rpc('cancel_user_subscription', {
    p_user_id: subscription.user_id,
    p_subscription_id: subscription.id,
    p_reason: `admin_cancelled:${auth.user.id}`,
  });

  if (error) {
    console.error('admin_action: cancellation failed', {
      subscriptionId,
      adminUserId: auth.user.id,
      error: error.message,
    });
    sendJson(res, 500, { success: false, message: 'Subscription action failed' });
    return;
  }

  sendJson(res, 200, { success: true, status: 'cancelled' });
}
