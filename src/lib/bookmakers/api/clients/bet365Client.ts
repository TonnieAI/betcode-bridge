import { getBet365AuthDiagnostics } from '../auth/bet365Auth';
import { throwIntegrationRequired } from '../bookmakerApiClient';

export class Bet365ApiClient {
  getDiagnostics() {
    return getBet365AuthDiagnostics();
  }

  assertConfigured(): void {
    const diagnostics = this.getDiagnostics();
    if (!diagnostics.credentialsConfigured) {
      throwIntegrationRequired('bet365', diagnostics.missingRequirements);
    }
  }
}
