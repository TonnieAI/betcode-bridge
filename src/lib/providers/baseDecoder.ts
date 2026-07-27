import type { BookmakerId, DecodedBetSlip, DecodedSelection, ShareCodeApiResponse } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Base decoder helpers
//
// In production, each bookmaker's `decode()` method calls the official API or
// licensed data provider for that bookmaker and returns the normalized
// `DecodedBetSlip`. The local simulation below generates deterministic sample
// data from the bet code so the full conversion pipeline is exercisable without
// live API access. When an official API is connected, only the body of `decode`
// changes — the interface and all downstream code remain identical.
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_FIXTURES: Array<{ home: string; away: string; league: string }> = [
  { home: 'Manchester United', away: 'Liverpool', league: 'Premier League' },
  { home: 'Chelsea', away: 'Arsenal', league: 'Premier League' },
  { home: 'Manchester City', away: 'Tottenham Hotspur', league: 'Premier League' },
  { home: 'Barcelona', away: 'Real Madrid', league: 'La Liga' },
  { home: 'Juventus', away: 'Inter Milan', league: 'Serie A' },
  { home: 'Bayern Munich', away: 'Borussia Dortmund', league: 'Bundesliga' },
  { home: 'Paris Saint-Germain', away: 'Olympique Marseille', league: 'Ligue 1' },
  { home: 'Enyimba FC', away: 'Rivers United', league: 'NPFL' },
  { home: 'Kano Pillars', away: 'Enugu Rangers', league: 'NPFL' },
  { home: 'Ajax', away: 'PSV Eindhoven', league: 'Eredivisie' },
];

const SAMPLE_MARKETS: Array<{ market: string; selection: string }> = [
  { market: 'Match Winner', selection: 'Home Win' },
  { market: 'Match Winner', selection: 'Away Win' },
  { market: 'Match Winner', selection: 'Draw' },
  { market: 'Double Chance', selection: 'Home or Draw' },
  { market: 'Over/Under Goals', selection: 'Over 2.5' },
  { market: 'Over/Under Goals', selection: 'Under 2.5' },
  { market: 'Both Teams to Score', selection: 'Yes' },
  { market: 'Both Teams to Score', selection: 'No' },
  { market: 'Draw No Bet', selection: 'Home Win' },
  { market: 'Asian Handicap', selection: 'Home Win' },
];

function seedFromCode(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i++) {
    h = (h << 5) - h + code.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function splitEventName(eventName: string): { homeTeam: string; awayTeam: string } {
  const separator = eventName.includes(' vs ') ? ' vs ' : eventName.includes(' v ') ? ' v ' : null;

  if (!separator) {
    return { homeTeam: eventName.trim(), awayTeam: '' };
  }

  const [homeTeam, awayTeam] = eventName.split(separator);
  return {
    homeTeam: homeTeam.trim(),
    awayTeam: awayTeam.trim(),
  };
}

export function mapShareCodeResponseToDecodedSlip(
  bookmakerId: BookmakerId,
  response: ShareCodeApiResponse,
): DecodedBetSlip {
  const selections: DecodedSelection[] = response.data.outcomes.map((outcome, index) => {
    const { homeTeam, awayTeam } = splitEventName(outcome.eventName);
    const odds = Number.parseFloat(outcome.odds);
    const kickoff = new Date(Date.now() + index * 60 * 60 * 1000).toISOString();

    return {
      match: outcome.eventName,
      league: outcome.specifier ?? '',
      homeTeam,
      awayTeam,
      kickoff,
      market: outcome.marketName,
      selection: outcome.specifier ?? outcome.marketName,
      odds: Number.isFinite(odds) ? odds : 0,
    };
  });

  const totalOdds = +selections.reduce((acc, selection) => acc * selection.odds, 1).toFixed(2);

  return {
    bookmaker: bookmakerId,
    code: response.data.shareCode,
    selections,
    totalOdds,
    decodedAt: new Date().toISOString(),
  };
}

export function generateSampleSlip(
  bookmakerId: string,
  code: string,
  selectionCount?: number,
): DecodedBetSlip {
  const seed = seedFromCode(code);
  const rng = seededRandom(seed);
  const count = selectionCount ?? (2 + (seed % 4)); // 2–5 selections
  const selections: DecodedSelection[] = [];

  for (let i = 0; i < count; i++) {
    const fixture = pick(SAMPLE_FIXTURES, seed + i * 7);
    const market = pick(SAMPLE_MARKETS, seed + i * 13);
    const odds = +(1.4 + rng() * 2.5).toFixed(2);
    const kickoffDate = new Date();
    kickoffDate.setDate(kickoffDate.getDate() + (i + 1));
    kickoffDate.setHours(18 + (i % 3), 0, 0, 0);

    selections.push({
      match: `${fixture.home} vs ${fixture.away}`,
      league: fixture.league,
      homeTeam: fixture.home,
      awayTeam: fixture.away,
      kickoff: kickoffDate.toISOString(),
      market: market.market,
      selection: market.selection,
      odds,
    });
  }

  const totalOdds = +selections.reduce((acc, s) => acc * s.odds, 1).toFixed(2);

  return {
    bookmaker: bookmakerId as never,
    code,
    selections,
    totalOdds,
    stake: 1000,
    potentialReturn: +(totalOdds * 1000).toFixed(2),
    decodedAt: new Date().toISOString(),
  };
}

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generates a deterministic bet code for a destination bookmaker from a set
 * of normalized selections. In production this calls the destination
 * bookmaker's official API to create a shareable bet slip and returns its
 * code. The interface stays the same — only the implementation changes.
 */
export function generateDestinationCode(
  bookmakerId: BookmakerId,
  selections: DecodedSelection[],
): string {
  const fingerprint = selections
    .map((s) => `${s.homeTeam}|${s.awayTeam}|${s.market}|${s.selection}|${s.odds}`)
    .join('||');
  const seed = seedFromCode(`${bookmakerId}-${fingerprint}`);
  const rng = seededRandom(seed);

  const prefixMap: Record<string, string> = {
    bet9ja: 'B9',
    sportybet: 'SB',
    betking: 'BK',
    '1xbet': 'X1',
    nairabet: 'NB',
    merrybet: 'MB',
    bangbet: 'BB',
    msport: 'MS',
    surebet247: 'S2',
    premierbet: 'PB',
    bet365: 'B3',
    williamhill: 'WH',
    ladbrokes: 'LB',
    coral: 'CR',
    paddypower: 'PP',
    skybet: 'SK',
    betfair: 'BF',
    betvictor: 'BV',
    unibet: 'UN',
    '888sport': 'E8',
  };

  const prefix = prefixMap[bookmakerId] ?? 'BC';
  const bodyLen = 6 + Math.floor(rng() * 4); // 6–9 chars
  let body = '';
  for (let i = 0; i < bodyLen; i++) {
    body += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  }
  return `${prefix}${body}`;
}
