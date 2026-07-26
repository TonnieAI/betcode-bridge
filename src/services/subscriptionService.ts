import { supabase } from '@/lib/supabase';
import type {
  BillingCycle,
  PaymentRecord,
  PaymentStatus,
  SubscriptionRecord,
  SubscriptionStatus,
  SubscriptionPlanDefinition,
} from '@/lib/types';

interface CheckoutResponse {
  authorizationUrl: string;
  reference: string;
}

interface CheckoutContext {
  country?: string;
  currency?: string;
}

interface VerifyResponse {
  success: boolean;
  status: SubscriptionStatus;
  reference: string;
  gatewayStatus?: string;
}

interface CancelResponse {
  success: boolean;
  message: string;
}

interface SubscriptionOverviewResponse {
  success: boolean;
  plans: SubscriptionPlanDefinition[];
  subscription: SubscriptionRecord | null;
  payments: PaymentRecord[];
}

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error('You must be signed in to manage subscriptions.');
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const responseText = await response.text();
  const contentType = response.headers.get('content-type') || 'unknown';
  const bodyPreview = responseText.slice(0, 200);

  console.info('subscriptionService: api response diagnostic', {
    url: response.url,
    status: response.status,
    contentType,
    bodyPreview,
  });

  if (!responseText.trim()) {
    throw new Error('Empty response received from billing API');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(responseText) as T;
  } catch {
    throw new Error(`Invalid JSON response from billing API (${response.status}, ${contentType})`);
  }

  if (!response.ok) {
    const message = (payload as { message?: string; error?: string } | null)?.message
      || (payload as { message?: string; error?: string } | null)?.error
      || 'Request failed';
    throw new Error(message);
  }

  return payload as T;
}

export async function getAvailablePlans(): Promise<SubscriptionPlanDefinition[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true });

  if (error) {
    throw new Error(`Failed to load plans: ${error.message}`);
  }

  return (data ?? []) as SubscriptionPlanDefinition[];
}

export async function getCurrentUserSubscription(): Promise<SubscriptionRecord | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .in('subscription_status', ['active', 'pending', 'failed', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load subscription: ${error.message}`);
  }

  return (data as SubscriptionRecord | null) ?? null;
}

export async function getUserPaymentHistory(limit = 20): Promise<PaymentRecord[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load payment history: ${error.message}`);
  }

  return (data ?? []) as PaymentRecord[];
}

export async function createCheckoutSession(
  planId: string,
  billingCycle: BillingCycle = 'monthly',
  context: CheckoutContext = {},
): Promise<CheckoutResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/payments/checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      planId,
      billingCycle,
      country: context.country,
      currency: context.currency,
    }),
  });

  return parseApiResponse<CheckoutResponse>(response);
}

export async function verifyPaymentReference(reference: string): Promise<VerifyResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/payments/verify', {
    method: 'POST',
    headers,
    body: JSON.stringify({ reference }),
  });

  return parseApiResponse<VerifyResponse>(response);
}

export async function cancelCurrentSubscription(subscriptionId?: string): Promise<CancelResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/payments/cancel', {
    method: 'POST',
    headers,
    body: JSON.stringify({ subscriptionId }),
  });

  return parseApiResponse<CancelResponse>(response);
}

export async function getSubscriptionOverview() {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/payments/overview', {
    method: 'GET',
    headers: {
      Authorization: headers.Authorization,
    },
  });

  return parseApiResponse<SubscriptionOverviewResponse>(response);
}

export function getPaymentStatusTone(status: PaymentStatus): 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'success':
      return 'success';
    case 'pending':
      return 'warning';
    case 'failed':
      return 'danger';
    case 'cancelled':
    case 'refunded':
      return 'info';
    default:
      return 'info';
  }
}
