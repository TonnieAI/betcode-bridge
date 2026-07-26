import {
  createSupabaseAdminClient,
  requireAuthenticatedUser,
} from '../_lib/supabase.js';
import { allowMethods, readJsonBody, sendJson, type ApiRequest, type ApiResponse } from '../_lib/http.js';

interface CancelRequestBody {
  subscriptionId?: string;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!allowMethods(req, res, ['POST'])) return;

  const auth = await requireAuthenticatedUser(req);
  if (!auth.user) {
    sendJson(res, 401, { success: false, message: 'Authentication required' });
    return;
  }

  const body = await readJsonBody<CancelRequestBody>(req);
  const subscriptionId = body.subscriptionId || null;

  const admin = createSupabaseAdminClient();

  const { error } = await admin.rpc('cancel_user_subscription', {
    p_user_id: auth.user.id,
    p_subscription_id: subscriptionId,
    p_reason: 'user_requested',
  });

  if (error) {
    if (error.message.includes('SUBSCRIPTION_NOT_FOUND')) {
      sendJson(res, 404, { success: false, message: 'Subscription cancellation failed' });
      return;
    }

    console.error('cancel: subscription cancellation failed', {
      userId: auth.user.id,
      subscriptionId,
      error: error.message,
    });
    sendJson(res, 500, { success: false, message: 'Subscription cancellation failed' });
    return;
  }

  sendJson(res, 200, {
    success: true,
    message: 'Subscription cancelled',
  });
}
