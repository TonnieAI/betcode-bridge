import type { BookmakerAdapter, BookmakerCapability } from '../../../adapters/types';
import type { BookmakerId, ConvertedSelection, DecodedBetSlip } from '../../../types';
import type { BetSelection } from '../../../normalizedBetting';
import { decodedSlipToNormalized } from '../../../normalizedBetting';
import { WilliamHillAdapterClient } from './client';
import { normalizeWilliamHillEvents, normalizeWilliamHillMarkets } from './normalizer';

export function getWilliamHillCapability(): BookmakerCapability {
  const diagnostics = new WilliamHillAdapterClient().getDiagnostics();
  const missingRequirements = diagnostics.credentialsConfigured
    ? ['Endpoint validation pending']
    : diagnostics.missingRequirements;

  return {
    bookmaker: 'williamhill',
    canDecode: false,
    canGenerateSlip: false,
    requiresAPI: true,
    availability: 'integration_required',
    supportedFeatures: ['authentication diagnostics', 'event normalization mapping', 'market normalization mapping', 'odds comparison interface'],
    unsupportedFeatures: ['live decode bet code', 'destination slip generation'],
    requiredDataSource: 'Official William Hill API credentials and validated endpoints',
    missingRequirements,
  };
}

export function createWilliamHillAdapter(): BookmakerAdapter {
  const client = new WilliamHillAdapterClient();

  return {
    bookmaker: 'williamhill',
    capability: getWilliamHillCapability(),
    async decodeBetCode(): Promise<DecodedBetSlip> {
      return client.assertReadyForIntegration();
    },
    extractSelections(decoded: DecodedBetSlip): BetSelection[] {
      return decodedSlipToNormalized(decoded);
    },
    async normalizeEvents(selections: BetSelection[], _destination: BookmakerId): Promise<BetSelection[]> {
      return normalizeWilliamHillEvents(selections);
    },
    async normalizeMarkets(selections: BetSelection[], _destination: BookmakerId): Promise<BetSelection[]> {
      return normalizeWilliamHillMarkets(selections);
    },
    async compareOdds(_selections: BetSelection[], _destination: BookmakerId): Promise<ConvertedSelection[]> {
      return client.assertReadyForIntegration();
    },
    async generateBetSlip(_selections: BetSelection[]): Promise<string> {
      return client.assertReadyForIntegration();
    },
  };
}

export const williamHillAdapter = createWilliamHillAdapter();
