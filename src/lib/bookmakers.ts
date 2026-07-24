import type { Bookmaker, BookmakerId } from './types';

export const BOOKMAKERS: Record<BookmakerId, Bookmaker> = {
  bet9ja: {
    id: 'bet9ja',
    name: 'Bet9ja',
    shortName: 'B9',
    color: '#00a651',
    website: 'https://bet9ja.com',
    active: true,
    integrationMode: 'simulated',
  },
  sportybet: {
    id: 'sportybet',
    name: 'SportyBet',
    shortName: 'SB',
    color: '#0b9d00',
    website: 'https://sportybet.com',
    active: true,
    integrationMode: 'live',
  },
  betking: {
    id: 'betking',
    name: 'BetKing',
    shortName: 'BK',
    color: '#f5a623',
    website: 'https://betking.com',
    active: true,
    integrationMode: 'simulated',
  },
  '1xbet': {
    id: '1xbet',
    name: '1xBet Nigeria',
    shortName: '1X',
    color: '#0a6cff',
    website: 'https://1xbet.ng',
    active: true,
    integrationMode: 'simulated',
  },
  nairabet: {
    id: 'nairabet',
    name: 'NairaBet',
    shortName: 'NB',
    color: '#1a73e8',
    website: 'https://nairabet.com',
    active: true,
    integrationMode: 'simulated',
  },
  merrybet: {
    id: 'merrybet',
    name: 'MerryBet',
    shortName: 'MB',
    color: '#d4af37',
    website: 'https://merrybet.com',
    active: true,
    integrationMode: 'simulated',
  },
  bangbet: {
    id: 'bangbet',
    name: 'BangBet',
    shortName: 'BB',
    color: '#e6007e',
    website: 'https://bangbet.com',
    active: true,
    integrationMode: 'simulated',
  },
  msport: {
    id: 'msport',
    name: 'MSport',
    shortName: 'MS',
    color: '#7b2ff7',
    website: 'https://msport.com',
    active: true,
    integrationMode: 'simulated',
  },
  surebet247: {
    id: 'surebet247',
    name: 'SureBet247',
    shortName: 'S247',
    color: '#ff6b00',
    website: 'https://surebet247.com',
    active: true,
    integrationMode: 'simulated',
  },
  premierbet: {
    id: 'premierbet',
    name: 'Premier Bet Nigeria',
    shortName: 'PB',
    color: '#c8102e',
    website: 'https://premierbet.com',
    active: true,
    integrationMode: 'simulated',
  },
};

export const BOOKMAKER_LIST = Object.values(BOOKMAKERS);

export function getBookmaker(id: BookmakerId): Bookmaker {
  return BOOKMAKERS[id];
}

export function getIntegrationModeLabel(id: BookmakerId): string {
  return BOOKMAKERS[id].integrationMode === 'live' ? 'Live API' : 'Simulated';
}

export function isBookmakerLive(id: BookmakerId): boolean {
  return BOOKMAKERS[id].integrationMode === 'live';
}
