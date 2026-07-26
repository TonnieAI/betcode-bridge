import { supabase } from '@/lib/supabase';

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

export async function getGlobalBookmakers(activeOnly = true): Promise<GlobalBookmaker[]> {
  let query = supabase
    .from('bookmakers')
    .select('*')
    .order('region', { ascending: true })
    .order('name', { ascending: true });

  if (activeOnly) {
    query = query.eq('active', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load bookmakers: ${error.message}`);
  }

  return (data ?? []) as GlobalBookmaker[];
}
