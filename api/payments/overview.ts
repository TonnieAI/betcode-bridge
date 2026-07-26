import {
  createSupabaseAdminClient,
  requireAuthenticatedUser,
} from '../_lib/supabase.js';
import { allowMethods, sendJson, type ApiRequest, type ApiResponse } from '../_lib/http.js';

type PlanRow = {
  id: string;
  name: string;
  price: number;
  currency: string;
  country?: string | null;
  currency_symbol?: string | null;
  payment_provider?: 'paystack' | 'flutterwave' | 'stripe' | null;
  localized_price?: number | null;
  duration: 'monthly' | 'yearly';
  usage_limit: number;
  features: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type LocalizedPriceRow = {
  plan_id: string;
  country: string;
  currency: string;
  currency_symbol: string;
  payment_provider: 'paystack' | 'flutterwave' | 'stripe';
  localized_price: number;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!allowMethods(req, res, ['GET'])) return;

  const auth = await requireAuthenticatedUser(req);
  if (!auth.user) {
    sendJson(res, 401, { success: false, message: 'Authentication required' });
    return;
  }

  const admin = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('country,currency')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('overview: failed to load profile context', {
      userId: auth.user.id,
      error: profileError.message,
    });
  }

  const profileCountry = String(profile?.country || 'GLOBAL').toUpperCase();
  const profileCurrency = String(profile?.currency || '').toUpperCase();

  const [plansResult, localizedResult, subscriptionResult, paymentsResult] = await Promise.all([
    admin
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true }),
    profileCurrency
      ? admin
          .from('plan_localized_prices')
          .select('plan_id,country,currency,currency_symbol,payment_provider,localized_price')
          .eq('country', profileCountry)
          .eq('currency', profileCurrency)
          .eq('is_active', true)
      : Promise.resolve({ data: [], error: null }),
    admin
      .from('subscriptions')
      .select('*')
      .eq('user_id', auth.user.id)
      .in('subscription_status', ['active', 'pending', 'failed', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('payments')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  if (plansResult.error) {
    console.error('overview: failed to load plans', {
      userId: auth.user.id,
      error: plansResult.error.message,
    });
    sendJson(res, 500, { success: false, message: 'Failed to load billing overview' });
    return;
  }

  if (localizedResult.error) {
    console.error('overview: failed to load localized prices', {
      userId: auth.user.id,
      country: profileCountry,
      currency: profileCurrency,
      error: localizedResult.error.message,
    });
    sendJson(res, 500, { success: false, message: 'Failed to load billing overview' });
    return;
  }

  if (subscriptionResult.error) {
    console.error('overview: failed to load subscription', {
      userId: auth.user.id,
      error: subscriptionResult.error.message,
    });
    sendJson(res, 500, { success: false, message: 'Failed to load billing overview' });
    return;
  }

  if (paymentsResult.error) {
    console.error('overview: failed to load payments', {
      userId: auth.user.id,
      error: paymentsResult.error.message,
    });
    sendJson(res, 500, { success: false, message: 'Failed to load billing overview' });
    return;
  }

  const localizedByPlan = new Map<string, LocalizedPriceRow>();
  for (const row of (localizedResult.data || []) as LocalizedPriceRow[]) {
    localizedByPlan.set(row.plan_id, row);
  }

  const plans = ((plansResult.data || []) as PlanRow[]).map((plan) => {
    const localized = localizedByPlan.get(plan.id);
    if (!localized) {
      return plan;
    }

    return {
      ...plan,
      country: localized.country,
      currency: localized.currency,
      currency_symbol: localized.currency_symbol,
      payment_provider: localized.payment_provider,
      localized_price: localized.localized_price,
    };
  });

  sendJson(res, 200, {
    success: true,
    plans,
    subscription: subscriptionResult.data || null,
    payments: paymentsResult.data || [],
  });
}