import assert from 'node:assert/strict';
import test from 'node:test';
import { BOOKMAKER_LIST, BOOKMAKERS } from '../bookmakers';
import { convertBetCode } from '../conversionEngine';
import { getAdapter, listBookmakerCapabilities } from '../adapters';
import type { BookmakerId } from '../types';

const NEW_UK_BOOKMAKERS: BookmakerId[] = [
  'bet365',
  'williamhill',
  'ladbrokes',
  'coral',
  'paddypower',
  'skybet',
  'betfair',
  'betvictor',
  'unibet',
  '888sport',
];

test('new UK bookmakers appear in supported bookmaker list as active', () => {
  const ids = new Set(BOOKMAKER_LIST.map((bookmaker) => bookmaker.id));

  for (const id of NEW_UK_BOOKMAKERS) {
    assert.equal(ids.has(id), true, `${id} should be in BOOKMAKER_LIST`);
    assert.equal(BOOKMAKERS[id].active, true, `${id} should be active`);
    assert.equal(BOOKMAKERS[id].integrationMode, 'simulated', `${id} should remain metadata-only until API integration is complete`);
    assert.match(BOOKMAKERS[id].logoUrl ?? '', /^\/logos\/.+\.(svg|png|jpe?g|webp)$/i);
  }
});

test('adapter loading exposes capabilities for all bookmakers', () => {
  const capabilities = listBookmakerCapabilities();
  assert.equal(capabilities.length >= BOOKMAKER_LIST.length, true);

  for (const bookmaker of BOOKMAKER_LIST) {
    assert.ok(getAdapter(bookmaker.id), `Expected an adapter for ${bookmaker.id}`);
  }
});

test('UK bookmakers are marked as integration required', () => {
  for (const id of NEW_UK_BOOKMAKERS) {
    const adapter = getAdapter(id);
    assert.ok(adapter, `Expected adapter for ${id}`);
    assert.equal(adapter?.capability.canDecode, false);
    assert.equal(adapter?.capability.canGenerateSlip, false);
    assert.equal(adapter?.capability.requiresAPI, true);
    assert.equal(adapter?.capability.availability, 'integration_required');
  }
});

test('unsupported conversion attempts are rejected for UK adapters', async () => {
  await assert.rejects(
    () => convertBetCode('bet365', 'betking', 'UKCODE12'),
    /does not support decoding yet/
  );

  await assert.rejects(
    () => convertBetCode('bet9ja', 'bet365', 'ABCDEF12'),
    /does not support destination slip generation yet/
  );
});

test('supported provider selection still converts for existing bookmakers', async () => {
  const first = await convertBetCode('bet9ja', 'sportybet', 'ABCDEF12');
  const second = await convertBetCode('1xbet', 'betking', 'ABCDEFGH12');
  const third = await convertBetCode('nairabet', 'bet9ja', 'ABCDEFGH');

  assert.equal(first.sourceBookmaker, 'bet9ja');
  assert.equal(first.destinationBookmaker, 'sportybet');
  assert.ok(first.destinationCode.length >= 8);
  assert.ok(first.selections.length > 0);

  assert.equal(second.sourceBookmaker, '1xbet');
  assert.equal(second.destinationBookmaker, 'betking');
  assert.ok(second.destinationCode.length >= 8);
  assert.ok(second.selections.length > 0);

  assert.equal(third.sourceBookmaker, 'nairabet');
  assert.equal(third.destinationBookmaker, 'bet9ja');
  assert.ok(third.destinationCode.length >= 8);
  assert.equal(third.selections.length, 0);
});

test('invalid bookmaker names are still rejected by adapter validation', async () => {
  for (const id of NEW_UK_BOOKMAKERS) {
    const adapter = getAdapter(id);
    assert.ok(adapter, `Expected adapter for ${id}`);
  }

  await assert.rejects(
    () => convertBetCode('notarealbookmaker' as BookmakerId, 'bet365', 'UKCODE12'),
    /No adapter registered for bookmaker: notarealbookmaker/
  );
});
