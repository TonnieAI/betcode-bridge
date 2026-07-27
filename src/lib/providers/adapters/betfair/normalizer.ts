import type { BetSelection } from '../../../normalizedBetting.js';
import {
  normalizeLeagueName,
  normalizeMarketName,
  normalizeSelectionName,
  normalizeTeamName,
} from '../../../matching/eventMatchingService.js';

const BETFAIR_MARKET_ALIASES: Record<string, string> = {
  'match odds': 'match winner',
  'over under 2.5 goals': 'total goals over 2.5',
  'over/under 2.5 goals': 'total goals over 2.5',
  'over under goals': 'total goals over 2.5',
  'both teams to score': 'both teams to score',
};

const COUNTRY_ALIASES: Record<string, string> = {
  gb: 'GB',
  uk: 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
};

function normalizeBetfairMarketLabel(market: string): string {
  const normalized = normalizeMarketName(market);
  return BETFAIR_MARKET_ALIASES[normalized] ?? normalized;
}

function normalizeCountry(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const key = value.trim().toLowerCase();
  return COUNTRY_ALIASES[key] ?? value.trim().toUpperCase();
}

export function normalizeBetfairEvents(selections: BetSelection[]): BetSelection[] {
  return selections.map((selection) => ({
    ...selection,
    event: {
      ...selection.event,
      homeTeam: normalizeTeamName(selection.event.homeTeam),
      awayTeam: normalizeTeamName(selection.event.awayTeam),
      league: normalizeLeagueName(selection.event.league),
      country: normalizeCountry(selection.event.country),
    },
  }));
}

export function normalizeBetfairMarkets(selections: BetSelection[]): BetSelection[] {
  return selections.map((selection) => ({
    ...selection,
    market: normalizeBetfairMarketLabel(selection.market),
    selection: normalizeSelectionName(selection.selection),
  }));
}
