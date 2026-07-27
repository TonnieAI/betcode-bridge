import assert from 'node:assert/strict';
import test from 'node:test';
import { BetfairAdapterClient } from '../providers/adapters/betfair/client';
import { createBetfairAdapter } from '../providers/adapters/betfair';
import { normalizeBetfairEvents, normalizeBetfairMarkets } from '../providers/adapters/betfair/normalizer';
import type { BetSelection } from '../normalizedBetting';
import { convertBetCode } from '../conversionEngine';

const originalFetch = globalThis.fetch;

function clearBetfairEnv() {
  delete process.env.BETFAIR_APP_KEY;
  delete process.env.BETFAIR_USERNAME;
  delete process.env.BETFAIR_PASSWORD;
  delete process.env.BETFAIR_AUTH_VALIDATED;
  delete process.env.BETFAIR_EVENTS_VALIDATED;
  delete process.env.BETFAIR_MARKETS_VALIDATED;
  delete process.env.BETFAIR_SLIP_GENERATION_VALIDATED;
  delete process.env.BETFAIR_E2E_CONVERSION_VALIDATED;
}

test.beforeEach(() => {
  clearBetfairEnv();
  globalThis.fetch = originalFetch;
});

test.after(() => {
  globalThis.fetch = originalFetch;
});

test('missing credentials are blocked with integration_required status', async () => {
  const client = new BetfairAdapterClient();
  const capability = client.getCapability();

  assert.equal(capability.availability, 'integration_required');
  assert.equal(capability.requiresAPI, true);
  assert.deepEqual(capability.missingRequirements.sort(), ['BETFAIR_APP_KEY', 'BETFAIR_PASSWORD', 'BETFAIR_USERNAME']);

  const login = await client.login();
  assert.equal(login.ok, false);
  if (!login.ok) {
    assert.equal(login.availability, 'integration_required');
    assert.deepEqual(login.missingRequirements.sort(), ['BETFAIR_APP_KEY', 'BETFAIR_PASSWORD', 'BETFAIR_USERNAME']);
  }
});

test('authentication failure is handled without exposing secrets', async () => {
  process.env.BETFAIR_APP_KEY = 'app-key-secret';
  process.env.BETFAIR_USERNAME = 'username-secret';
  process.env.BETFAIR_PASSWORD = 'password-secret';

  globalThis.fetch = (async () => new Response('{"status":"FAIL"}', {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
    },
  })) as typeof fetch;

  const client = new BetfairAdapterClient();
  const login = await client.login();

  assert.equal(login.ok, false);
  if (!login.ok) {
    assert.equal(login.availability, 'unavailable');
    assert.match(login.reason, /authentication failed/i);
  }

  const diagnostics = client.getDiagnostics();
  const serialized = JSON.stringify(diagnostics);
  assert.equal(serialized.includes('app-key-secret'), false);
  assert.equal(serialized.includes('username-secret'), false);
  assert.equal(serialized.includes('password-secret'), false);
});

test('event normalization maps expected structure', async () => {
  const adapter = createBetfairAdapter();
  const sample: BetSelection[] = [
    {
      event: {
        id: 'event-1',
        sport: 'football',
        competition: 'EPL',
        country: 'UK',
        homeTeam: 'Man Utd',
        awayTeam: 'PSG',
        league: 'EPL',
        startTime: new Date('2026-07-01T18:00:00.000Z').toISOString(),
      },
      market: 'Match Odds',
      selection: 'Home Win',
      odds: 2.2,
      sourceBookmaker: 'betfair',
      rawMatch: 'Man Utd vs PSG',
    },
  ];

  const normalized = await adapter.normalizeEvents(sample, 'bet9ja');

  assert.equal(normalized[0].event.homeTeam, 'manchester united');
  assert.equal(normalized[0].event.awayTeam, 'paris saint germain');
  assert.equal(normalized[0].event.league, 'premier league');
  assert.equal(normalized[0].event.country, 'GB');
});

test('successful API response parsing maps authentication, events, and markets', async () => {
  process.env.BETFAIR_APP_KEY = 'app-key-secret';
  process.env.BETFAIR_USERNAME = 'username-secret';
  process.env.BETFAIR_PASSWORD = 'password-secret';

  globalThis.fetch = (async (input, init) => {
    const url = String(input);

    if (url.includes('/api/login')) {
      return new Response('{"status":"SUCCESS","token":"session-token"}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = JSON.parse(String(init?.body || '{}')) as { method?: string };

    if (body.method === 'SportsAPING/v1.0/listEvents') {
      return new Response(JSON.stringify([
        {
          result: [
            {
              event: {
                id: '1001',
                name: 'Man Utd v PSG',
                countryCode: 'GB',
                openDate: '2026-08-10T18:00:00.000Z',
              },
              competition: { name: 'Premier League' },
            },
          ],
        },
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (body.method === 'SportsAPING/v1.0/listMarketCatalogue') {
      return new Response(JSON.stringify([
        {
          result: [
            {
              marketId: '1.2001',
              marketName: 'MATCH_ODDS',
              event: { id: '1001' },
              runners: [
                { selectionId: 11, runnerName: 'Man Utd' },
                { selectionId: 12, runnerName: 'PSG' },
              ],
            },
          ],
        },
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('[]', { status: 404, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  const client = new BetfairAdapterClient();

  const authResult = await client.login();
  assert.equal(authResult.ok, true);

  const eventsResult = await client.getEvents();
  assert.equal(eventsResult.ok, true);
  if (!eventsResult.ok) return;

  assert.equal(eventsResult.data.length, 1);
  assert.equal(eventsResult.data[0].homeTeam, 'Man Utd');
  assert.equal(eventsResult.data[0].awayTeam, 'PSG');

  const marketsResult = await client.getMarkets(['1001']);
  assert.equal(marketsResult.ok, true);
  if (!marketsResult.ok) return;

  assert.equal(marketsResult.data.length, 2);
  assert.equal(marketsResult.data[0].marketName, 'MATCH_ODDS');
});

test('market normalization supports initial football market families', () => {
  const sample: BetSelection[] = [
    {
      event: {
        homeTeam: 'Team A',
        awayTeam: 'Team B',
        league: 'Premier League',
        startTime: new Date().toISOString(),
      },
      market: 'Match Odds',
      selection: 'HOME WIN',
      odds: 1.9,
      sourceBookmaker: 'betfair',
      rawMatch: 'Team A vs Team B',
    },
    {
      event: {
        homeTeam: 'Team C',
        awayTeam: 'Team D',
        league: 'Premier League',
        startTime: new Date().toISOString(),
      },
      market: 'Over Under 2.5 Goals',
      selection: 'Over 2.5',
      odds: 2.0,
      sourceBookmaker: 'betfair',
      rawMatch: 'Team C vs Team D',
    },
    {
      event: {
        homeTeam: 'Team E',
        awayTeam: 'Team F',
        league: 'Premier League',
        startTime: new Date().toISOString(),
      },
      market: 'Both Teams To Score',
      selection: 'Yes',
      odds: 1.7,
      sourceBookmaker: 'betfair',
      rawMatch: 'Team E vs Team F',
    },
  ];

  const normalized = normalizeBetfairMarkets(normalizeBetfairEvents(sample));

  assert.equal(normalized[0].market, 'match winner');
  assert.equal(normalized[1].market, 'total goals over 2.5');
  assert.equal(normalized[2].market, 'both teams to score');
});

test('existing Nigerian providers remain unaffected', async () => {
  const result = await convertBetCode('bet9ja', 'sportybet', 'ABCDEF12');
  assert.equal(result.sourceBookmaker, 'bet9ja');
  assert.equal(result.destinationBookmaker, 'sportybet');
  assert.ok(result.selections.length > 0);
});

test('Betfair adapter never produces fake slips without validated endpoint support', async () => {
  process.env.BETFAIR_APP_KEY = 'app-key-secret';
  process.env.BETFAIR_USERNAME = 'username-secret';
  process.env.BETFAIR_PASSWORD = 'password-secret';

  const adapter = createBetfairAdapter();
  await assert.rejects(
    () => adapter.generateBetSlip([], 'betfair'),
    /slip generation endpoint is not configured/i,
  );
});
