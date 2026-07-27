# Bookmaker API Integration Foundation

This document defines the first production-safe integration foundation for UK bookmaker adapters.

## Scope

Current foundations are prepared for:

- Bet365
- Betfair
- Sky Bet
- William Hill

No bookmaker is marked fully integrated in this phase.

## Required API Credentials

All credentials are backend-only environment variables.

- BET365: `BET365_API_KEY`, `BET365_API_SECRET`
- BETFAIR: `BETFAIR_APP_KEY`, `BETFAIR_USERNAME`, `BETFAIR_PASSWORD`
- SKY BET: `SKYBET_API_KEY`, `SKYBET_API_SECRET`
- WILLIAM HILL: `WILLIAMHILL_API_KEY`, `WILLIAMHILL_API_SECRET`

Never expose these as frontend `VITE_` variables.

## Authentication Methods

- Bet365: API key + secret/signature flow (foundation only)
- Betfair: app key + session auth/login flow (foundation only)
- Sky Bet: API key + secret/signature flow (foundation only)
- William Hill: API key + secret/signature flow (foundation only)

## Endpoint Requirements

Each provider needs validated endpoints for:

- decode bet code / retrieve slip
- event lookup / fixture metadata
- market and selection lookup
- odds retrieval
- destination bet slip generation

Until endpoint contracts are validated, adapters remain `integration_required`.

## Webhook Requirements

If a provider emits async settlement or slip updates, define:

- webhook signing model
- idempotency key strategy
- replay protection
- payload schema validation

## Rate Limits

Before production rollout, each provider requires:

- per-endpoint rate limits
- retry/backoff strategy
- burst and sustained throughput budgets
- adapter-side request throttling policy

## Sandbox Requirements

- documented sandbox base URL
- sandbox credentials
- sample decode and odds payloads
- sample failure payloads

## Production Approval Requirements

- approved production credentials
- endpoint allowlisting/IP policies
- signed integration agreement where required
- monitoring and alerting thresholds for API failures

## Current Capability State

- Existing Nigerian providers remain functional under current adapter flow.
- UK adapters are integration foundations only and intentionally block conversion until real API validation is complete.

## Betfair Integration Requirements

### Credentials

- `BETFAIR_APP_KEY`
- `BETFAIR_USERNAME`
- `BETFAIR_PASSWORD`

All credentials must be backend-only and must never be exposed through `VITE_*` variables.

### Authentication Process

1. Use Betfair identity endpoint login with username/password and app key.
2. Store session token server-side only.
3. Use session token with betting JSON-RPC calls.
4. Refresh/re-login on auth expiry.

### API Coverage Required

- listEvents
- listMarketCatalogue
- listMarketBook
- slip generation endpoint contract (if available through approved integration path)

### Rate Limits

- Enforce provider-level request throttling.
- Add retry/backoff for transient HTTP and JSON-RPC failures.
- Capture request failure metrics for integration health.

### Sandbox and Testing

- Confirm sandbox or test account availability with Betfair.
- Validate auth, events, and markets retrieval before moving to `partial`.
- Validate slip generation and end-to-end conversion before moving to `full`.

### Production Activation Steps

1. Confirm account approval and production app key permission.
2. Validate successful authenticated event/market retrieval in production-like environment.
3. Validate market mapping for supported football markets.
4. Validate slip generation endpoint behavior.
5. Validate end-to-end conversion and post-deployment monitoring.

### Capability Progression Rules

- `integration_required`: missing credentials or no successful authenticated events/markets validation.
- `partial`: authentication works and events/markets load successfully.
- `full`: slip generation works and end-to-end conversion succeeds.
