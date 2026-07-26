import test from 'node:test';
import assert from 'node:assert/strict';
import { StripeProvider } from '../stripe';
import { FlutterwaveProvider } from '../flutterwave';

test('stripe successful payment normalization maps to success', () => {
  const provider = new StripeProvider();
  const normalized = provider.normalizeTransaction(
    {
      id: 'cs_test_1',
      client_reference_id: 'BCB-REF-1',
      payment_status: 'paid',
      status: 'complete',
      amount_total: 999,
      currency: 'usd',
      metadata: {
        user_id: 'user-1',
        plan_id: 'pro',
        billing_cycle: 'monthly',
      },
      payment_intent: 'pi_123',
    },
    'verify',
  );

  assert.equal(normalized.ok, true);
  assert.equal(normalized.status, 'success');
  assert.equal(normalized.reference, 'BCB-REF-1');
  assert.equal(normalized.currency, 'USD');
});

test('stripe payment_intent.payment_failed webhook maps to failed', () => {
  const provider = new StripeProvider();
  const normalized = provider.normalizeTransaction(
    {
      id: 'evt_pi_failed_1',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_failed_1',
          status: 'requires_payment_method',
          amount: 1499,
          currency: 'usd',
          metadata: {
            reference: 'BCB-REF-STRIPE-FAILED',
            user_id: 'user-1',
            plan_id: 'pro',
            subscription_id: 'sub-1',
            billing_cycle: 'monthly',
            country: 'US',
            currency: 'USD',
          },
        },
      },
    },
    'webhook',
  );

  assert.equal(normalized.ok, false);
  assert.equal(normalized.status, 'failed');
  assert.equal(normalized.reference, 'BCB-REF-STRIPE-FAILED');
});

test('stripe customer.subscription.deleted webhook maps to cancelled', () => {
  const provider = new StripeProvider();
  const normalized = provider.normalizeTransaction(
    {
      id: 'evt_sub_deleted_1',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_stripe_1',
          status: 'canceled',
          metadata: {
            reference: 'BCB-REF-STRIPE-CANCELLED',
          },
        },
      },
    },
    'webhook',
  );

  assert.equal(normalized.ok, false);
  assert.equal(normalized.status, 'cancelled');
  assert.equal(normalized.reference, 'BCB-REF-STRIPE-CANCELLED');
});

test('flutterwave failed payment normalization maps to failed', () => {
  const provider = new FlutterwaveProvider();
  const normalized = provider.normalizeTransaction(
    {
      status: 'success',
      message: 'ok',
      data: {
        tx_ref: 'BCB-REF-2',
        status: 'failed',
        amount: 100,
        currency: 'GHS',
        meta: {
          user_id: 'user-2',
          plan_id: 'basic',
          billing_cycle: 'monthly',
        },
      },
    },
    'verify',
  );

  assert.equal(normalized.ok, false);
  assert.equal(normalized.status, 'failed');
  assert.equal(normalized.reference, 'BCB-REF-2');
});
