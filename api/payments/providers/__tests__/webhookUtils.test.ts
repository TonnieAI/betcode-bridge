import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEventKey, isDuplicateWebhookEventError } from '../../webhookUtils';

test('buildEventKey is deterministic for duplicate webhook prevention', () => {
  const keyA = buildEventKey('stripe', 'checkout.session.completed', 'BCB-REF-3', 'success');
  const keyB = buildEventKey('stripe', 'checkout.session.completed', 'BCB-REF-3', 'success');

  assert.equal(keyA, keyB);
});

test('duplicate webhook error detection identifies unique/duplicate errors', () => {
  assert.equal(isDuplicateWebhookEventError('duplicate key value violates unique constraint'), true);
  assert.equal(isDuplicateWebhookEventError('could not connect to database'), false);
});
