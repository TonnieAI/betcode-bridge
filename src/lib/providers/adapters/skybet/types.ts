import type { BetEvent } from '../../../normalizedBetting';

export interface SkyBetRawEvent {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoff: string;
}

export interface SkyBetRawMarket {
  eventId: string;
  marketName: string;
  selectionName: string;
  odds: number;
}

export interface SkyBetNormalizedSelection {
  event: BetEvent;
  market: string;
  selection: string;
  odds: number;
}
