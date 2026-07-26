# Subscription Payment Test Scenarios

Environment naming standard:
- Backend payment secret must be configured as PAYMENT_SECRET_KEY.
- Legacy alternative secret variable names are not supported in this codebase.

## 1) Successful Payment

Steps:
1. Sign in as a normal user.
2. Open Profile page and click Upgrade Plan on Basic or Premium.
3. Complete checkout in Paystack.
4. Return to Profile callback URL.
5. Verify status badge and plan details.

Expected:
- Subscription status becomes active.
- Profile plan is updated from free to selected plan.
- conversion_limit matches selected plan usage_limit.
- Payment history contains a success row.

## 2) Failed Payment

Steps:
1. Start checkout.
2. Intentionally fail/abort payment from gateway side.
3. Return to Profile and refresh.

Expected:
- Subscription remains failed or cancelled, never active.
- Profile plan stays unchanged.
- Payment history stores failed/cancelled attempt.

## 3) Expired Subscription

Steps:
1. Create an active subscription with a near-term expiry for a test user.
2. Wait for expiry or update expiry_date in DB to past time.
3. Trigger any conversion save attempt.

Expected:
- Subscription is marked expired by server-side expiry sync.
- Profile plan is reverted to free.
- conversion_limit is reset to free tier limit.
- If usage exceeds free tier, conversion save is blocked by quota logic.

## 4) Webhook Replay Protection

Steps:
1. Capture a successful webhook payload from Paystack.
2. Send same payload multiple times to webhook endpoint.

Expected:
- First event is processed.
- Replays are deduplicated by payment_webhook_events unique event_key.
- No duplicate subscription activation or duplicate payment rows.

## 5) Unauthenticated Checkout Attempt

Steps:
1. Call POST /api/payments/checkout without Authorization bearer token.

Expected:
- API returns 401.
- No subscription row is created.
- No payment row is created.

## 6) Unauthorized Manual Status Update Attempt

Steps:
1. Sign in as non-admin.
2. Call POST /api/admin/subscriptions/action with a valid token.

Expected:
- API returns 403.
- Subscription status remains unchanged.

## 7) Admin Manual Activation

Steps:
1. Sign in as admin.
2. Open Admin -> Billing tab.
3. Click Activate on a pending/failed subscription.

Expected:
- Subscription status becomes active.
- Profile plan and conversion_limit sync to the selected plan.
- Audit metadata records manual activation payload.

## 8) Admin Cancellation

Steps:
1. Sign in as admin.
2. Open Admin -> Billing tab.
3. Click Cancel on an active subscription.

Expected:
- Subscription becomes cancelled.
- Profile plan reverts to free.
- User sees downgraded plan and updated limits in profile.
