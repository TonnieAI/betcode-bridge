import { Bet365ApiClient } from '../../../bookmakers/api/clients/bet365Client';
import { throwIntegrationRequired } from '../../../bookmakers/api/bookmakerApiClient';

export class Bet365AdapterClient {
  private readonly apiClient = new Bet365ApiClient();

  getDiagnostics() {
    return this.apiClient.getDiagnostics();
  }

  assertReadyForIntegration(): never {
    const diagnostics = this.getDiagnostics();
    if (!diagnostics.credentialsConfigured) {
      throwIntegrationRequired('bet365', diagnostics.missingRequirements);
    }

    return throwIntegrationRequired('bet365', ['Endpoint validation pending']);
  }
}
