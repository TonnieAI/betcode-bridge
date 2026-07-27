import type { BetEvent, BetSelection } from '../../../normalizedBetting';
import type { ConversionAvailability } from '../../../adapters/types';

export interface BetfairAuthResponse {
  sessionToken: string;
}

export interface BetfairEvent {
  eventId: string;
  sport: string;
  competition: string;
  country: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
}

export interface BetfairMarket {
  eventId: string;
  marketId: string;
  marketName: string;
  selectionId: string;
  runnerName: string;
}

export interface BetfairMarketBookEntry {
  marketId: string;
  selectionId: string;
  odds: number;
}

export interface BetfairOddsComparison {
  available: boolean;
  oddsDifference: number | null;
  recommendedProvider: 'source' | 'betfair' | 'equal' | 'none';
}

export interface BetfairCapabilityResult {
  availability: ConversionAvailability;
  requiresAPI: boolean;
  missingRequirements: string[];
}

export type BetfairOperationResult<T> =
  | { ok: true; data: T }
  | { ok: false; availability: ConversionAvailability; reason: string; missingRequirements: string[] };

export interface BetfairMappedSelection extends BetSelection {
  event: BetEvent;
  marketId?: string;
  selectionId?: string;
  sourceOdds: number;
  betfairOdds: number | null;
}
