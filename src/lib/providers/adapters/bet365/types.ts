import type { BetEvent } from '../../../normalizedBetting';

export interface Bet365RawEvent {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  startTime: string;
}

export interface Bet365RawSelection {
  marketName: string;
  selectionName: string;
  odds: number;
  eventId: string;
}

export interface Bet365NormalizedSelection {
  event: BetEvent;
  market: string;
  selection: string;
  odds: number;
}
