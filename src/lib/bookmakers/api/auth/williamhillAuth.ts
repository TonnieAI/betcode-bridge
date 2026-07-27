import { validateProviderCredentials } from '../bookmakerApiClient';

const WILLIAMHILL_REQUIRED_ENV = ['WILLIAMHILL_API_KEY', 'WILLIAMHILL_API_SECRET'];

export function getWilliamHillAuthDiagnostics() {
  return validateProviderCredentials('williamhill', WILLIAMHILL_REQUIRED_ENV);
}

export function getWilliamHillAuthHeader() {
  const diagnostics = getWilliamHillAuthDiagnostics();
  if (!diagnostics.credentialsConfigured) {
    return null;
  }

  return {
    apiKey: 'configured',
    signature: 'configured',
  };
}
