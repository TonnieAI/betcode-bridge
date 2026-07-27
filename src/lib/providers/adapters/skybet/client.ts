import { SkyBetApiClient } from '../../../bookmakers/api/clients/skybetClient';
import { throwIntegrationRequired } from '../../../bookmakers/api/bookmakerApiClient';

export class SkyBetAdapterClient {
  private readonly apiClient = new SkyBetApiClient();

  getDiagnostics() {
    return this.apiClient.getDiagnostics();
  }

  assertReadyForIntegration(): never {
    const diagnostics = this.getDiagnostics();
    if (!diagnostics.credentialsConfigured) {
      throwIntegrationRequired('skybet', diagnostics.missingRequirements);
    }

    return throwIntegrationRequired('skybet', ['Endpoint validation pending']);
  }
}
