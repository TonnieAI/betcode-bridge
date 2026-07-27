import { validateProviderCredentials } from '../bookmakerApiClient';

const SKYBET_REQUIRED_ENV = ['SKYBET_API_KEY', 'SKYBET_API_SECRET'];

export function getSkyBetAuthDiagnostics() {
  return validateProviderCredentials('skybet', SKYBET_REQUIRED_ENV);
}

export function getSkyBetAuthHeader() {
  const diagnostics = getSkyBetAuthDiagnostics();
  if (!diagnostics.credentialsConfigured) {
    return null;
  }

  return {
    apiKey: 'configured',
    signature: 'configured',
  };
}
