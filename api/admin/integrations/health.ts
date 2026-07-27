import { allowMethods, sendJson, type ApiRequest, type ApiResponse } from '../../_lib/http.js';
import { createSupabaseAdminClient, requireAdminUser } from '../../_lib/supabase.js';
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

export default async function handler(req: ApiRequest, res: ApiResponse) {
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
