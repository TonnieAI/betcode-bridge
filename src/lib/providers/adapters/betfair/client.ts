import {
  getBetfairApiBaseUrls,
  getBetfairCredentialDiagnostics,
  getBetfairCredentials,
  getBetfairMissingCredentialKeys,
} from './auth';
import type {
  BetfairAuthResponse,
  BetfairCapabilityResult,
  BetfairEvent,
  BetfairMarket,
  BetfairMarketBookEntry,
  BetfairOddsComparison,
  BetfairOperationResult,
} from './types';
import { mapBetfairEvents, mapBetfairMarketBook, mapBetfairMarkets } from './mapper';

interface BetfairProbeState {
  authenticated: boolean;
  eventsLoaded: boolean;
  marketsLoaded: boolean;
  slipGenerationValidated: boolean;
  endToEndConversionValidated: boolean;
}

function defaultProbeState(): BetfairProbeState {
  return {
    authenticated: false,
    eventsLoaded: false,
    marketsLoaded: false,
    slipGenerationValidated: false,
    endToEndConversionValidated: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readEnvFlag(name: string): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const raw = env?.[name]?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class BetfairAdapterClient {
  private sessionToken: string | null = null;
  private probeState: BetfairProbeState = {
    authenticated: readEnvFlag('BETFAIR_AUTH_VALIDATED'),
    eventsLoaded: readEnvFlag('BETFAIR_EVENTS_VALIDATED'),
    marketsLoaded: readEnvFlag('BETFAIR_MARKETS_VALIDATED'),
    slipGenerationValidated: readEnvFlag('BETFAIR_SLIP_GENERATION_VALIDATED'),
    endToEndConversionValidated: readEnvFlag('BETFAIR_E2E_CONVERSION_VALIDATED'),
  };

  getDiagnostics() {
    return getBetfairCredentialDiagnostics();
  }

  getCapability(): BetfairCapabilityResult {
    const diagnostics = this.getDiagnostics();
    if (!diagnostics.credentialsConfigured) {
      return {
        availability: 'integration_required',
        requiresAPI: true,
        missingRequirements: getBetfairMissingCredentialKeys(),
      };
    }

    if (
      this.probeState.authenticated
      && this.probeState.eventsLoaded
      && this.probeState.marketsLoaded
      && this.probeState.slipGenerationValidated
      && this.probeState.endToEndConversionValidated
    ) {
      return {
        availability: 'full',
        requiresAPI: true,
        missingRequirements: [],
      };
    }

    if (this.probeState.authenticated && this.probeState.eventsLoaded && this.probeState.marketsLoaded) {
      return {
        availability: 'partial',
        requiresAPI: true,
        missingRequirements: [
          'Betfair slip generation validation pending',
          'Betfair end-to-end conversion validation pending',
        ],
      };
    }

    return {
      availability: 'integration_required',
      requiresAPI: true,
      missingRequirements: ['Betfair authenticated events/markets validation pending'],
    };
  }

  private missingCredentialsResult<T>(): BetfairOperationResult<T> {
    return {
      ok: false,
      availability: 'integration_required',
      reason: 'Missing Betfair API credentials',
      missingRequirements: getBetfairMissingCredentialKeys(),
    };
  }

  private async callJsonRpc<T>(method: string, params: Record<string, unknown>): Promise<BetfairOperationResult<T>> {
    if (!this.sessionToken) {
      const loginResult = await this.login();
      if (!loginResult.ok) {
        return loginResult;
      }
    }

    const urls = getBetfairApiBaseUrls();
    const credentials = getBetfairCredentials();

    if (!credentials) {
      return this.missingCredentialsResult<T>();
    }

    const response = await fetch(urls.betting, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Application': credentials.appKey,
        'X-Authentication': this.sessionToken ?? '',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: 1,
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        availability: 'unavailable',
        reason: `Betfair request failed with HTTP ${response.status}`,
        missingRequirements: [],
      };
    }

    const text = await response.text();
    const parsed = parseJson(text);

    if (!Array.isArray(parsed) || parsed.length === 0 || !isRecord(parsed[0])) {
      return {
        ok: false,
        availability: 'unavailable',
        reason: 'Betfair response format is invalid',
        missingRequirements: [],
      };
    }

    const first = parsed[0] as Record<string, unknown>;
    if (isRecord(first.error)) {
      return {
        ok: false,
        availability: 'unavailable',
        reason: 'Betfair returned API error',
        missingRequirements: [],
      };
    }

    return {
      ok: true,
      data: (first.result as T),
    };
  }

  async login(): Promise<BetfairOperationResult<BetfairAuthResponse>> {
    const credentials = getBetfairCredentials();
    if (!credentials) {
      return this.missingCredentialsResult();
    }

    const urls = getBetfairApiBaseUrls();
    const body = new URLSearchParams({
      username: credentials.username,
      password: credentials.password,
    });

    const response = await fetch(`${urls.identity}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'X-Application': credentials.appKey,
      },
      body,
    });

    if (!response.ok) {
      return {
        ok: false,
        availability: 'unavailable',
        reason: `Betfair authentication failed with HTTP ${response.status}`,
        missingRequirements: [],
      };
    }

    const text = await response.text();
    const payload = parseJson(text);

    if (!isRecord(payload)) {
      return {
        ok: false,
        availability: 'unavailable',
        reason: 'Betfair authentication response could not be parsed',
        missingRequirements: [],
      };
    }

    const status = String(payload.status ?? '').toUpperCase();
    const token = typeof payload.token === 'string' ? payload.token : '';

    if (status !== 'SUCCESS' || token.length === 0) {
      return {
        ok: false,
        availability: 'unavailable',
        reason: 'Betfair authentication rejected credentials',
        missingRequirements: [],
      };
    }

    this.sessionToken = token;
    this.probeState = {
      ...this.probeState,
      authenticated: true,
    };

    return {
      ok: true,
      data: { sessionToken: token },
    };
  }

  async getEvents(): Promise<BetfairOperationResult<BetfairEvent[]>> {
    const result = await this.callJsonRpc<Array<{ event: { id: string; name: string; countryCode?: string; openDate?: string }; competition?: { name?: string } }>>(
      'SportsAPING/v1.0/listEvents',
      {
        filter: {
          eventTypeIds: ['1'],
          marketCountries: ['GB'],
          textQuery: 'football',
        },
      },
    );

    if (!result.ok) {
      return result;
    }

    this.probeState = {
      ...this.probeState,
      eventsLoaded: true,
    };

    return {
      ok: true,
      data: mapBetfairEvents(result.data),
    };
  }

  async getMarkets(eventIds: string[]): Promise<BetfairOperationResult<BetfairMarket[]>> {
    const result = await this.callJsonRpc<Array<{ marketId: string; marketName: string; event?: { id: string }; runners?: Array<{ selectionId: number; runnerName: string }> }>>(
      'SportsAPING/v1.0/listMarketCatalogue',
      {
        filter: {
          eventIds,
          marketTypeCodes: ['MATCH_ODDS', 'OVER_UNDER_25', 'BOTH_TEAMS_TO_SCORE'],
        },
        maxResults: 100,
        marketProjection: ['RUNNER_METADATA', 'EVENT', 'COMPETITION'],
      },
    );

    if (!result.ok) {
      return result;
    }

    this.probeState = {
      ...this.probeState,
      marketsLoaded: true,
    };

    return {
      ok: true,
      data: mapBetfairMarkets(result.data),
    };
  }

  async getMarketBook(marketIds: string[]): Promise<BetfairOperationResult<BetfairMarketBookEntry[]>> {
    const result = await this.callJsonRpc<Array<{ marketId: string; runners?: Array<{ selectionId: number; ex?: { availableToBack?: Array<{ price: number }> } }> }>>(
      'SportsAPING/v1.0/listMarketBook',
      {
        marketIds,
        priceProjection: {
          priceData: ['EX_BEST_OFFERS'],
        },
      },
    );

    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      data: mapBetfairMarketBook(result.data),
    };
  }

  compareOdds(sourceOdds: number, betfairOdds: number | null): BetfairOddsComparison {
    if (betfairOdds == null || !Number.isFinite(betfairOdds)) {
      return {
        available: false,
        oddsDifference: null,
        recommendedProvider: 'none',
      };
    }

    const oddsDifference = +(betfairOdds - sourceOdds).toFixed(2);

    if (oddsDifference > 0) {
      return {
        available: true,
        oddsDifference,
        recommendedProvider: 'betfair',
      };
    }

    if (oddsDifference < 0) {
      return {
        available: true,
        oddsDifference,
        recommendedProvider: 'source',
      };
    }

    return {
      available: true,
      oddsDifference: 0,
      recommendedProvider: 'equal',
    };
  }

  async generateBetSlip(_selections: BetfairMarket[]): Promise<BetfairOperationResult<{ slipId: string }>> {
    return {
      ok: false,
      availability: 'integration_required',
      reason: 'Betfair slip generation endpoint is not configured',
      missingRequirements: ['Betfair slip generation endpoint contract', 'Betfair end-to-end conversion validation'],
    };
  }

  async runCapabilityProbe(): Promise<BetfairCapabilityResult> {
    const loginResult = await this.login();
    if (!loginResult.ok) {
      return {
        availability: loginResult.availability,
        requiresAPI: true,
        missingRequirements: loginResult.missingRequirements.length > 0
          ? loginResult.missingRequirements
          : [loginResult.reason],
      };
    }

    const eventsResult = await this.getEvents();
    if (!eventsResult.ok) {
      return {
        availability: 'integration_required',
        requiresAPI: true,
        missingRequirements: [eventsResult.reason],
      };
    }

    const marketResult = await this.getMarkets(eventsResult.data.slice(0, 10).map((event) => event.eventId));
    if (!marketResult.ok) {
      return {
        availability: 'integration_required',
        requiresAPI: true,
        missingRequirements: [marketResult.reason],
      };
    }

    return this.getCapability();
  }
}
