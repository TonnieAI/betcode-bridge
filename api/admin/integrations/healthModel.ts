import type { CredentialValidationResult } from '../../../src/lib/bookmakers/api/bookmakerApiClient.js';

export type IntegrationProvider = 'betfair' | 'bet365' | 'skybet' | 'williamhill';
export type IntegrationHealthStatus = 'connected' | 'degraded' | 'failed' | 'credentials_missing' | 'awaiting_approval';

export interface IntegrationHealthLogRow {
  provider: IntegrationProvider;
  status: IntegrationHealthStatus | null;
  success: boolean;
  failure_reason: string | null;
  response_time_ms: number | null;
  created_at: string;
}

export interface ProviderIntegrationHealth {
  provider: IntegrationProvider;
  status: IntegrationHealthStatus;
  lastSuccessfulTest: string | null;
  lastFailedTest: string | null;
  failureReason: string | null;
  responseTimeMs: number | null;
  lastCheckedTimestamp: string | null;
  apiAvailability: 'available' | 'degraded' | 'unavailable';
  credentialStatus: Array<{ name: string; present: boolean }>;
  recentErrors: Array<{
    timestamp: string;
    failureReason: string | null;
    status: IntegrationHealthStatus;
  }>;
}

function hasCredentials(result: CredentialValidationResult): boolean {
  return result.credentialsConfigured;
}

function mapApiAvailability(status: IntegrationHealthStatus): 'available' | 'degraded' | 'unavailable' {
  if (status === 'connected') return 'available';
  if (status === 'degraded') return 'degraded';
  return 'unavailable';
}

export function determineHealthStatus(
  credentialsConfigured: boolean,
  latestLog: IntegrationHealthLogRow | undefined,
  lastSuccessfulTest: string | null,
): IntegrationHealthStatus {
  if (!credentialsConfigured) {
    return 'credentials_missing';
  }

  if (!latestLog) {
    return 'awaiting_approval';
  }

  const latestStatus = latestLog.status;

  if (latestStatus === 'connected') {
    return 'connected';
  }

  if (latestStatus === 'degraded') {
    return 'degraded';
  }

  if (latestStatus === 'failed') {
    return lastSuccessfulTest ? 'degraded' : 'failed';
  }

  if (latestStatus === 'credentials_missing') {
    return 'credentials_missing';
  }

  if (latestStatus === 'awaiting_approval') {
    return 'awaiting_approval';
  }

  return lastSuccessfulTest ? 'degraded' : 'failed';
}

export function buildProviderHealth(
  provider: IntegrationProvider,
  diagnostics: CredentialValidationResult,
  logs: IntegrationHealthLogRow[],
): ProviderIntegrationHealth {
  const orderedLogs = [...logs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const latestLog = orderedLogs[0];

  const lastSuccess = orderedLogs.find((log) => log.success);
  const lastFailure = orderedLogs.find((log) => !log.success);

  const lastSuccessfulTest = lastSuccess?.created_at ?? null;
  const lastFailedTest = lastFailure?.created_at ?? null;
  const status = determineHealthStatus(hasCredentials(diagnostics), latestLog, lastSuccessfulTest);

  const recentErrors = orderedLogs
    .filter((log) => !log.success)
    .slice(0, 3)
    .map((log) => ({
      timestamp: log.created_at,
      failureReason: log.failure_reason,
      status: (log.status ?? 'failed') as IntegrationHealthStatus,
    }));

  return {
    provider,
    status,
    lastSuccessfulTest,
    lastFailedTest,
    failureReason: lastFailure?.failure_reason ?? null,
    responseTimeMs: latestLog?.response_time_ms ?? null,
    lastCheckedTimestamp: latestLog?.created_at ?? null,
    apiAvailability: mapApiAvailability(status),
    credentialStatus: diagnostics.credentials.map((credential) => ({
      name: credential.name,
      present: credential.exists,
    })),
    recentErrors,
  };
}
