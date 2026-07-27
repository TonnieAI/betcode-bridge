import type { BookmakerAdapter } from './types';
import { createIntegrationRequiredAdapter } from './integrationRequiredAdapter';
import { bet365Adapter } from '../providers/adapters/bet365';
import { betfairAdapter } from '../providers/adapters/betfair';
import { skyBetAdapter } from '../providers/adapters/skybet';
import { williamHillAdapter } from '../providers/adapters/williamhill';

export const ukBookmakerAdapters: BookmakerAdapter[] = [
  bet365Adapter,
  williamHillAdapter,
  createIntegrationRequiredAdapter('ladbrokes', 'Official Ladbrokes API or licensed data feed'),
  createIntegrationRequiredAdapter('coral', 'Official Coral API or licensed data feed'),
  createIntegrationRequiredAdapter('paddypower', 'Official Paddy Power API or licensed data feed'),
  skyBetAdapter,
  betfairAdapter,
  createIntegrationRequiredAdapter('betvictor', 'Official BetVictor API or licensed data feed'),
  createIntegrationRequiredAdapter('unibet', 'Official Unibet API or licensed data feed'),
  createIntegrationRequiredAdapter('888sport', 'Official 888sport API or licensed data feed'),
];
