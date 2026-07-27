import type { BookmakerAdapter, BookmakerCapability } from '../../../adapters/types';
import type { BookmakerId, ConvertedSelection, DecodedBetSlip } from '../../../types';
import type { BetSelection } from '../../../normalizedBetting';
import { decodedSlipToNormalized } from '../../../normalizedBetting';
import { Bet365AdapterClient } from './client';
import { normalizeBet365Events, normalizeBet365Markets } from './normalizer';

export function getBet365Capability(): BookmakerCapability {
  const diagnostics = new Bet365AdapterClient().getDiagnostics();
  const missingRequirements = diagnostics.credentialsConfigured
    ? ['Endpoint validation pending']
    : diagnostics.missingRequirements;

  return {
    bookmaker: 'bet365',
    canDecode: false,
    canGenerateSlip: false,
    requiresAPI: true,
    availability: 'integration_required',
    supportedFeatures: ['authentication diagnostics', 'event normalization mapping', 'market normalization mapping', 'odds comparison interface'],
    unsupportedFeatures: ['live decode bet code', 'destination slip generation'],
    requiredDataSource: 'Official Bet365 API credentials and validated endpoints',
    missingRequirements,
  };
}

export function createBet365Adapter(): BookmakerAdapter {
  const client = new Bet365AdapterClient();

  return {
    bookmaker: 'bet365',
    capability: getBet365Capability(),
    async decodeBetCode(): Promise<DecodedBetSlip> {
      return client.assertReadyForIntegration();
    },
    extractSelections(decoded: DecodedBetSlip): BetSelection[] {
      return decodedSlipToNormalized(decoded);
    },
    async normalizeEvents(selections: BetSelection[], _destination: BookmakerId): Promise<BetSelection[]> {
      return normalizeBet365Events(selections);
    },
    async normalizeMarkets(selections: BetSelection[], _destination: BookmakerId): Promise<BetSelection[]> {
      return normalizeBet365Markets(selections);
    },
    async compareOdds(_selections: BetSelection[], _destination: BookmakerId): Promise<ConvertedSelection[]> {
      return client.assertReadyForIntegration();
    },
    async generateBetSlip(_selections: BetSelection[]): Promise<string> {
      return client.assertReadyForIntegration();
    },
  };
}

export const bet365Adapter = createBet365Adapter();
