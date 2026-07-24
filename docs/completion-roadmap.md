# BetCode Bridge Completion Roadmap

Date: 2026-07-23

This document turns the current project status into a delivery plan with clear Definition of Done (DoD), effort estimates, and release gates.

## 1) Current Completion Snapshot

- Product UX and page flow: mostly complete for MVP
- Auth and core data model (Supabase + RLS): implemented
- Conversion architecture (provider/decoder pattern): implemented
- Real bookmaker integration coverage: partial (only SportyBet attempts live decode)
- Production readiness: blocked by backend quota enforcement, real provider integrations, tests, and operations hardening

## 2) Must-Complete Scope Before Production

## A. Server-side quota enforcement (Critical)

Why: Current conversion limit checks are primarily client-side and can be bypassed.

Deliverables:
- Add a server-side function (RPC/Edge Function) that atomically:
  - validates user monthly limit
  - saves conversion row
  - increments profile conversion counter
  - writes audit log entry
- Reject save when limit is exceeded
- Return typed error codes for UI handling

DoD:
- No conversion can be saved when user is over plan limit, even if client is modified
- Successful save always increments monthly count exactly once
- Concurrent save attempts do not cause race-condition overages
- Convert page handles all error codes with user-friendly messages

Estimate:
- 1.5 to 2.5 days

## B. Favorites end-to-end wiring (High)

Why: Favorites are displayed and deletable, but add flow is missing.

Deliverables:
- Add "Save pair" action on convert results and/or convert form
- Insert into favorites table with duplicate-safe handling
- Show feedback states (saved, already exists, failed)

DoD:
- User can create and remove favorites from UI
- Duplicate pair does not crash and shows clear message
- Favorites refresh correctly on dashboard and across reloads

Estimate:
- 0.5 to 1 day

## C. Notifications feature completion (High)

Why: Notification types/tables exist, but feature is not surfaced.

Deliverables:
- Create notification writer paths for key events:
  - conversion saved
  - conversion with unavailable selections
  - subscription/limit warnings
- Add notifications list UI (read/unread)
- Add mark-as-read action

DoD:
- Notifications are generated for at least 3 key event types
- User can view unread/read state and mark as read
- RLS confirms user sees only own notifications

Estimate:
- 1 to 2 days

## D. Admin hardening (High)

Why: Admin page currently behaves more like a dashboard preview than an operations console.

Deliverables:
- Back admin analytics with secure server-side queries (not broad client reads)
- Replace pseudo logs with actual logs table view
- Add role verification tests for admin-only access

DoD:
- Non-admin cannot access admin data through UI or direct calls
- Admin views real logs and key metrics from backend
- Sensitive operations are auditable

Estimate:
- 1.5 to 3 days

## E. Real provider integrations (Critical Path)

Why: Core business value depends on real decoding/matching quality.

Deliverables:
- Keep provider interface unchanged
- For each prioritized bookmaker:
  - implement live decode endpoint integration
  - parse and normalize payload
  - handle provider-specific errors/rate limits
- Add integration mode flag visibility and fallback policy

DoD per provider:
- Real code decode works against sandbox/production endpoint
- Parser handles known payload variants
- Failures return deterministic, user-safe errors
- Integration test fixtures pass for provider parser

Estimate:
- 1 to 2 days per bookmaker for first 2 providers
- 0.5 to 1.5 days per additional provider after patterns stabilize

Recommended rollout:
- Wave 1: SportyBet hardening + Bet9ja + BetKing
- Wave 2: 1xBet + NairaBet + MSport
- Wave 3: Remaining providers

## F. Test suite and CI gates (Critical)

Why: No reliable release confidence without automated checks.

Deliverables:
- Unit tests:
  - mapping aliases and normalization
  - conversion status classification
  - decoder parser edge cases
- Integration tests:
  - auth-protected route behavior
  - conversion save RPC function
  - RLS behavior for conversions/favorites/notifications
- E2E smoke tests:
  - sign up/login
  - run conversion
  - save conversion
  - export history
- CI pipeline for lint, typecheck, build, tests

DoD:
- CI blocks merges on failing checks
- Minimum coverage target set and enforced (suggest 70%+ for domain logic)
- Release candidate passes full pipeline

Estimate:
- 2 to 4 days initial setup

## G. Operational readiness (Medium)

Deliverables:
- API retry/backoff/circuit-breaker strategy
- Error telemetry and alerting
- Rate limit handling policy
- Runbook for incidents and rollback

DoD:
- Outage of one provider does not break entire app flow
- Actionable logs/alerts exist for conversion failures
- Deployment + rollback steps documented and validated

Estimate:
- 1 to 2 days

## 3) Suggested Delivery Tracks

## Track A: 2-Week MVP-to-Launch

Week 1:
- A. Server-side quota enforcement
- B. Favorites wiring
- F. Baseline unit/integration tests + CI
- E. Wave 1 provider integrations

Week 2:
- D. Admin hardening (logs + access)
- C. Notifications UI + writer paths
- E. Wave 2 provider integrations
- G. Ops runbook + failure handling

Risk:
- Tight if more than 3 live providers are required for launch.

## Track B: 4-Week Stable Launch

Week 1:
- A, B, F baseline, CI

Week 2:
- E Wave 1, D

Week 3:
- E Wave 2 + Wave 3 start, C

Week 4:
- E finish, G, full regression and release prep

Benefit:
- Better integration quality and lower production incident risk.

## 4) Release Gate Checklist (Ship/No-Ship)

All must be true:
- Quota enforcement is server-side and race-safe
- At least 3 target bookmakers are live and pass parser tests
- Save conversion path is stable with logs and user-safe errors
- Favorites and notifications are fully functional
- Admin role protection is verified
- CI passes lint, typecheck, build, unit/integration/E2E smoke
- Rollback + incident runbook is documented

## 5) Recommended Next Build Order (Immediate)

1. Implement conversion save RPC/Edge Function with atomic quota enforcement
2. Wire favorite pair creation from convert flow
3. Add test harness and CI gates
4. Harden SportyBet parser + add next provider (Bet9ja)
5. Add notifications list page and event writes
6. Replace admin pseudo logs with real logs query

## 6) Known Technical Notes

- In this Windows workspace, use npm.cmd instead of npm in terminal commands when PowerShell execution policy blocks npm.ps1.
- TypeScript currently reports a deprecation warning for baseUrl in tsconfig.app.json; not an immediate blocker but should be addressed before TS 7 migration.
