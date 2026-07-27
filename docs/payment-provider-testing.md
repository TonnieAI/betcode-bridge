# Payment Provider Testing

This document covers sandbox validation for Stripe, Flutterwave, and the existing Paystack flow without changing the current payment architecture.

## Required Environment Variables

Core:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYMENT_PROVIDER`
- `PAYMENT_CALLBACK_URL`

Paystack:

- `PAYMENT_SECRET_KEY`
- `PAYMENT_WEBHOOK_SECRET`

Stripe:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_API_VERSION`
- `STRIPE_MODE`

Flutterwave:

- `FLUTTERWAVE_SECRET_KEY`
- `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
- `FLUTTERWAVE_API_BASE_URL`

## Shared Validation Rules

Payment activation is allowed only when all of the following are true:

- the gateway reports a successful payment
- the subscription row is still `pending`
- the payment row is still `pending`
- gateway amount matches stored subscription/payment amount
- gateway currency matches stored subscription currency
- gateway metadata matches stored subscription context

Required metadata validated during verification/webhook activation:

- `user_id`
- `plan_id`
- `subscription_id`
- `billing_cycle`
- `country`
- `currency`

## Stripe Sandbox Steps

1. Create Stripe sandbox credentials from the Stripe Dashboard:
   - Developers -> API keys -> copy `Secret key` (test mode) into `STRIPE_SECRET_KEY`
   - Developers -> Webhooks -> create an endpoint for `https://betcode-bridge.vercel.app/api/payments/webhook` and copy the signing secret into `STRIPE_WEBHOOK_SECRET`
   - Set `STRIPE_MODE=test`
   - Keep `STRIPE_API_VERSION=latest` unless you need a pinned API version for compatibility tests
2. Set `PAYMENT_PROVIDER=stripe` or use a country/currency combination that resolves to Stripe.
3. Ensure `plan_localized_prices` contains the expected localized price for the test country/currency.
4. Create a test user in the app with a Stripe-backed country such as `US`, `GB`, or `FR`.
5. Start checkout from the profile page.
6. Confirm the created checkout session uses the expected currency:
   - `USD` for `US`
   - `GBP` or `EUR` for `GB`
   - `EUR` for `FR`
7. Confirm the checkout amount matches the localized plan amount stored in `plan_localized_prices`.
8. In Stripe Dashboard or CLI event logs, confirm metadata contains:
   - `user_id`
   - `plan_id`
   - `subscription_id`
   - `country`
   - `currency`
9. Complete payment with Stripe test cards, for example:
   - successful card: `4242 4242 4242 4242`
   - authentication required: `4000 0025 0000 3155`
   - failed card: `4000 0000 0000 9995`
10. Verify the application updates:
   - `subscriptions.subscription_status` becomes `active`
   - `payments.status` becomes `success`
   - `payments.transaction_id` is populated
   - `payments.metadata` stores the gateway payload used for activation

### Stripe Webhook Configuration

Use the payment webhook endpoint:

- `https://betcode-bridge.vercel.app/api/payments/webhook`

Forward sandbox events with the Stripe CLI or Stripe Dashboard.

Recommended event coverage:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Validation points:

- signature must be validated with `STRIPE_WEBHOOK_SECRET`
- duplicate deliveries must be deduplicated through `payment_webhook_events.event_key`
- only successful verified events may activate subscriptions
- failed/cancelled lifecycle events must only move pending payments/subscriptions into failed/cancelled states

## Flutterwave Sandbox Steps

1. Get Flutterwave sandbox credentials from Flutterwave Dashboard and set:
   - `FLUTTERWAVE_SECRET_KEY` from Developers -> API
   - `FLUTTERWAVE_WEBHOOK_SECRET_HASH` in your Flutterwave webhook settings and Vercel Environment Variables
   - `FLUTTERWAVE_API_BASE_URL=https://developersandbox-api.flutterwave.com`
2. Set `PAYMENT_PROVIDER=flutterwave` or use a country/currency combination that resolves to Flutterwave.
3. Use a localized currency supported by Flutterwave in this app:
   - `NGN`
   - `GHS`
   - `KES`
   - `ZAR`
   - `MZN`
4. Ensure `plan_localized_prices` contains the expected amount for the test country/currency.
5. Create a test user in a Flutterwave-backed country such as `ZA`, `KE`, or `MZ`.
6. Start checkout from the profile page.
7. Confirm the hosted payment initialization returns a payment link and the request payload contains the localized currency and metadata.
8. Complete the Flutterwave sandbox payment.
9. Confirm verification updates:
   - `subscriptions.subscription_status` becomes `active`
   - `payments.status` becomes `success`
   - `payments.transaction_id` is populated

### Flutterwave Webhook Configuration

Use the payment webhook endpoint:

- `https://betcode-bridge.vercel.app/api/payments/webhook`

Configure Flutterwave to send the webhook secret hash in:

- `verif-hash`

Validation points:

- secret hash must match `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
- duplicate deliveries must be deduplicated through `payment_webhook_events.event_key`
- successful transactions only activate subscriptions after amount/currency/metadata checks pass

## Paystack Regression Check

Paystack remains part of the same abstraction layer and should still be regression-tested for:

- checkout initialization
- successful verification
- webhook signature validation
- duplicate webhook protection
- activation of pending subscriptions only

## Security Checks To Confirm

A user cannot safely force activation by changing client-side values after checkout creation because server-side activation uses stored pending subscription/payment records plus gateway verification.

Confirm these scenarios:

1. Currency tampering after checkout creation:
   - create checkout in one currency
   - attempt to verify with a gateway payload containing a different currency
   - expected result: verification rejected with currency mismatch or metadata currency mismatch

2. Amount tampering:
   - create checkout with a known localized amount
   - attempt verification with any other amount
   - expected result: verification rejected with `gateway_amount_mismatch`

3. Activation without verified payment:
   - attempt to activate when the subscription is not `pending`
   - attempt to activate when the payment is not `pending`
   - expected result: activation blocked before the RPC runs

## Local Validation Commands

Run these before and after sandbox tests:

```bash
npm test
npm run test:payments
npm run typecheck
npm run build
```

## Bookmaker API Foundation Checks

For Bet365, Betfair, Sky Bet, and William Hill, the current behavior must remain integration-gated until official credentials and endpoint validation are complete.

Validate the following:

- capability reports `integration_required`
- diagnostics include provider name, credential presence, and credential length only
- diagnostics never include secret values
- no bookmaker API keys are defined with `VITE_` prefixes
- conversion requests to these providers are blocked and do not generate fake slips

## Current Limitation

End-to-end sandbox execution cannot be completed without valid provider sandbox credentials and externally delivered webhook events. The code path is prepared and local validation covers metadata integrity, signature validation, duplicate detection, amount matching, currency matching, and pending-state gating.
