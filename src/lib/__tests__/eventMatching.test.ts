import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeLeagueName,
  normalizeMarketName,
  normalizeSelectionsForMatching,
  normalizeTeamName,
} from '../matching/eventMatchingService';
import type { BetSelection } from '../normalizedBetting';

test('event matching normalizes common team abbreviations and aliases', () => {
  assert.equal(normalizeTeamName('Man Utd'), 'manchester united');
  assert.equal(normalizeTeamName('PSG'), 'paris saint germain');
  assert.equal(normalizeTeamName('Spurs'), 'tottenham hotspur');
});

test('event matching normalizes league aliases and language variants', () => {
  assert.equal(normalizeLeagueName('EPL'), 'premier league');
  assert.equal(normalizeLeagueName('English Premier League'), 'premier league');
  assert.equal(normalizeLeagueName('Ligue 1'), 'ligue 1');
});

test('market normalization handles equivalent market naming', () => {
  assert.equal(normalizeMarketName('Over 2.5'), 'total goals over 2.5');
  assert.equal(normalizeMarketName('1X2'), 'match winner');
  assert.equal(normalizeMarketName('Match Result'), 'match winner');
});

test('selection normalization applies event and market mapping in one pass', () => {
  const input: BetSelection[] = [
    {
      event: {
        homeTeam: 'Man Utd',
        awayTeam: 'PSG',
        league: 'EPL',
        startTime: new Date().toISOString(),
      },
      market: 'Over 2.5',
      selection: 'Home Win',
      odds: 1.85,
      sourceBookmaker: 'bet9ja',
      rawMatch: 'Man Utd vs PSG',
    },
  ];

  const normalized = normalizeSelectionsForMatching(input);
  assert.equal(normalized[0].event.homeTeam, 'manchester united');
  assert.equal(normalized[0].event.awayTeam, 'paris saint germain');
  assert.equal(normalized[0].event.league, 'premier league');
  assert.equal(normalized[0].market, 'total goals over 2.5');
  assert.equal(normalized[0].selection, 'home win');
});
