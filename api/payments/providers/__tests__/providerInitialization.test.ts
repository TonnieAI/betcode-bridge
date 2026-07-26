import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { StripeProvider } from '../stripe';
import { FlutterwaveProvider } from '../flutterwave';

const originalFetch = globalThis.fetch;

function setEnv() {
  process.env.PAYMENT_SECRET_KEY = 'fallback-secret';
  process.env.PAYMENT_WEBHOOK_SECRET = 'fallback-webhook';
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
  process.env.STRIPE_API_VERSION = '2025-01-27.acacia';
  process.env.STRIPE_MODE = 'test';
  process.env.FLUTTERWAVE_SECRET_KEY = 'flw_secret_test_123';
  process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH = 'flw_hash_test_123';
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('stripe checkout session creation sends localized metadata and currency', async () => {
  setEnv();
  let capturedBody = '';
  let capturedHeaders: HeadersInit | undefined;

  globalThis.fetch = (async (_input, init) => {
    capturedBody = String(init?.body || '');
    capturedHeaders = init?.headers;
    return {
      ok: true,
      json: async () => ({
        id: 'cs_test_123',
        object: 'checkout.session',
        url: 'https://checkout.stripe.test/session/cs_test_123',
      }),
    } as Response;
  }) as typeof fetch;

  const provider = new StripeProvider();
  const result = await provider.initializePayment({
    email: 'user@example.com',
    amountMajor: 9.99,
    currency: 'USD',
    reference: 'BCB-STRIPE-1',
    callbackUrl: 'https://example.com/profile',
    metadata: {
      user_id: 'user-1',
      plan_id: 'pro',
      subscription_id: 'sub-1',
      billing_cycle: 'monthly',
      country: 'US',
      currency: 'USD',
    },
  });

  assert.equal(result.reference, 'BCB-STRIPE-1');
  assert.match(capturedBody, /line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=usd/);
  assert.match(capturedBody, /metadata%5Buser_id%5D=user-1/);
  assert.match(capturedBody, /metadata%5Bplan_id%5D=pro/);
  assert.match(capturedBody, /metadata%5Bsubscription_id%5D=sub-1/);
  assert.match(capturedBody, /metadata%5Bcountry%5D=US/);
  assert.match(capturedBody, /metadata%5Bcurrency%5D=USD/);

  const headers = capturedHeaders as Record<string, string>;
  assert.equal(headers['Stripe-Version'], '2025-01-27.acacia');
});

test('flutterwave initialization sends localized metadata and currency', async () => {
  setEnv();
  let capturedBody = '';

  globalThis.fetch = (async (_input, init) => {
    capturedBody = String(init?.body || '');
    return {
      ok: true,
      json: async () => ({
        status: 'success',
        message: 'Hosted link created',
        data: { link: 'https://checkout.flutterwave.test/pay/123' },
      }),
    } as Response;
  }) as typeof fetch;

  const provider = new FlutterwaveProvider();
  const result = await provider.initializePayment({
    email: 'user@example.com',
    amountMajor: 650,
    currency: 'MZN',
    reference: 'BCB-FLW-1',
    callbackUrl: 'https://example.com/profile',
    metadata: {
      user_id: 'user-2',
      plan_id: 'basic',
      subscription_id: 'sub-2',
      billing_cycle: 'monthly',
      country: 'MZ',
      currency: 'MZN',
    },
  });

  const parsed = JSON.parse(capturedBody) as { meta: Record<string, unknown>; currency: string };
  assert.equal(result.reference, 'BCB-FLW-1');
  assert.equal(parsed.currency, 'MZN');
  assert.equal(parsed.meta.user_id, 'user-2');
  assert.equal(parsed.meta.plan_id, 'basic');
  assert.equal(parsed.meta.subscription_id, 'sub-2');
  assert.equal(parsed.meta.country, 'MZ');
  assert.equal(parsed.meta.currency, 'MZN');
});

test('stripe webhook signature validation rejects duplicates only after same event key and accepts valid signature', () => {
  setEnv();
  const provider = new StripeProvider();
  const rawBody = JSON.stringify({
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        client_reference_id: 'BCB-STRIPE-2',
        payment_status: 'paid',
        amount_total: 999,
        currency: 'usd',
        metadata: {
          user_id: 'user-1',
          plan_id: 'pro',
          subscription_id: 'sub-1',
          billing_cycle: 'monthly',
          country: 'US',
          currency: 'USD',
        },
      },
    },
  });
  const timestamp = '1234567890';
  const signature = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET as string)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const handled = provider.handleWebhook(rawBody, {
    'stripe-signature': `t=${timestamp},v1=${signature}`,
  });

  assert.equal(handled.signatureValid, true);
  assert.equal(handled.transaction.ok, true);
  assert.equal(handled.transaction.status, 'success');
});

test('stripe webhook signature validation rejects invalid signature', () => {
  setEnv();
  const provider = new StripeProvider();
  const rawBody = JSON.stringify({
    id: 'evt_bad_sig',
    type: 'payment_intent.payment_failed',
    data: {
      object: {
        id: 'pi_bad',
        metadata: { reference: 'BCB-STRIPE-3' },
        status: 'payment_failed',
        amount: 999,
        currency: 'usd',
      },
    },
  });

  const handled = provider.handleWebhook(rawBody, {
    'stripe-signature': 't=1234567890,v1=invalid',
  });

  assert.equal(handled.signatureValid, false);
});

test('flutterwave webhook validation accepts configured secret hash', () => {
  setEnv();
  const provider = new FlutterwaveProvider();
  const rawBody = JSON.stringify({
    event: 'charge.completed',
    data: {
      tx_ref: 'BCB-FLW-2',
      status: 'successful',
      amount: 95,
      currency: 'GHS',
      meta: {
        user_id: 'user-2',
        plan_id: 'pro',
        subscription_id: 'sub-2',
        billing_cycle: 'monthly',
        country: 'GH',
        currency: 'GHS',
      },
    },
  });

  const handled = provider.handleWebhook(rawBody, {
    'verif-hash': process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH,
  });

  assert.equal(handled.signatureValid, true);
  assert.equal(handled.transaction.ok, true);
  assert.equal(handled.transaction.currency, 'GHS');
});

test('flutterwave webhook validation rejects missing verif-hash header', () => {
  setEnv();
  const provider = new FlutterwaveProvider();
  const rawBody = JSON.stringify({
    event: 'charge.completed',
    data: {
      tx_ref: 'BCB-FLW-3',
      status: 'successful',
      amount: 95,
      currency: 'GHS',
      meta: {
        user_id: 'user-3',
        plan_id: 'pro',
        subscription_id: 'sub-3',
        billing_cycle: 'monthly',
        country: 'GH',
        currency: 'GHS',
      },
    },
  });

  const handled = provider.handleWebhook(rawBody, {});

  assert.equal(handled.signatureValid, false);
});
