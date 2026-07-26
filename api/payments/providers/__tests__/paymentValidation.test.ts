import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGatewayPaymentConsistency, type ActivationContext } from '../../../_lib/paymentValidation';

function buildContext(overrides: Partial<ActivationContext> = {}): ActivationContext {
  const base: ActivationContext = {
    subscription: {
      id: 'sub-1',
      user_id: 'user-1',
      plan_id: 'pro',
      amount: 50,
      currency: 'USD',
      billing_cycle: 'monthly',
      subscription_status: 'pending',
      metadata: {
        selected_country: 'US',
        selected_currency: 'USD',
      },
    },
    payment: {
      id: 'pay-1',
      user_id: 'user-1',
      amount: 50,
      currency: 'USD',
      status: 'pending',
      payment_provider: 'stripe',
    },
    expectedAmount: 50,
    expectedAmountMinor: 5000,
  };

  return {
    ...base,
    ...overrides,
    subscription: { ...base.subscription, ...(overrides.subscription || {}) },
    payment: { ...base.payment, ...(overrides.payment || {}) },
  };
}

test('successful payment consistency check passes', () => {
  const context = buildContext();
  const result = validateGatewayPaymentConsistency({
    context,
    gatewayAmountMinor: 5000,
    gatewayCurrency: 'USD',
    gatewayMetadata: {
      user_id: 'user-1',
      plan_id: 'pro',
      subscription_id: 'sub-1',
      billing_cycle: 'monthly',
      country: 'US',
      currency: 'USD',
    },
  });

  assert.deepEqual(result, { ok: true });
});

test('wrong amount is rejected', () => {
  const context = buildContext();
  const result = validateGatewayPaymentConsistency({
    context,
    gatewayAmountMinor: 4900,
    gatewayCurrency: 'USD',
    gatewayMetadata: {
      user_id: 'user-1',
      plan_id: 'pro',
      subscription_id: 'sub-1',
      billing_cycle: 'monthly',
      country: 'US',
      currency: 'USD',
    },
  });

  assert.deepEqual(result, { ok: false, reason: 'gateway_amount_mismatch' });
});

test('wrong currency is rejected', () => {
  const context = buildContext();
  const result = validateGatewayPaymentConsistency({
    context,
    gatewayAmountMinor: 5000,
    gatewayCurrency: 'EUR',
    gatewayMetadata: {
      user_id: 'user-1',
      plan_id: 'pro',
      subscription_id: 'sub-1',
      billing_cycle: 'monthly',
      country: 'US',
      currency: 'EUR',
    },
  });

  assert.deepEqual(result, { ok: false, reason: 'currency_mismatch' });
});

test('changed currency after checkout creation is rejected via metadata validation', () => {
  const context = buildContext();
  const result = validateGatewayPaymentConsistency({
    context,
    gatewayAmountMinor: 5000,
    gatewayCurrency: 'USD',
    gatewayMetadata: {
      user_id: 'user-1',
      plan_id: 'pro',
      subscription_id: 'sub-1',
      billing_cycle: 'monthly',
      country: 'US',
      currency: 'EUR',
    },
  });

  assert.deepEqual(result, { ok: false, reason: 'metadata_currency_mismatch' });
});

test('modified subscription id is rejected', () => {
  const context = buildContext();
  const result = validateGatewayPaymentConsistency({
    context,
    gatewayAmountMinor: 5000,
    gatewayCurrency: 'USD',
    gatewayMetadata: {
      user_id: 'user-1',
      plan_id: 'pro',
      subscription_id: 'sub-999',
      billing_cycle: 'monthly',
      country: 'US',
      currency: 'USD',
    },
  });

  assert.deepEqual(result, { ok: false, reason: 'metadata_subscription_mismatch' });
});
