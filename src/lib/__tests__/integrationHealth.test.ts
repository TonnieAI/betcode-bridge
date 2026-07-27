import assert from 'node:assert/strict';
import test from 'node:test';
import healthHandler from '../../../api/admin/integrations/betfair';
import { buildProviderHealth, determineHealthStatus, type IntegrationHealthLogRow } from '../../../api/admin/integrations/healthModel';
import { getBetfairAuthDiagnostics } from '../bookmakers/api/auth/betfairAuth';
import { convertBetCode } from '../conversionEngine';

type MockResponse = {
  statusCode: number;
  payload: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => void;
};

function createMockResponse(): MockResponse {
  return {
    statusCode: 200,
    payload: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
    },
  };
}

test('admin-only access is enforced for integration health endpoint', async () => {
  const req = {
    method: 'GET',
    headers: {},
    url: '/api/admin/integrations/betfair?action=health',
  };
  const res = createMockResponse();

  await healthHandler(req as never, res as never);

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, {
    status: 'failed',
    message: 'Admin authorization required',
  });
});

test('status calculation follows integration health progression rules', () => {
  assert.equal(determineHealthStatus(false, undefined, null), 'credentials_missing');
  assert.equal(determineHealthStatus(true, undefined, null), 'awaiting_approval');

  assert.equal(
    determineHealthStatus(
      true,
      {
        provider: 'betfair',
        status: 'connected',
        success: true,
        failure_reason: null,
        response_time_ms: 120,
        created_at: '2026-07-27T09:00:00.000Z',
      },
      '2026-07-27T09:00:00.000Z',
    ),
    'connected',
  );

  assert.equal(
    determineHealthStatus(
      true,
      {
        provider: 'betfair',
        status: 'failed',
        success: false,
        failure_reason: 'authentication_failed',
        response_time_ms: 350,
        created_at: '2026-07-27T10:00:00.000Z',
      },
      '2026-07-27T08:00:00.000Z',
    ),
    'degraded',
  );

  assert.equal(
    determineHealthStatus(
      true,
      {
        provider: 'betfair',
        status: 'failed',
        success: false,
        failure_reason: 'authentication_failed',
        response_time_ms: 350,
        created_at: '2026-07-27T10:00:00.000Z',
      },
      null,
    ),
    'failed',
  );
});

test('health payload does not expose secrets', () => {
  process.env.BETFAIR_APP_KEY = 'super-secret-app-key';
  process.env.BETFAIR_USERNAME = 'admin-secret-user';
  process.env.BETFAIR_PASSWORD = 'super-secret-password';

  const diagnostics = getBetfairAuthDiagnostics();
  const logs: IntegrationHealthLogRow[] = [
    {
      provider: 'betfair',
      status: 'connected',
      success: true,
      failure_reason: null,
      response_time_ms: 140,
      created_at: '2026-07-27T11:00:00.000Z',
    },
  ];

  const health = buildProviderHealth('betfair', diagnostics, logs);
  const serialized = JSON.stringify(health);

  assert.equal(serialized.includes('super-secret-app-key'), false);
  assert.equal(serialized.includes('admin-secret-user'), false);
  assert.equal(serialized.includes('super-secret-password'), false);

  delete process.env.BETFAIR_APP_KEY;
  delete process.env.BETFAIR_USERNAME;
  delete process.env.BETFAIR_PASSWORD;
});

test('existing bookmakers conversion flow remains unaffected', async () => {
  const result = await convertBetCode('bet9ja', 'sportybet', 'ABCDEF12');
  assert.equal(result.sourceBookmaker, 'bet9ja');
  assert.equal(result.destinationBookmaker, 'sportybet');
  assert.ok(result.selections.length > 0);
});
