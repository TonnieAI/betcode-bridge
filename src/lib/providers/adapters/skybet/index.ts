import type { BookmakerAdapter, BookmakerCapability } from '../../../adapters/types';
import type { BookmakerId, ConvertedSelection, DecodedBetSlip } from '../../../types';
import type { BetSelection } from '../../../normalizedBetting';
import { decodedSlipToNormalized } from '../../../normalizedBetting';
import { SkyBetAdapterClient } from './client';
import { normalizeSkyBetEvents, normalizeSkyBetMarkets } from './normalizer';

export function getSkyBetCapability(): BookmakerCapability {
  const diagnostics = new SkyBetAdapterClient().getDiagnostics();
  const missingRequirements = diagnostics.credentialsConfigured
    ? ['Endpoint validation pending']
    : diagnostics.missingRequirements;

  return {
    bookmaker: 'skybet',
    canDecode: false,
    canGenerateSlip: false,
    requiresAPI: true,
    availability: 'integration_required',
    supportedFeatures: ['authentication diagnostics', 'event normalization mapping', 'market normalization mapping', 'odds comparison interface'],
    unsupportedFeatures: ['live decode bet code', 'destination slip generation'],
    requiredDataSource: 'Official Sky Bet API credentials and validated endpoints',
    missingRequirements,
  };
}

export function createSkyBetAdapter(): BookmakerAdapter {
  const client = new SkyBetAdapterClient();

  return {
    bookmaker: 'skybet',
    capability: getSkyBetCapability(),
    async decodeBetCode(): Promise<DecodedBetSlip> {
      return client.assertReadyForIntegration();
    },
    extractSelections(decoded: DecodedBetSlip): BetSelection[] {
      return decodedSlipToNormalized(decoded);
    },
    async normalizeEvents(selections: BetSelection[], _destination: BookmakerId): Promise<BetSelection[]> {
      return normalizeSkyBetEvents(selections);
    },
    async normalizeMarkets(selections: BetSelection[], _destination: BookmakerId): Promise<BetSelection[]> {
      return normalizeSkyBetMarkets(selections);
    },
    async compareOdds(_selections: BetSelection[], _destination: BookmakerId): Promise<ConvertedSelection[]> {
      return client.assertReadyForIntegration();
    },
    async generateBetSlip(_selections: BetSelection[]): Promise<string> {
      return client.assertReadyForIntegration();
    },
  };
}

export const skyBetAdapter = createSkyBetAdapter();
