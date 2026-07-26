# Subscription Security Tests

## Test 1: Normal user tries activating subscription RPC

Steps:
1. Sign in as a non-admin user.
2. Attempt to call RPC `activate_subscription_by_reference` from client context.

Expected:
- Execution denied due to function execute permission restrictions.
- No subscription status change occurs.

## Test 2: Normal user tries to change role to admin

Steps:
1. Sign in as a normal user.
2. Attempt profile update with `role = 'admin'`.

Expected:
- Update blocked by profile safety trigger.
- Role remains unchanged.

## Test 3: User tries manual plan modification

Steps:
1. Sign in as a normal user.
2. Attempt profile update with `plan = 'pro'` or changed conversion limits.

Expected:
- Update blocked by profile safety trigger.
- Plan and quota fields remain unchanged.

## Test 4: Payment amount mismatch

Steps:
1. Create a pending subscription for a known plan.
2. Submit verify/webhook payload with successful status but mismatched amount/currency/metadata.

Expected:
- Activation rejected.
- Subscription/payment marked failed.
- No quota upgrade is applied.

## Test 5: Duplicate webhook event

Steps:
1. Send valid `charge.success` webhook payload once.
2. Replay the same payload.

Expected:
- First request is processed.
- Replay is deduplicated by `(provider, event_key)` uniqueness.
- No duplicate activation or payment duplication.

## Test 6: Expired subscription automatic downgrade

Steps:
1. Set an active subscription with `expiry_date` in the past.
2. Run daily expiry job or wait for scheduled cron execution.

Expected:
- Subscription status changes to `expired`.
- Profile plan downgrades to `free`.
- Conversion limit resets to free tier value.
- Expiry event is recorded in logs.
