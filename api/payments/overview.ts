import {
  createSupabaseAdminClient,
  requireAuthenticatedUser,
} from '../_lib/supabase.js';
import { allowMethods, handleApiError, sendError, sendJson, type ApiRequest, type ApiResponse } from '../_lib/http.js';
import { resolvePaymentProvider } from '../_lib/globalConfig.js';
import { convertFromNgn, getCurrencySymbol } from '../_lib/pricing.js';

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

  try {
    const auth = await requireAuthenticatedUser(req);
    if (!auth.user) {
      sendError(res, 401, 'Authentication required', 'auth_required');
      return;
    }

    const admin = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('country,currency')
    .eq('id', auth.user.id)
    .maybeSingle();

    if (profileError) {
      console.error('api_error', {
        endpoint: 'payments/overview',
        errorType: 'profile_context_load_failed',
        statusCode: 200,
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
      console.error('api_error', {
        endpoint: 'payments/overview',
        errorType: 'plans_load_failed',
        statusCode: 500,
      });
      sendError(res, 500, 'Failed to load billing overview', 'plans_load_failed');
      return;
    }

    if (localizedResult.error) {
      console.error('api_error', {
        endpoint: 'payments/overview',
        errorType: 'localized_prices_load_failed',
        statusCode: 500,
      });
      sendError(res, 500, 'Failed to load billing overview', 'localized_prices_load_failed');
      return;
    }

    if (subscriptionResult.error) {
      console.error('api_error', {
        endpoint: 'payments/overview',
        errorType: 'subscription_load_failed',
        statusCode: 500,
      });
      sendError(res, 500, 'Failed to load billing overview', 'subscription_load_failed');
      return;
    }

    if (paymentsResult.error) {
      console.error('api_error', {
        endpoint: 'payments/overview',
        errorType: 'payments_load_failed',
        statusCode: 500,
      });
      sendError(res, 500, 'Failed to load billing overview', 'payments_load_failed');
      return;
    }

    const localizedByPlan = new Map<string, LocalizedPriceRow>();
    for (const row of (localizedResult.data || []) as LocalizedPriceRow[]) {
      localizedByPlan.set(row.plan_id, row);
    }

    const plans = ((plansResult.data || []) as PlanRow[]).map((plan) => {
      const localized = localizedByPlan.get(plan.id);
      if (!localized) {
        const normalizedCurrency = profileCurrency || plan.currency;
        const normalizedPlanCurrency = (plan.currency || '').toUpperCase();

        if (normalizedPlanCurrency === 'NGN' && normalizedCurrency) {
          const fallbackPrice = convertFromNgn(Number(plan.price), normalizedCurrency);

          return {
            ...plan,
            country: profileCountry,
            currency: normalizedCurrency,
            currency_symbol: getCurrencySymbol(normalizedCurrency),
            payment_provider: resolvePaymentProvider(profileCountry, normalizedCurrency, (plan.payment_provider || 'paystack') as 'paystack' | 'flutterwave' | 'stripe'),
            localized_price: fallbackPrice,
          };
        }

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
  } catch (error) {
    handleApiError(res, 'payments/overview', error, 500);
  }
}