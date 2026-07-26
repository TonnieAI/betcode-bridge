import test from 'node:test';
import assert from 'node:assert/strict';
import { loadActivationContext } from '../../../_lib/paymentValidation';

type QueueEntry = { table: string; data: unknown; error: unknown };

function createAdmin(queue: QueueEntry[]) {
  return {
    from(table: string) {
      const entry = queue.find((item) => item.table === table);
      if (!entry) {
        throw new Error(`No stubbed response for table ${table}`);
      }

      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => ({ data: entry.data, error: entry.error }),
      };
    },
  };
}

test('activation is blocked when subscription is no longer pending', async () => {
  const admin = createAdmin([
    {
      table: 'subscriptions',
      data: {
        id: 'sub-1',
        user_id: 'user-1',
        plan_id: 'pro',
        amount: 50,
        currency: 'USD',
        billing_cycle: 'monthly',
        subscription_status: 'active',
        metadata: { selected_country: 'US', selected_currency: 'USD' },
      },
      error: null,
    },
  ]);

  const result = await loadActivationContext(admin as never, { reference: 'BCB-1', expectedUserId: 'user-1' });
  assert.deepEqual(result, { ok: false, reason: 'subscription_not_pending' });
});

test('activation is blocked when payment was already processed', async () => {
  const admin = createAdmin([
    {
      table: 'subscriptions',
      data: {
        id: 'sub-1',
        user_id: 'user-1',
        plan_id: 'pro',
        amount: 50,
        currency: 'USD',
        billing_cycle: 'monthly',
        subscription_status: 'pending',
        metadata: { selected_country: 'US', selected_currency: 'USD' },
      },
      error: null,
    },
    {
      table: 'payments',
      data: {
        id: 'pay-1',
        user_id: 'user-1',
        amount: 50,
        currency: 'USD',
        status: 'success',
        payment_provider: 'stripe',
      },
      error: null,
    },
  ]);

  const result = await loadActivationContext(admin as never, { reference: 'BCB-2', expectedUserId: 'user-1' });
  assert.deepEqual(result, { ok: false, reason: 'payment_already_processed' });
});
