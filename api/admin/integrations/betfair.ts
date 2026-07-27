import { allowMethods, sendError, sendJson, type ApiRequest, type ApiResponse } from '../../_lib/http.js';
import { createSupabaseAdminClient, requireAdminUser } from '../../_lib/supabase.js';
import { BetfairAdapterClient } from '../../../src/lib/providers/adapters/betfair/client.js';
import { getMissingRequirements, getSafeCredentialStatus, writeIntegrationLog } from './betfair/shared.js';
import { getBet365AuthDiagnostics } from '../../../src/lib/bookmakers/api/auth/bet365Auth.js';
import { getBetfairAuthDiagnostics } from '../../../src/lib/bookmakers/api/auth/betfairAuth.js';
import { getSkyBetAuthDiagnostics } from '../../../src/lib/bookmakers/api/auth/skybetAuth.js';
import { getWilliamHillAuthDiagnostics } from '../../../src/lib/bookmakers/api/auth/williamhillAuth.js';
import {
  buildProviderHealth,
  type IntegrationHealthLogRow,
  type IntegrationProvider,
} from './healthModel.js';

const TRACKED_PROVIDERS: IntegrationProvider[] = ['betfair', 'bet365', 'skybet', 'williamhill'];

type BetfairAction = 'auth' | 'events' | 'markets' | 'health';

function getAction(req: ApiRequest): BetfairAction | null {
  const url = new URL(req.url || '/', 'http://localhost');
  const action = (url.searchParams.get('action') || '').trim().toLowerCase();

  if (action === 'auth' || action === 'events' || action === 'markets' || action === 'health') {
    return action;
  }

  return null;
}

async function handleAuth(req: ApiRequest, res: ApiResponse) {
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

  if (authResult.ok === false) {
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

async function handleEvents(req: ApiRequest, res: ApiResponse) {
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

async function handleMarkets(req: ApiRequest, res: ApiResponse) {
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
      test_type: 'test_markets',
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
      test_type: 'test_markets',
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
      test_type: 'test_markets',
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

  const eventIds = eventsResult.data.slice(0, 25).map((event) => event.eventId);
  const marketsResult = await client.getMarkets(eventIds);

  if (marketsResult.ok === false) {
    const responseTimeMs = Date.now() - startedAt;
    const log = await writeIntegrationLog({
      provider: 'betfair',
      admin_user_id: auth.user.id,
      test_type: 'test_markets',
      success: false,
      status: 'failed',
      error_category: 'markets_fetch_failed',
      failure_reason: marketsResult.reason,
      response_time_ms: responseTimeMs,
      metadata: { reason: marketsResult.reason },
    });

    sendJson(res, 200, {
      status: 'failed',
      message: 'Betfair market access failed',
      missingRequirements: marketsResult.missingRequirements,
      credentialStatus,
      log,
    });
    return;
  }

  const marketsReceived = marketsResult.data.length;

  const responseTimeMs = Date.now() - startedAt;
  const log = await writeIntegrationLog({
    provider: 'betfair',
    admin_user_id: auth.user.id,
    test_type: 'test_markets',
    success: true,
    status: 'connected',
    error_category: null,
    failure_reason: null,
    response_time_ms: responseTimeMs,
    metadata: { marketsReceived },
  });

  sendJson(res, 200, {
    status: 'connected',
    message: 'Betfair market access successful',
    credentialStatus,
    missingRequirements: [],
    marketsReceived,
    log,
  });
}

async function handleHealth(req: ApiRequest, res: ApiResponse) {
  if (!allowMethods(req, res, ['GET'])) return;

  const auth = await requireAdminUser(req);
  if (!auth.user) {
    sendJson(res, 403, { status: 'failed', message: 'Admin authorization required' });
    return;
  }

  const diagnosticsByProvider = {
    betfair: getBetfairAuthDiagnostics(),
    bet365: getBet365AuthDiagnostics(),
    skybet: getSkyBetAuthDiagnostics(),
    williamhill: getWilliamHillAuthDiagnostics(),
  };

  const admin = createSupabaseAdminClient();
  let rows: IntegrationHealthLogRow[] = [];

  try {
    const { data } = await admin
      .from('admin_integration_logs')
      .select('provider,status,success,failure_reason,response_time_ms,created_at')
      .in('provider', TRACKED_PROVIDERS)
      .order('created_at', { ascending: false })
      .limit(400);

    rows = (data ?? []) as IntegrationHealthLogRow[];
  } catch {
    rows = [];
  }

  const health = TRACKED_PROVIDERS.map((provider) => {
    const providerLogs = rows.filter((row) => row.provider === provider);
    return buildProviderHealth(provider, diagnosticsByProvider[provider], providerLogs);
  });

  sendJson(res, 200, {
    status: 'ok',
    checkedAt: new Date().toISOString(),
    health,
  });
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const action = getAction(req);

  if (!action) {
    sendError(res, 400, 'Invalid integration action', 'invalid_action');
    return;
  }

  if (action === 'auth') {
    await handleAuth(req, res);
    return;
  }

  if (action === 'events') {
    await handleEvents(req, res);
    return;
  }

  if (action === 'markets') {
    await handleMarkets(req, res);
    return;
  }

  await handleHealth(req, res);
}
