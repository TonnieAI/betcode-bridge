import { allowMethods, sendJson, type ApiRequest, type ApiResponse } from '../_lib/http.js';
import { createSupabaseAdminClient } from '../_lib/supabase.js';

interface BookmakerRow {
  id: string;
  name: string;
  country: string;
  region: string;
  currency: string;
  website: string;
  supported_sports: string[];
  active: boolean;
  logo_url: string | null;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!allowMethods(req, res, ['GET'])) return;

  const activeOnly = (req.url ?? '').includes('activeOnly=0') ? false : true;
  const admin = createSupabaseAdminClient();

  let query = admin
    .from('bookmakers')
    .select('id,name,country,region,currency,website,supported_sports,active,logo_url')
    .order('region', { ascending: true })
    .order('name', { ascending: true });

  if (activeOnly) {
    query = query.eq('active', true);
  }

  const { data, error } = await query;

  if (error) {
    console.warn('bookmaker_catalog_diagnostics', {
      responseStatus: 500,
      returnedRowCount: 0,
      bookmakerNames: [],
      filteringReason: 'query_failed',
    });

    sendJson(res, 500, {
      rows: [],
      reason: 'query_failed',
    });
    return;
  }

  const rows = (data ?? []) as BookmakerRow[];
  const bookmakerNames = rows.map((row) => row.name).filter((name): name is string => Boolean(name));

  if (rows.length === 0) {
    console.warn('bookmaker_catalog_diagnostics', {
      responseStatus: 200,
      returnedRowCount: 0,
      bookmakerNames,
      filteringReason: activeOnly ? 'empty_catalog_active_only' : 'empty_catalog',
    });
  }

  sendJson(res, 200, {
    rows,
    reason: rows.length === 0 ? (activeOnly ? 'empty_catalog_active_only' : 'empty_catalog') : 'ok',
  });
}