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
      test_type: 'test_events',
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

  if (authResult.ok === false) {
    const responseTimeMs = Date.now() - startedAt;
    const log = await writeIntegrationLog({
      provider: 'betfair',
      admin_user_id: auth.user.id,
      test_type: 'test_events',
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

  const eventsResult = await client.getEvents();

  if (eventsResult.ok === false) {
    const responseTimeMs = Date.now() - startedAt;
    const log = await writeIntegrationLog({
      provider: 'betfair',
      admin_user_id: auth.user.id,
      test_type: 'test_events',
      success: false,
      status: 'failed',
      error_category: 'events_fetch_failed',
      failure_reason: eventsResult.reason,
      response_time_ms: responseTimeMs,
      metadata: { reason: eventsResult.reason },
    });

    sendJson(res, 200, {
      status: 'failed',
      message: 'Betfair event access failed',
      missingRequirements: eventsResult.missingRequirements,
      credentialStatus,
      log,
    });
    return;
  }

  const lastSuccessfulTest = new Date().toISOString();
  const eventsReceived = eventsResult.data.length;

  const responseTimeMs = Date.now() - startedAt;
  const log = await writeIntegrationLog({
    provider: 'betfair',
    admin_user_id: auth.user.id,
    test_type: 'test_events',
    success: true,
    status: 'connected',
    error_category: null,
    failure_reason: null,
    response_time_ms: responseTimeMs,
    metadata: { eventsReceived },
  });

  sendJson(res, 200, {
    status: 'connected',
    message: 'Betfair event access successful',
    credentialStatus,
    missingRequirements: [],
    eventsReceived,
    lastSuccessfulTest,
    log,
  });
}
