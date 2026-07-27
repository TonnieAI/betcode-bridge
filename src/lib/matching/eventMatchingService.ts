import type { BetSelection } from '../normalizedBetting';

const TEAM_ALIASES: Record<string, string> = {
  'man utd': 'manchester united',
  'man united': 'manchester united',
  manutd: 'manchester united',
  'man city': 'manchester city',
  'spurs': 'tottenham hotspur',
  psg: 'paris saint germain',
  inter: 'inter milan',
  juve: 'juventus',
};

const LEAGUE_ALIASES: Record<string, string> = {
  epl: 'premier league',
  'english premier league': 'premier league',
  'prem league': 'premier league',
  ucl: 'uefa champions league',
  'champions league': 'uefa champions league',
  npfl: 'nigerian premier football league',
};

const MARKET_ALIASES: Record<string, string> = {
  'over 2.5': 'total goals over 2.5',
  'under 2.5': 'total goals under 2.5',
  'o 2.5': 'total goals over 2.5',
  'u 2.5': 'total goals under 2.5',
  '1x2': 'match winner',
  'match result': 'match winner',
  'btts yes': 'both teams to score yes',
  'btts no': 'both teams to score no',
};

function canonicalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.+ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveAlias(value: string, aliases: Record<string, string>): string {
  const canonical = canonicalize(value);
  return aliases[canonical] ?? canonical;
}

export function normalizeTeamName(team: string): string {
  return resolveAlias(team, TEAM_ALIASES);
}

export function normalizeLeagueName(league: string): string {
  return resolveAlias(league, LEAGUE_ALIASES);
}

export function normalizeMarketName(market: string): string {
  return resolveAlias(market, MARKET_ALIASES);
}

export function normalizeSelectionName(selection: string): string {
  return canonicalize(selection);
}

export function normalizeSelectionsForMatching(selections: BetSelection[]): BetSelection[] {
  return selections.map((selection) => ({
    ...selection,
    event: {
      ...selection.event,
      homeTeam: normalizeTeamName(selection.event.homeTeam),
      awayTeam: normalizeTeamName(selection.event.awayTeam),
      league: normalizeLeagueName(selection.event.league),
    },
    market: normalizeMarketName(selection.market),
    selection: normalizeSelectionName(selection.selection),
  }));
}
