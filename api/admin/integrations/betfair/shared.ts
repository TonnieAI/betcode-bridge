import { createSupabaseAdminClient } from '../../../_lib/supabase.js';
import { getBetfairCredentialDiagnostics, getBetfairMissingCredentialKeys } from '../../../../src/lib/providers/adapters/betfair/auth.js';

export type BetfairIntegrationTestType = 'test_auth' | 'test_events' | 'test_markets';
export type BetfairIntegrationHealthStatus = 'connected' | 'degraded' | 'failed' | 'credentials_missing' | 'awaiting_approval';

interface IntegrationLogInsert {
  provider: 'betfair';
  admin_user_id: string;
  test_type: BetfairIntegrationTestType;
  success: boolean;
  status: BetfairIntegrationHealthStatus;
  error_category: string | null;
  failure_reason: string | null;
  response_time_ms: number | null;
  metadata: Record<string, unknown>;
}

export interface SafeCredentialStatus {
  name: string;
  present: boolean;
}

export interface SafeIntegrationLog {
  provider: 'betfair';
  timestamp: string;
  testType: BetfairIntegrationTestType;
  success: 'success' | 'failure';
  status: BetfairIntegrationHealthStatus;
  responseTimeMs: number | null;
  failureReason: string | null;
  errorCategory: string | null;
}

export function getSafeCredentialStatus(): SafeCredentialStatus[] {
  const diagnostics = getBetfairCredentialDiagnostics();

  return diagnostics.credentials.map((credential) => ({
    name: credential.name,
    present: credential.exists,
  }));
}

export function getMissingRequirements(): string[] {
  return getBetfairMissingCredentialKeys();
}

export async function writeIntegrationLog(entry: IntegrationLogInsert): Promise<SafeIntegrationLog> {
  const admin = createSupabaseAdminClient();
  const timestamp = new Date().toISOString();

  const safeLog: SafeIntegrationLog = {
    provider: 'betfair',
    timestamp,
    testType: entry.test_type,
    success: entry.success ? 'success' : 'failure',
    status: entry.status,
    responseTimeMs: entry.response_time_ms,
    failureReason: entry.failure_reason,
    errorCategory: entry.error_category,
  };

  try {
    const { data } = await admin
      .from('admin_integration_logs')
      .insert({
        provider: entry.provider,
        admin_user_id: entry.admin_user_id,
        test_type: entry.test_type,
        success: entry.success,
        status: entry.status,
        error_category: entry.error_category,
        failure_reason: entry.failure_reason,
        response_time_ms: entry.response_time_ms,
        metadata: entry.metadata,
      })
      .select('provider,created_at,test_type,success,status,response_time_ms,failure_reason,error_category')
      .maybeSingle();

    if (data) {
      return {
        provider: 'betfair',
        timestamp: String(data.created_at ?? timestamp),
        testType: entry.test_type,
        success: data.success ? 'success' : 'failure',
        status: (data.status as BetfairIntegrationHealthStatus) ?? entry.status,
        responseTimeMs: Number.isFinite(data.response_time_ms) ? Number(data.response_time_ms) : entry.response_time_ms,
        failureReason: (data.failure_reason as string | null) ?? entry.failure_reason,
        errorCategory: (data.error_category as string | null) ?? null,
      };
    }
  } catch {
    // Logging must never break admin diagnostics endpoints.
  }

  return safeLog;
}
