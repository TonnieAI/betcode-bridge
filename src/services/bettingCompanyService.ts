import { supabase } from '@/lib/supabase';
import type {
  BettingCompany,
  CreateBettingCompanyInput,
  UpdateBettingCompanyInput,
} from '@/lib/bettingCompanyTypes';
import { deleteBettingLogoByPublicUrl } from '@/services/storageService';

interface BettingCompanyRow {
  id: string;
  name: string;
  website: string | null;
  logo_url: string | null;
  status: boolean;
  created_at: string;
}

function mapRowToBettingCompany(row: BettingCompanyRow): BettingCompany {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    logoUrl: row.logo_url,
    status: row.status,
    createdAt: row.created_at,
  };
}

function normalizeWebsite(website: string | null | undefined): string | null {
  const trimmed = website?.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

async function ensureUniqueCompanyName(name: string, currentCompanyId?: string): Promise<void> {
  const query = supabase
    .from('betting_companies')
    .select('id,name')
    .ilike('name', name.trim())
    .limit(1);

  const { data, error } = currentCompanyId
    ? await query.neq('id', currentCompanyId)
    : await query;

  if (error) {
    throw new Error(`Could not validate company uniqueness: ${error.message}`);
  }

  if (data && data.length > 0) {
    throw new Error('A betting company with this name already exists.');
  }
}

export async function getBettingCompanies(): Promise<BettingCompany[]> {
  const { data, error } = await supabase
    .from('betting_companies')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load betting companies: ${error.message}`);
  }

  return (data as BettingCompanyRow[]).map(mapRowToBettingCompany);
}

export async function getActiveBettingCompanies(): Promise<BettingCompany[]> {
  const { data, error } = await supabase
    .from('betting_companies')
    .select('*')
    .eq('status', true)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to load active betting companies: ${error.message}`);
  }

  return (data as BettingCompanyRow[]).map(mapRowToBettingCompany);
}

export async function createBettingCompany(input: CreateBettingCompanyInput): Promise<BettingCompany> {
  if (!input.name.trim()) {
    throw new Error('Company name is required.');
  }

  await ensureUniqueCompanyName(input.name);

  const payload = {
    name: input.name.trim(),
    website: normalizeWebsite(input.website),
    logo_url: input.logoUrl ?? null,
    status: input.status ?? true,
  };

  const { data, error } = await supabase
    .from('betting_companies')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('A betting company with this name already exists.');
    }

    throw new Error(`Failed to create betting company: ${error.message}`);
  }

  return mapRowToBettingCompany(data as BettingCompanyRow);
}

export async function updateBettingCompany(
  id: string,
  input: UpdateBettingCompanyInput,
): Promise<BettingCompany> {
  const { data: currentCompanyData, error: currentCompanyError } = await supabase
    .from('betting_companies')
    .select('logo_url')
    .eq('id', id)
    .single();

  if (currentCompanyError) {
    throw new Error(`Failed to load company details for update: ${currentCompanyError.message}`);
  }

  const currentLogoUrl = (currentCompanyData as { logo_url: string | null }).logo_url;
  const updatePayload: Record<string, unknown> = {};

  if (typeof input.name === 'string') {
    if (!input.name.trim()) {
      throw new Error('Company name is required.');
    }

    await ensureUniqueCompanyName(input.name, id);
    updatePayload.name = input.name.trim();
  }

  if (input.website !== undefined) {
    updatePayload.website = normalizeWebsite(input.website);
  }

  if (input.logoUrl !== undefined) {
    updatePayload.logo_url = input.logoUrl;
  }

  if (typeof input.status === 'boolean') {
    updatePayload.status = input.status;
  }

  const { data, error } = await supabase
    .from('betting_companies')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('A betting company with this name already exists.');
    }

    throw new Error(`Failed to update betting company: ${error.message}`);
  }

  const updatedCompany = mapRowToBettingCompany(data as BettingCompanyRow);

  if (currentLogoUrl && currentLogoUrl !== updatedCompany.logoUrl) {
    await deleteBettingLogoByPublicUrl(currentLogoUrl);
  }

  return updatedCompany;
}

export async function deleteBettingCompany(id: string): Promise<void> {
  const { data: companyData, error: getError } = await supabase
    .from('betting_companies')
    .select('id,logo_url')
    .eq('id', id)
    .single();

  if (getError) {
    throw new Error(`Failed to load company before deletion: ${getError.message}`);
  }

  const company = companyData as { id: string; logo_url: string | null };

  if (company.logo_url) {
    await deleteBettingLogoByPublicUrl(company.logo_url);
  }

  const { error: deleteError } = await supabase.from('betting_companies').delete().eq('id', id);

  if (deleteError) {
    throw new Error(`Failed to delete betting company: ${deleteError.message}`);
  }
}

export function normalizeCompanyNameForLookup(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normalizeCompanyWebsiteForLookup(website: string): string | null {
  try {
    const value = website.trim();
    if (!value) return null;

    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const host = new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, '');
    return host;
  } catch {
    return null;
  }
}

let logoMapCache: Record<string, string> | null = null;
let logoMapPromise: Promise<Record<string, string>> | null = null;
let logoMapFetchedAt = 0;
const LOGO_MAP_TTL_MS = 60_000;

export async function getBettingCompanyLogoMap(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();

  if (!forceRefresh && logoMapCache && now - logoMapFetchedAt < LOGO_MAP_TTL_MS) {
    return logoMapCache;
  }

  if (!forceRefresh && logoMapPromise) {
    return logoMapPromise;
  }

  logoMapPromise = (async () => {
    try {
      const companies = await getActiveBettingCompanies();
      const nextMap = companies.reduce<Record<string, string>>((acc, company) => {
        if (!company.logoUrl) return acc;

        acc[normalizeCompanyNameForLookup(company.name)] = company.logoUrl;

        const hostKey = company.website ? normalizeCompanyWebsiteForLookup(company.website) : null;
        if (hostKey) {
          acc[`host:${hostKey}`] = company.logoUrl;
        }

        return acc;
      }, {});

      logoMapCache = nextMap;
      logoMapFetchedAt = Date.now();
      return nextMap;
    } finally {
      logoMapPromise = null;
    }
  })();

  return logoMapPromise;
}

export function invalidateBettingCompanyLogoMap(): void {
  logoMapCache = null;
  logoMapFetchedAt = 0;
}
