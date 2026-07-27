import type { BookmakerAdapter, BookmakerCapability } from '../../../adapters/types';
import type { BookmakerId, ConvertedSelection, DecodedBetSlip } from '../../../types';
import type { BetSelection } from '../../../normalizedBetting';
import { decodedSlipToNormalized } from '../../../normalizedBetting';
import { BetfairAdapterClient } from './client';
import { normalizeBetfairEvents, normalizeBetfairMarkets } from './normalizer';
import { getBetfairCredentialDiagnostics, getBetfairMissingCredentialKeys } from './auth';
import { buildBetfairSelections } from './mapper';

export function getBetfairCapability(): BookmakerCapability {
  const client = new BetfairAdapterClient();
  const diagnostics = getBetfairCredentialDiagnostics();
  const runtime = client.getCapability();
  const missingRequirements = diagnostics.credentialsConfigured
    ? runtime.missingRequirements
    : getBetfairMissingCredentialKeys();

  const availability = runtime.availability;
  const canDecode = availability === 'full';
  const canGenerateSlip = availability === 'full';

  return {
    bookmaker: 'betfair',
    canDecode,
    canGenerateSlip,
    requiresAPI: true,
    availability,
    supportedFeatures: [
      'authentication diagnostics',
      'event normalization mapping',
      'market normalization mapping',
      'odds comparison interface',
      ...(availability === 'full' ? ['destination slip generation'] : []),
    ],
    unsupportedFeatures: [
      ...(availability === 'full' ? [] : ['destination slip generation']),
      ...(availability === 'integration_required' ? ['live decode bet code'] : []),
    ],
    requiredDataSource: 'Official Betfair API credentials and validated endpoints',
    missingRequirements,
  };
}

function ensureOk<T>(result: { ok: true; data: T } | { ok: false; reason: string; missingRequirements?: string[] }): T {
  if (result.ok) {
    return result.data;
  }

  const missingRequirements = result.missingRequirements ?? [];
  const details = missingRequirements.length > 0
    ? ` Missing requirements: ${missingRequirements.join(', ')}`
    : '';
  throw new Error(`${result.reason}.${details}`);
}

function toConvertedSelection(
  selection: BetSelection & { sourceOdds: number; betfairOdds: number | null },
  comparedOdds: { available: boolean; oddsDifference: number | null; recommendedProvider: 'source' | 'betfair' | 'equal' | 'none' }
): ConvertedSelection {
  const destinationOdds = comparedOdds.available ? selection.betfairOdds : null;
  return {
    fixture: selection.rawMatch,
    league: selection.event.league,
    kickoff: selection.event.startTime,
    market: selection.market,
    selection: selection.selection,
    originalOdds: selection.sourceOdds,
    destinationOdds,
    oddsDifference: comparedOdds.oddsDifference,
    oddsChangePercent: selection.sourceOdds > 0 && destinationOdds != null
      ? +(((destinationOdds - selection.sourceOdds) / selection.sourceOdds) * 100).toFixed(2)
      : null,
    availability: comparedOdds.available ? 'available' : 'unavailable',
    status: comparedOdds.available ? 'matched' : 'unavailable',
    notes: comparedOdds.available ? `Recommended provider: ${comparedOdds.recommendedProvider}` : 'No Betfair odds available for selection',
  };
}

export function createBetfairAdapter(): BookmakerAdapter {
  const client = new BetfairAdapterClient();

  return {
    bookmaker: 'betfair',
    capability: getBetfairCapability(),
    async decodeBetCode(code: string): Promise<DecodedBetSlip> {
      const authResult = await client.login();
      ensureOk(authResult);

      const eventsResult = await client.getEvents();
      const events = ensureOk(eventsResult);

      const marketsResult = await client.getMarkets(events.slice(0, 10).map((event) => event.eventId));
      const markets = ensureOk(marketsResult);

      if (events.length === 0 || markets.length === 0) {
        throw new Error('Betfair integration required. Event or market data unavailable for decoding.');
      }

      throw new Error('Betfair decodeBetCode endpoint contract is not finalized. Integration required.');
    },
    extractSelections(decoded: DecodedBetSlip): BetSelection[] {
      return decodedSlipToNormalized(decoded);
    },
    async normalizeEvents(selections: BetSelection[], _destination: BookmakerId): Promise<BetSelection[]> {
      return normalizeBetfairEvents(selections);
    },
    async normalizeMarkets(selections: BetSelection[], _destination: BookmakerId): Promise<BetSelection[]> {
      return normalizeBetfairMarkets(selections);
    },
    async compareOdds(selections: BetSelection[], _destination: BookmakerId): Promise<ConvertedSelection[]> {
      const auth = await client.login();
      ensureOk(auth);

      const events = ensureOk(await client.getEvents());
      const eventIds = events.slice(0, 25).map((event) => event.eventId);
      const markets = ensureOk(await client.getMarkets(eventIds));
      const marketIds = Array.from(new Set(markets.map((market) => market.marketId)));
      const marketBook = ensureOk(await client.getMarketBook(marketIds));

      const mapped = buildBetfairSelections(selections, events, markets, marketBook);

      return mapped.map((selection) => {
        const compared = client.compareOdds(selection.sourceOdds, selection.betfairOdds);
        return toConvertedSelection(selection, compared);
      });
    },
    async generateBetSlip(selections: BetSelection[]): Promise<string> {
      const result = await client.generateBetSlip([]);
      const slip = ensureOk(result);
      return slip.slipId;
    },
  };
}

export const betfairAdapter = createBetfairAdapter();
