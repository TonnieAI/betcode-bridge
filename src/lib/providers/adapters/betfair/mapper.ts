import type { BetSelection } from '../../../normalizedBetting';
import type {
  BetfairEvent,
  BetfairMappedSelection,
  BetfairMarket,
  BetfairMarketBookEntry,
} from './types';
import { normalizeBetfairEvents, normalizeBetfairMarkets } from './normalizer';

const SUPPORTED_MARKETS = new Set(['MATCH_ODDS', 'OVER_UNDER_25', 'BOTH_TEAMS_TO_SCORE']);

type RawBetfairEventEntry = {
  event: { id: string; name: string; countryCode?: string; openDate?: string };
  competition?: { name?: string };
};

type RawBetfairMarketEntry = {
  marketId: string;
  marketName: string;
  event?: { id: string };
  runners?: Array<{ selectionId: number; runnerName: string }>;
};

type RawBetfairMarketBookEntry = {
  marketId: string;
  runners?: Array<{ selectionId: number; ex?: { availableToBack?: Array<{ price: number }> } }>;
};

function splitEventName(raw: string): { homeTeam: string; awayTeam: string } {
  const normalized = raw.replace(/\s+v\s+/i, ' vs ').trim();
  const [home, away] = normalized.split(/\s+vs\s+/i);

  return {
    homeTeam: (home ?? raw).trim(),
    awayTeam: (away ?? '').trim(),
  };
}

export function mapBetfairEvents(rawEvents: RawBetfairEventEntry[]): BetfairEvent[] {
  return rawEvents.map((entry) => {
    const teams = splitEventName(entry.event.name);

    return {
      eventId: entry.event.id,
      sport: 'football',
      competition: entry.competition?.name ?? 'Unknown Competition',
      country: entry.event.countryCode ?? 'Unknown',
      homeTeam: teams.homeTeam,
      awayTeam: teams.awayTeam,
      startTime: entry.event.openDate ? new Date(entry.event.openDate).toISOString() : new Date().toISOString(),
    };
  });
}

export function mapBetfairMarkets(rawMarkets: RawBetfairMarketEntry[]): BetfairMarket[] {
  const mapped: BetfairMarket[] = [];

  for (const market of rawMarkets) {
    if (!SUPPORTED_MARKETS.has(market.marketName.toUpperCase().replace(/\s+/g, '_'))) {
      continue;
    }

    const runners = market.runners ?? [];

    for (const runner of runners) {
      mapped.push({
        eventId: market.event?.id ?? '',
        marketId: market.marketId,
        marketName: market.marketName,
        selectionId: String(runner.selectionId),
        runnerName: runner.runnerName,
      });
    }
  }

  return mapped;
}

export function mapBetfairMarketBook(rawBooks: RawBetfairMarketBookEntry[]): BetfairMarketBookEntry[] {
  const rows: BetfairMarketBookEntry[] = [];

  for (const book of rawBooks) {
    for (const runner of book.runners ?? []) {
      const bestBack = runner.ex?.availableToBack?.[0]?.price;
      if (!Number.isFinite(bestBack)) continue;

      rows.push({
        marketId: book.marketId,
        selectionId: String(runner.selectionId),
        odds: Number(bestBack),
      });
    }
  }

  return rows;
}

export function buildBetfairSelections(
  sourceSelections: BetSelection[],
  events: BetfairEvent[],
  markets: BetfairMarket[],
  prices: BetfairMarketBookEntry[],
): BetfairMappedSelection[] {
  const normalizedSource = normalizeBetfairMarkets(normalizeBetfairEvents(sourceSelections));
  const priceByMarketRunner = new Map(prices.map((price) => [`${price.marketId}:${price.selectionId}`, price.odds]));

  return normalizedSource.map((selection) => {
    const event = events.find((candidate) =>
      candidate.homeTeam.toLowerCase() === selection.event.homeTeam.toLowerCase()
      && candidate.awayTeam.toLowerCase() === selection.event.awayTeam.toLowerCase()
    );

    const market = markets.find((candidate) =>
      candidate.eventId === (event?.eventId ?? '')
      && candidate.marketName.toLowerCase() === selection.market.toLowerCase()
      && candidate.runnerName.toLowerCase() === selection.selection.toLowerCase()
    );

    const odds = market ? priceByMarketRunner.get(`${market.marketId}:${market.selectionId}`) : undefined;

    return {
      ...selection,
      event: {
        id: event?.eventId,
        sport: event?.sport,
        competition: event?.competition,
        country: event?.country,
        homeTeam: event?.homeTeam ?? selection.event.homeTeam,
        awayTeam: event?.awayTeam ?? selection.event.awayTeam,
        league: event?.competition ?? selection.event.league,
        startTime: event?.startTime ?? selection.event.startTime,
      },
      marketId: market?.marketId,
      selectionId: market?.selectionId,
      odds: selection.odds,
      sourceOdds: selection.odds,
      betfairOdds: odds ?? null,
    };
  });
}
