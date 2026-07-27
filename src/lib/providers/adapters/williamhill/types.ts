import type { BetEvent } from '../../../normalizedBetting';

export interface WilliamHillRawEvent {
  id: string;
  home: string;
  away: string;
  competition: string;
  startTime: string;
}

export interface WilliamHillRawSelection {
  eventId: string;
  market: string;
  selection: string;
  odds: number;
}

export interface WilliamHillNormalizedSelection {
  event: BetEvent;
  market: string;
  selection: string;
  odds: number;
}
