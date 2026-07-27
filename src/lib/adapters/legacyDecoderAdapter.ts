import type { BetCodeDecoder, BookmakerId, ConvertedSelection, DecodedBetSlip } from '../types';
import type { BetSelection } from '../normalizedBetting';
import type { BookmakerAdapter, BookmakerCapability } from './types';
import { normalizeSelectionsForMatching } from '../matching/eventMatchingService';
import { decodedSlipToNormalized } from '../normalizedBetting';

export function createLegacyDecoderAdapter(
  decoder: BetCodeDecoder,
  capabilityOverrides?: Partial<Omit<BookmakerCapability, 'bookmaker'>>,
): BookmakerAdapter {
  const capability: BookmakerCapability = {
    bookmaker: decoder.bookmaker,
    canDecode: true,
    canGenerateSlip: true,
    requiresAPI: false,
    availability: 'full',
    missingRequirements: [],
    supportedFeatures: ['decode', 'selection extraction', 'event normalization', 'market normalization', 'odds comparison', 'slip generation'],
    unsupportedFeatures: [],
    ...capabilityOverrides,
  };

  return {
    bookmaker: decoder.bookmaker,
    capability,
    async decodeBetCode(code: string): Promise<DecodedBetSlip> {
      const normalized = code.trim();
      if (!decoder.validateCode(normalized)) {
        throw new Error(`Invalid bet code format for ${decoder.bookmaker}.`);
      }

      const codeTimestamp = decoder.getCodeTimestamp?.(normalized);
      if (codeTimestamp) {
        const now = new Date();
        const codeDate = new Date(codeTimestamp);
        const diffInHours = (now.getTime() - codeDate.getTime()) / (1000 * 60 * 60);
        if (diffInHours > 24) {
          throw new Error('Bet code has expired. Codes are valid for 24 hours.');
        }
      }

      return decoder.decode(normalized);
    },
    extractSelections(decoded: DecodedBetSlip): BetSelection[] {
      return decodedSlipToNormalized(decoded);
    },
    async normalizeEvents(selections: BetSelection[], _destination: BookmakerId): Promise<BetSelection[]> {
      return normalizeSelectionsForMatching(selections);
    },
    async normalizeMarkets(selections: BetSelection[], _destination: BookmakerId): Promise<BetSelection[]> {
      return normalizeSelectionsForMatching(selections);
    },
    async compareOdds(selections: BetSelection[], _destination: BookmakerId): Promise<ConvertedSelection[]> {
      return selections.map((selection) => ({
        fixture: selection.rawMatch,
        league: selection.event.league,
        kickoff: selection.event.startTime,
        market: selection.market,
        selection: selection.selection,
        originalOdds: selection.odds,
        destinationOdds: selection.odds,
        oddsDifference: 0,
        oddsChangePercent: 0,
        availability: 'available',
        status: 'matched',
        notes: '',
      }));
    },
    async generateBetSlip(selections: BetSelection[]): Promise<string> {
      return decoder.encode(
        selections.map((selection) => ({
          match: selection.rawMatch,
          league: selection.event.league,
          homeTeam: selection.event.homeTeam,
          awayTeam: selection.event.awayTeam,
          kickoff: selection.event.startTime,
          market: selection.market,
          selection: selection.selection,
          odds: selection.odds,
        }))
      );
    },
  };
}
