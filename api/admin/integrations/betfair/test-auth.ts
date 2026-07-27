import { allowMethods, sendJson, type ApiRequest, type ApiResponse } from '../../../_lib/http.js';
import { requireAdminUser } from '../../../_lib/supabase.js';
import { BetfairAdapterClient } from '../../../../src/lib/providers/adapters/betfair/client.js';
import { getMissingRequirements, getSafeCredentialStatus, writeIntegrationLog } from './shared.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const startedAt = Date.now();
  if (!allowMethods(req, res, ['POST'])) return;

  const auth = await requireAdminUser(req);
  if (!auth.user) {
    sendJson(res, 403, { status: 'failed', message: 'Admin authorization required' });
    return;
  }

  const credentialStatus = getSafeCredentialStatus();
  const missingRequirements = getMissingRequirements();

  if (missingRequirements.length > 0) {
    const responseTimeMs = Date.now() - startedAt;
    const log = await writeIntegrationLog({
      provider: 'betfair',
      admin_user_id: auth.user.id,
      test_type: 'test_auth',
      success: false,
      status: 'credentials_missing',
      error_category: 'missing_credentials',
      failure_reason: 'Missing Betfair credentials',
      response_time_ms: responseTimeMs,
      metadata: { missingRequirements },
    });

    sendJson(res, 200, {
      status: 'failed',
      message: 'Betfair credentials are missing',
      missingRequirements,
      credentialStatus,
      log,
    });
    return;
  }

  const client = new BetfairAdapterClient();
  const authResult = await client.login();

  if (!authResult.ok) {
    const responseTimeMs = Date.now() - startedAt;
    const log = await writeIntegrationLog({
      provider: 'betfair',
      admin_user_id: auth.user.id,
      test_type: 'test_auth',
      success: false,
      status: 'failed',
      error_category: 'authentication_failed',
      failure_reason: authResult.reason,
      response_time_ms: responseTimeMs,
      metadata: { reason: authResult.reason },
    });

    sendJson(res, 200, {
      status: 'failed',
      message: 'Betfair authentication failed',
      missingRequirements: authResult.missingRequirements,
      credentialStatus,
      log,
    });
    return;
  }

  const responseTimeMs = Date.now() - startedAt;
  const log = await writeIntegrationLog({
    provider: 'betfair',
    admin_user_id: auth.user.id,
    test_type: 'test_auth',
    success: true,
    status: 'connected',
    error_category: null,
    failure_reason: null,
    response_time_ms: responseTimeMs,
    metadata: {},
  });

  sendJson(res, 200, {
    status: 'connected',
    message: 'Betfair authentication successful',
    missingRequirements: [],
    credentialStatus,
    log,
  });
}
