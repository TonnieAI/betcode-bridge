import { getBetfairAuthDiagnostics } from '../auth/betfairAuth';
import { throwIntegrationRequired } from '../bookmakerApiClient';

export class BetfairApiClient {
  getDiagnostics() {
    return getBetfairAuthDiagnostics();
  }

  assertConfigured(): void {
    const diagnostics = this.getDiagnostics();
    if (!diagnostics.credentialsConfigured) {
      throwIntegrationRequired('betfair', diagnostics.missingRequirements);
    }
  }
}
