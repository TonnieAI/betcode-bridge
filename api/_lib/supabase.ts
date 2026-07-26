import { createClient } from '@supabase/supabase-js';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requiredWebhookEnv(name: string, provider: 'stripe' | 'flutterwave'): string {
  const value = process.env[name] || '';
  const trimmed = value.trim();

  if (!trimmed) {
    console.error('webhook: provider configuration missing', {
      provider,
      env: name,
      exists: false,
      length: 0,
    });
    throw new Error(`Missing webhook configuration: ${name}`);
  }

  return trimmed;
}

export function getSupabaseUrl(): string {
  return requiredEnv('VITE_SUPABASE_URL');
}

export function getSupabaseAnonKey(): string {
  return requiredEnv('VITE_SUPABASE_ANON_KEY');
}

export function getSupabaseServiceRoleKey(): string {
  return requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
}

export function getPaymentSecretKey(): string {
  return requiredEnv('PAYMENT_SECRET_KEY');
}

export function getPaymentWebhookSecret(): string {
  return process.env.PAYMENT_WEBHOOK_SECRET || getPaymentSecretKey();
}

export function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY || getPaymentSecretKey();
  const mode = getStripeMode();

  if (mode === 'test' && !key.startsWith('sk_test_')) {
    throw new Error('Stripe configuration error: STRIPE_MODE=test requires STRIPE_SECRET_KEY starting with sk_test_');
  }

  if (mode === 'live' && key.startsWith('sk_test_')) {
    throw new Error('Stripe configuration error: STRIPE_MODE=live requires a live Stripe secret key');
  }

  return key;
}

export function getStripeWebhookSecret(): string {
  return requiredWebhookEnv('STRIPE_WEBHOOK_SECRET', 'stripe');
}

export function getStripeApiVersion(): string {
  return (process.env.STRIPE_API_VERSION || 'latest').trim();
}

export function getStripeMode(): 'test' | 'live' {
  return process.env.STRIPE_MODE === 'live' ? 'live' : 'test';
}

export function getFlutterwaveSecretKey(): string {
  return process.env.FLUTTERWAVE_SECRET_KEY || getPaymentSecretKey();
}

export function getFlutterwaveWebhookSecretHash(): string {
  return requiredWebhookEnv('FLUTTERWAVE_WEBHOOK_SECRET_HASH', 'flutterwave');
}

export function getFlutterwaveApiBaseUrl(): string {
  return process.env.FLUTTERWAVE_API_BASE_URL || 'https://developersandbox-api.flutterwave.com';
}

export function getPaymentProvider(): string {
  return (process.env.PAYMENT_PROVIDER || 'paystack').toLowerCase();
}

export function getPaymentCurrency(): string {
  return process.env.PAYMENT_CURRENCY || 'NGN';
}

export function getPaymentCallbackUrl(): string {
  return requiredEnv('PAYMENT_CALLBACK_URL');
}

export function createSupabaseUserClient() {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function createSupabaseAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export interface ApiUser {
  id: string;
  email: string;
}

export async function requireAuthenticatedUser(req: { headers: Record<string, string | string[] | undefined> }) {
  const rawAuth = req.headers.authorization;
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Missing bearer token' } as const;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return { user: null, error: 'Missing access token' } as const;
  }

  const supabaseUserClient = createSupabaseUserClient();
  const { data, error } = await supabaseUserClient.auth.getUser(token);

  if (error || !data.user) {
    return { user: null, error: 'Invalid session token' } as const;
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email || '',
    } as ApiUser,
    error: null,
  } as const;
}

export async function requireAdminUser(req: { headers: Record<string, string | string[] | undefined> }) {
  const authResult = await requireAuthenticatedUser(req);

  if (!authResult.user) {
    return authResult;
  }

  const admin = createSupabaseAdminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('role')
    .eq('id', authResult.user.id)
    .maybeSingle();

  if (error || profile?.role !== 'admin') {
    return { user: null, error: 'Admin privileges required' } as const;
  }

  return authResult;
}
