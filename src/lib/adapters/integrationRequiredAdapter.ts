import type { BookmakerId, ConvertedSelection, DecodedBetSlip } from '../types';
import type { BetSelection } from '../normalizedBetting';
import type { BookmakerAdapter, BookmakerCapability } from './types';

export function createIntegrationRequiredAdapter(
  bookmaker: BookmakerId,
  requiredDataSource: string,
): BookmakerAdapter {
  const capability: BookmakerCapability = {
    bookmaker,
    canDecode: false,
    canGenerateSlip: false,
    requiresAPI: true,
    availability: 'integration_required',
    missingRequirements: [requiredDataSource],
    supportedFeatures: ['bookmaker identification', 'UI selection metadata'],
    unsupportedFeatures: ['decode bet code', 'event normalization', 'market normalization', 'odds comparison', 'destination slip generation'],
    requiredDataSource,
  };

  const integrationError = () =>
    new Error(
      `${bookmaker} integration required. Connect an official API or licensed data source before conversion is available.`
    );

  return {
    bookmaker,
    capability,
    async decodeBetCode(): Promise<DecodedBetSlip> {
      throw integrationError();
    },
    extractSelections(): BetSelection[] {
      return [];
    },
    async normalizeEvents(): Promise<BetSelection[]> {
      throw integrationError();
    },
    async normalizeMarkets(): Promise<BetSelection[]> {
      throw integrationError();
    },
    async compareOdds(): Promise<ConvertedSelection[]> {
      throw integrationError();
    },
    async generateBetSlip(): Promise<string> {
      throw integrationError();
    },
  };
}
