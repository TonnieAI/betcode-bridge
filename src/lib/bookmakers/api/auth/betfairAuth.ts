import { validateProviderCredentials } from '../bookmakerApiClient';

const BETFAIR_REQUIRED_ENV = ['BETFAIR_APP_KEY', 'BETFAIR_USERNAME', 'BETFAIR_PASSWORD'];

export function getBetfairAuthDiagnostics() {
  return validateProviderCredentials('betfair', BETFAIR_REQUIRED_ENV);
}

export function getBetfairAuthHeader() {
  const diagnostics = getBetfairAuthDiagnostics();
  if (!diagnostics.credentialsConfigured) {
    return null;
  }

  return {
    appKey: 'configured',
    sessionToken: 'pending_login_flow',
  };
}
