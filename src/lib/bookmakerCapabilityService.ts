import { BOOKMAKERS } from './bookmakers';
import type { BookmakerId } from './types';
import { listBookmakerCapabilities } from './adapters';

export type BookmakerIntegrationStatus = 'full' | 'partial' | 'integration_required';
export type BookmakerIntegrationStage = 'integration_required' | 'credentials_valid' | 'api_connected' | 'partial' | 'full';

export interface BookmakerCapabilityRecord {
  id: BookmakerId;
  name: string;
  country: string;
  status: BookmakerIntegrationStatus;
  progressionStage: BookmakerIntegrationStage;
  canDecode: boolean;
  canGenerateSlip: boolean;
  requiresAPI: boolean;
  missingRequirements: string[];
}

const COUNTRY_BY_BOOKMAKER: Record<BookmakerId, string> = {
  bet9ja: 'NG',
  sportybet: 'NG',
  betking: 'NG',
  '1xbet': 'NG',
  nairabet: 'NG',
  merrybet: 'NG',
  bangbet: 'NG',
  msport: 'NG',
  surebet247: 'NG',
  premierbet: 'NG',
  bet365: 'GB',
  williamhill: 'GB',
  ladbrokes: 'GB',
  coral: 'GB',
  paddypower: 'GB',
  skybet: 'GB',
  betfair: 'GB',
  betvictor: 'GB',
  unibet: 'GB',
  '888sport': 'GB',
};

function toStatus(availability: 'full' | 'partial' | 'integration_required' | 'unavailable'): BookmakerIntegrationStatus {
  if (availability === 'full') return 'full';
  if (availability === 'partial') return 'partial';
  return 'integration_required';
}

function readEnvFlag(name: string): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const raw = env?.[name]?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function toProgressionStage(
  id: BookmakerId,
  status: BookmakerIntegrationStatus,
  missingRequirements: string[],
): BookmakerIntegrationStage {
  if (status === 'full') {
    return 'full';
  }

  if (id !== 'betfair') {
    return status === 'partial' ? 'partial' : 'integration_required';
  }

  const authValidated = readEnvFlag('BETFAIR_AUTH_VALIDATED');
  const eventsValidated = readEnvFlag('BETFAIR_EVENTS_VALIDATED');
  const marketsValidated = readEnvFlag('BETFAIR_MARKETS_VALIDATED');

  const hasMissingCredentials = missingRequirements.some((requirement) => requirement.startsWith('BETFAIR_'));

  if (hasMissingCredentials) {
    return 'integration_required';
  }

  if (!authValidated) {
    return 'credentials_valid';
  }

  if (authValidated && (!eventsValidated || !marketsValidated)) {
    return 'api_connected';
  }

  if (status === 'partial') {
    return 'partial';
  }

  return 'credentials_valid';
}

export function listBookmakerCapabilityRecords(): BookmakerCapabilityRecord[] {
  const capabilityById = new Map(listBookmakerCapabilities().map((capability) => [capability.bookmaker, capability]));

  return Object.keys(BOOKMAKERS).map((id) => {
    const bookmakerId = id as BookmakerId;
    const capability = capabilityById.get(bookmakerId);
    const status = toStatus(capability?.availability ?? 'unavailable');
    const missingRequirements = capability?.missingRequirements ?? ['Not configured'];

    return {
      id: bookmakerId,
      name: BOOKMAKERS[bookmakerId].name,
      country: COUNTRY_BY_BOOKMAKER[bookmakerId] ?? 'NG',
      status,
      progressionStage: toProgressionStage(bookmakerId, status, missingRequirements),
      canDecode: capability?.canDecode ?? false,
      canGenerateSlip: capability?.canGenerateSlip ?? false,
      requiresAPI: capability?.requiresAPI ?? true,
      missingRequirements,
    };
  });
}
