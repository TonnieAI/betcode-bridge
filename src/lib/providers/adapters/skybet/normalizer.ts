import type { BetSelection } from '../../../normalizedBetting';
import {
  normalizeLeagueName,
  normalizeMarketName,
  normalizeSelectionName,
  normalizeTeamName,
} from '../../../matching/eventMatchingService';

export function normalizeSkyBetEvents(selections: BetSelection[]): BetSelection[] {
  return selections.map((selection) => ({
    ...selection,
    event: {
      ...selection.event,
      homeTeam: normalizeTeamName(selection.event.homeTeam),
      awayTeam: normalizeTeamName(selection.event.awayTeam),
      league: normalizeLeagueName(selection.event.league),
    },
  }));
}

export function normalizeSkyBetMarkets(selections: BetSelection[]): BetSelection[] {
  return selections.map((selection) => ({
    ...selection,
    market: normalizeMarketName(selection.market),
    selection: normalizeSelectionName(selection.selection),
  }));
}
