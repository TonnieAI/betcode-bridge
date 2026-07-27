import assert from 'node:assert/strict';
import test from 'node:test';
import { convertBetCode } from '../conversionEngine';
import { createBet365Adapter } from '../providers/adapters/bet365';
import { createBetfairAdapter } from '../providers/adapters/betfair';
import { createSkyBetAdapter } from '../providers/adapters/skybet';
import { createWilliamHillAdapter } from '../providers/adapters/williamhill';
import { getBet365AuthDiagnostics } from '../bookmakers/api/auth/bet365Auth';
import { normalizeBet365Events, normalizeBet365Markets } from '../providers/adapters/bet365/normalizer';
import type { BetSelection } from '../normalizedBetting';

const UK_ENV_KEYS = [
  'BET365_API_KEY',
  'BET365_API_SECRET',
  'BETFAIR_APP_KEY',
  'BETFAIR_USERNAME',
  'BETFAIR_PASSWORD',
  'SKYBET_API_KEY',
  'SKYBET_API_SECRET',
  'WILLIAMHILL_API_KEY',
  'WILLIAMHILL_API_SECRET',
] as const;

function clearUkEnv() {
  for (const key of UK_ENV_KEYS) {
    delete process.env[key];
  }
}

test.beforeEach(() => {
  clearUkEnv();
});

test('missing API keys return integration_required capability', () => {
  const adapters = [
    createBet365Adapter(),
    createBetfairAdapter(),
    createSkyBetAdapter(),
    createWilliamHillAdapter(),
  ];

  for (const adapter of adapters) {
    assert.equal(adapter.capability.availability, 'integration_required');
    assert.equal(adapter.capability.requiresAPI, true);
    assert.ok(adapter.capability.missingRequirements.length > 0);
  }

  assert.ok(createBet365Adapter().capability.missingRequirements.includes('Missing BET365_API_KEY'));
});

test('existing bookmakers still convert', async () => {
  const result = await convertBetCode('bet9ja', 'sportybet', 'ABCDEF12');
  assert.equal(result.sourceBookmaker, 'bet9ja');
  assert.equal(result.destinationBookmaker, 'sportybet');
  assert.ok(result.selections.length > 0);
});

test('UK bookmakers cannot generate fake slips', async () => {
  await assert.rejects(
    () => convertBetCode('bet9ja', 'bet365', 'ABCDEF12'),
    /does not support destination slip generation yet/
  );

  await assert.rejects(
    () => convertBetCode('betfair', 'bet9ja', 'ABCDEF12'),
    /does not support decoding yet/
  );
});

test('normalization functions return expected structures', async () => {
  const sample: BetSelection[] = [
    {
      event: {
        homeTeam: 'Man Utd',
        awayTeam: 'PSG',
        league: 'EPL',
        startTime: new Date().toISOString(),
      },
      market: 'Over 2.5',
      selection: 'Home Win',
      odds: 1.9,
      sourceBookmaker: 'bet365',
      rawMatch: 'Man Utd vs PSG',
    },
  ];

  const eventNormalized = normalizeBet365Events(sample);
  const marketNormalized = normalizeBet365Markets(eventNormalized);

  assert.equal(eventNormalized[0].event.homeTeam, 'manchester united');
  assert.equal(eventNormalized[0].event.awayTeam, 'paris saint germain');
  assert.equal(eventNormalized[0].event.league, 'premier league');
  assert.equal(marketNormalized[0].market, 'total goals over 2.5');
  assert.equal(marketNormalized[0].selection, 'home win');

  await assert.rejects(
    () => createBet365Adapter().compareOdds(marketNormalized, 'bet9ja'),
    /integration required/i
  );
});

test('secrets are never exposed in diagnostics payloads', () => {
  process.env.BET365_API_KEY = 'super-secret-api-key';
  process.env.BET365_API_SECRET = 'super-secret-api-secret';

  const diagnostics = getBet365AuthDiagnostics();
  const serialized = JSON.stringify(diagnostics);

  assert.equal(diagnostics.provider, 'bet365');
  assert.equal(diagnostics.credentialsConfigured, true);
  assert.equal(serialized.includes('super-secret-api-key'), false);
  assert.equal(serialized.includes('super-secret-api-secret'), false);

  for (const credential of diagnostics.credentials) {
    assert.equal(credential.name.startsWith('VITE_'), false);
    assert.ok(credential.length > 0);
  }
});
