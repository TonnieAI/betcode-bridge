import { TEAM_ALIASES, MARKET_ALIASES, SELECTION_ALIASES } from './aliases';
import type { NormalizedFixture, NormalizedMarket } from './types';

// ── Team normalization ────────────────────────────────────────────────────────

function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\./g, '');
}

export function normalizeTeamName(raw: string): string {
  const key = normalizeText(raw);
  return TEAM_ALIASES[key] ?? raw.trim();
}

export function normalizeMarketName(raw: string): string {
  const key = normalizeText(raw);
  return MARKET_ALIASES[key] ?? raw.trim();
}

export function normalizeSelection(raw: string): string {
  const key = normalizeText(raw);
  return SELECTION_ALIASES[key] ?? raw.trim();
}

export function normalizeFixture(
  homeTeam: string,
  awayTeam: string,
  league: string,
  kickoff: string,
): NormalizedFixture {
  return {
    canonicalName: `${normalizeTeamName(homeTeam)} vs ${normalizeTeamName(awayTeam)}`,
    homeTeam: normalizeTeamName(homeTeam),
    awayTeam: normalizeTeamName(awayTeam),
    league: league.trim(),
    kickoff,
  };
}

export function normalizeMarket(market: string, selection: string): NormalizedMarket {
  return {
    canonicalName: normalizeMarketName(market),
    selection: normalizeSelection(selection),
  };
}

// ── Odds comparison ────────────────────────────────────────────────────────────

export interface OddsComparison {
  original: number;
  destination: number | null;
  difference: number | null;
  changePercent: number | null;
  direction: 'higher' | 'lower' | 'same' | 'unavailable';
}

export function compareOdds(original: number, destination: number | null): OddsComparison {
  if (destination === null) {
    return { original, destination: null, difference: null, changePercent: null, direction: 'unavailable' };
  }
  const difference = destination - original;
  const changePercent = original !== 0 ? (difference / original) * 100 : 0;
  const direction = Math.abs(difference) < 0.001 ? 'same' : difference > 0 ? 'higher' : 'lower';
  return { original, destination, difference, changePercent, direction };
}

// ── Matching ────────────────────────────────────────────────────────────────────

export function teamsMatch(teamA: string, teamB: string): boolean {
  return normalizeTeamName(teamA).toLowerCase() === normalizeTeamName(teamB).toLowerCase();
}

export function marketsMatch(marketA: string, marketB: string): boolean {
  return normalizeMarketName(marketA).toLowerCase() === normalizeMarketName(marketB).toLowerCase();
}
