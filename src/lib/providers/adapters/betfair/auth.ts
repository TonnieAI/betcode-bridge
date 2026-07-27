import { validateProviderCredentials } from '../../../bookmakers/api/bookmakerApiClient.js';

export const BETFAIR_REQUIRED_ENV = ['BETFAIR_APP_KEY', 'BETFAIR_USERNAME', 'BETFAIR_PASSWORD'] as const;

type BackendEnv = {
  appKey: string;
  username: string;
  password: string;
};

function getBackendEnv(): Record<string, string | undefined> {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env ?? {};
}

export function getBetfairCredentialDiagnostics() {
  return validateProviderCredentials('betfair', [...BETFAIR_REQUIRED_ENV]);
}

export function getBetfairCredentials(): BackendEnv | null {
  const diagnostics = getBetfairCredentialDiagnostics();
  if (!diagnostics.credentialsConfigured) {
    return null;
  }

  const env = getBackendEnv();
  return {
    appKey: (env.BETFAIR_APP_KEY ?? '').trim(),
    username: (env.BETFAIR_USERNAME ?? '').trim(),
    password: (env.BETFAIR_PASSWORD ?? '').trim(),
  };
}

export function getBetfairMissingCredentialKeys(): string[] {
  const diagnostics = getBetfairCredentialDiagnostics();
  if (diagnostics.credentialsConfigured) {
    return [];
  }

  return BETFAIR_REQUIRED_ENV.filter((key) => {
    const entry = diagnostics.credentials.find((credential) => credential.name === key);
    return !entry?.exists;
  });
}

export function getBetfairApiBaseUrls() {
  const env = getBackendEnv();

  return {
    identity: (env.BETFAIR_IDENTITY_BASE_URL ?? 'https://identitysso.betfair.com').trim(),
    betting: (env.BETFAIR_BETTING_BASE_URL ?? 'https://api.betfair.com/exchange/betting/json-rpc/v1').trim(),
  };
}
