export type BookmakerApiProvider = 'bet365' | 'betfair' | 'skybet' | 'williamhill';

export interface CredentialDiagnostic {
  name: string;
  exists: boolean;
  length: number;
}

export interface CredentialValidationResult {
  provider: BookmakerApiProvider;
  credentials: CredentialDiagnostic[];
  credentialsConfigured: boolean;
  missingRequirements: string[];
}

export class IntegrationRequiredError extends Error {
  provider: BookmakerApiProvider;
  missingRequirements: string[];

  constructor(provider: BookmakerApiProvider, message: string, missingRequirements: string[]) {
    super(message);
    this.name = 'IntegrationRequiredError';
    this.provider = provider;
    this.missingRequirements = missingRequirements;
  }
}

function getBackendEnvRecord(): Record<string, string | undefined> {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env ?? {};
}

function assertBackendOnlyKey(name: string): void {
  if (name.startsWith('VITE_')) {
    throw new Error(`Invalid credential key ${name}. Use backend-only environment variables.`);
  }
}

function getEnvValue(name: string): string | undefined {
  assertBackendOnlyKey(name);
  return getBackendEnvRecord()[name];
}

export function validateProviderCredentials(
  provider: BookmakerApiProvider,
  requiredEnvKeys: string[],
): CredentialValidationResult {
  const credentials = requiredEnvKeys.map((name) => {
    const value = getEnvValue(name);
    const normalized = value?.trim() ?? '';

    return {
      name,
      exists: normalized.length > 0,
      length: normalized.length,
    } satisfies CredentialDiagnostic;
  });

  const missingRequirements = credentials
    .filter((credential) => !credential.exists)
    .map((credential) => `Missing ${credential.name}`);

  return {
    provider,
    credentials,
    credentialsConfigured: missingRequirements.length === 0,
    missingRequirements,
  };
}

export function throwIntegrationRequired(
  provider: BookmakerApiProvider,
  missingRequirements: string[],
): never {
  const reason = missingRequirements.length > 0
    ? missingRequirements.join(', ')
    : 'Endpoint validation pending';

  throw new IntegrationRequiredError(
    provider,
    `${provider} integration required. ${reason}.`,
    missingRequirements.length > 0 ? missingRequirements : ['Endpoint validation pending'],
  );
}
