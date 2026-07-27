import type { BookmakerId, ConvertedSelection, DecodedBetSlip } from '../types';
import type { BetSelection } from '../normalizedBetting';

export type ConversionAvailability = 'full' | 'partial' | 'integration_required' | 'unavailable';

export interface BookmakerCapability {
  bookmaker: BookmakerId;
  canDecode: boolean;
  canGenerateSlip: boolean;
  requiresAPI: boolean;
  availability: ConversionAvailability;
  missingRequirements: string[];
  supportedFeatures: string[];
  unsupportedFeatures: string[];
  requiredDataSource?: string;
}

export interface BookmakerAdapter {
  bookmaker: BookmakerId;
  capability: BookmakerCapability;
  decodeBetCode(code: string): Promise<DecodedBetSlip>;
  extractSelections(decoded: DecodedBetSlip): BetSelection[];
  normalizeEvents(selections: BetSelection[], destination: BookmakerId): Promise<BetSelection[]>;
  normalizeMarkets(selections: BetSelection[], destination: BookmakerId): Promise<BetSelection[]>;
  compareOdds(selections: BetSelection[], destination: BookmakerId): Promise<ConvertedSelection[]>;
  generateBetSlip(selections: BetSelection[], source: BookmakerId): Promise<string>;
}
