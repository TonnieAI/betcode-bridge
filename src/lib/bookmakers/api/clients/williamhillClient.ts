import { getWilliamHillAuthDiagnostics } from '../auth/williamhillAuth';
import { throwIntegrationRequired } from '../bookmakerApiClient';

export class WilliamHillApiClient {
  getDiagnostics() {
    return getWilliamHillAuthDiagnostics();
  }

  assertConfigured(): void {
    const diagnostics = this.getDiagnostics();
    if (!diagnostics.credentialsConfigured) {
      throwIntegrationRequired('williamhill', diagnostics.missingRequirements);
    }
  }
}
