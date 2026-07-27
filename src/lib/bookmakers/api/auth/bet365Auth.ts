import { validateProviderCredentials } from '../bookmakerApiClient';

const BET365_REQUIRED_ENV = ['BET365_API_KEY', 'BET365_API_SECRET'];

export function getBet365AuthDiagnostics() {
  return validateProviderCredentials('bet365', BET365_REQUIRED_ENV);
}

export function getBet365AuthHeader() {
  const diagnostics = getBet365AuthDiagnostics();
  if (!diagnostics.credentialsConfigured) {
    return null;
  }

  return {
    apiKey: 'configured',
    signature: 'configured',
  };
}
