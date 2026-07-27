import { BOOKMAKER_LIST } from '@/lib/bookmakers';
import type { BookmakerId } from '@/lib/types';

export interface GlobalBookmaker {
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

interface BookmakerCatalogResponse {
  rows?: Array<Partial<GlobalBookmaker>>;
  reason?: string;
}

const UK_BOOKMAKERS = new Set<BookmakerId>([
  'bet365',
  'williamhill',
  'ladbrokes',
  'coral',
  'paddypower',
  'skybet',
  'betfair',
  'betvictor',
  'unibet',
  '888sport',
]);

function getFallbackLocation(id: BookmakerId): Pick<GlobalBookmaker, 'country' | 'region' | 'currency'> {
  if (UK_BOOKMAKERS.has(id)) {
    return {
      country: 'GB',
      region: 'Europe',
      currency: 'GBP',
    };
  }

  return {
    country: 'NG',
    region: 'Africa',
    currency: 'NGN',
  };
}

function normalizeBookmakerRow(row: Partial<GlobalBookmaker>): GlobalBookmaker | null {
  if (!row.id || !row.name || !row.country || !row.region || !row.currency || !row.website) {
    return null;
  }

  return {
    id: String(row.id),
    name: String(row.name),
    country: String(row.country),
    region: String(row.region),
    currency: String(row.currency),
    website: String(row.website),
    supported_sports: Array.isArray(row.supported_sports) ? row.supported_sports.map((sport) => String(sport)) : [],
    active: Boolean(row.active),
    logo_url: row.logo_url ?? null,
  };
}

function logCatalogDiagnostics(responseStatus: number, rows: Partial<GlobalBookmaker>[], reason: string) {
  console.warn('bookmaker_catalog_diagnostics', {
    responseStatus,
    returnedRowCount: rows.length,
    bookmakerNames: rows.map((row) => row.name).filter((name): name is string => Boolean(name)),
    filteringReason: reason,
  });
}

export function buildFallbackCatalog(): GlobalBookmaker[] {
  return BOOKMAKER_LIST.map((entry) => ({
    id: entry.id,
    name: entry.name,
    ...getFallbackLocation(entry.id),
    website: entry.website,
    supported_sports: ['football'],
    active: entry.active,
    logo_url: entry.logoUrl ?? null,
  }));
}

async function fetchCatalogFromApi(activeOnly: boolean): Promise<GlobalBookmaker[] | null> {
  try {
    const response = await fetch(`/api/bookmakers/catalog?activeOnly=${activeOnly ? '1' : '0'}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    const payload = (await response.json()) as BookmakerCatalogResponse;
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const normalizedRows = rows.map(normalizeBookmakerRow).filter((row): row is GlobalBookmaker => row !== null);

    if (!response.ok || normalizedRows.length === 0) {
      logCatalogDiagnostics(response.status, rows, payload.reason ?? (response.ok ? 'empty_catalog' : 'query_failed'));
    }

    return normalizedRows.length > 0 ? normalizedRows : null;
  } catch {
    logCatalogDiagnostics(0, [], 'request_failed');
    return null;
  }
}

export async function getGlobalBookmakers(activeOnly = true): Promise<GlobalBookmaker[]> {
  const apiRows = await fetchCatalogFromApi(activeOnly);
  if (apiRows && apiRows.length > 0) {
    return apiRows;
  }

  return buildFallbackCatalog();
}
