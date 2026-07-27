import type { BookmakerId, DecodedBetSlip, DecodedSelection } from './types';

export interface BetEvent {
  id?: string;
  sport?: string;
  competition?: string;
  country?: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  startTime: string;
}

export interface BetSelection {
  event: BetEvent;
  market: string;
  selection: string;
  odds: number;
  sourceBookmaker: BookmakerId;
  rawMatch: string;
}

export function decodedSelectionsToNormalized(
  sourceBookmaker: BookmakerId,
  decoded: DecodedSelection[],
): BetSelection[] {
  return decoded.map((selection) => ({
    event: {
      homeTeam: selection.homeTeam,
      awayTeam: selection.awayTeam,
      league: selection.league,
      startTime: selection.kickoff,
    },
    market: selection.market,
    selection: selection.selection,
    odds: selection.odds,
    sourceBookmaker,
    rawMatch: selection.match,
  }));
}

export function decodedSlipToNormalized(decoded: DecodedBetSlip): BetSelection[] {
  return decodedSelectionsToNormalized(decoded.bookmaker, decoded.selections);
}
