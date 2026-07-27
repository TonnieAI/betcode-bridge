import { WilliamHillApiClient } from '../../../bookmakers/api/clients/williamhillClient';
import { throwIntegrationRequired } from '../../../bookmakers/api/bookmakerApiClient';

export class WilliamHillAdapterClient {
  private readonly apiClient = new WilliamHillApiClient();

  getDiagnostics() {
    return this.apiClient.getDiagnostics();
  }

  assertReadyForIntegration(): never {
    const diagnostics = this.getDiagnostics();
    if (!diagnostics.credentialsConfigured) {
      throwIntegrationRequired('williamhill', diagnostics.missingRequirements);
    }

    return throwIntegrationRequired('williamhill', ['Endpoint validation pending']);
  }
}
