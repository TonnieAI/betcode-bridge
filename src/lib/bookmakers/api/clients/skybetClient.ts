import { getSkyBetAuthDiagnostics } from '../auth/skybetAuth';
import { throwIntegrationRequired } from '../bookmakerApiClient';

export class SkyBetApiClient {
  getDiagnostics() {
    return getSkyBetAuthDiagnostics();
  }

  assertConfigured(): void {
    const diagnostics = this.getDiagnostics();
    if (!diagnostics.credentialsConfigured) {
      throwIntegrationRequired('skybet', diagnostics.missingRequirements);
    }
  }
}
