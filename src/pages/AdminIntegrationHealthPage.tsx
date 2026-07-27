import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/ui';
import { Activity, ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type IntegrationHealthStatus = 'connected' | 'degraded' | 'failed' | 'credentials_missing' | 'awaiting_approval';
type IntegrationProvider = 'betfair' | 'bet365' | 'skybet' | 'williamhill';

interface ProviderIntegrationHealth {
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

interface HealthPayload {
  status: string;
  checkedAt: string;
  health: ProviderIntegrationHealth[];
}

const PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  betfair: 'Betfair',
  bet365: 'Bet365',
  skybet: 'SkyBet',
  williamhill: 'William Hill',
};

const PROVIDER_ORDER: IntegrationProvider[] = ['betfair', 'bet365', 'skybet', 'williamhill'];

function badgeClass(status: IntegrationHealthStatus): string {
  if (status === 'connected') return 'badge-success';
  if (status === 'degraded') return 'badge-warning';
  if (status === 'awaiting_approval') return 'badge-info';
  if (status === 'credentials_missing') return 'badge-danger';
  return 'badge-danger';
}

export function AdminIntegrationHealthPage() {
  const { language } = useI18n();
  const [healthRows, setHealthRows] = useState<ProviderIntegrationHealth[]>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadHealth(isBackgroundRefresh = false) {
    if (isBackgroundRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        throw new Error('Session expired. Please sign in again.');
      }

      const response = await fetch('/api/admin/integrations/health', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await response.json()) as HealthPayload;

      if (!response.ok) {
        throw new Error((payload as { message?: string }).message || 'Failed to load integration health.');
      }

      setHealthRows(payload.health ?? []);
      setCheckedAt(payload.checkedAt ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load integration health.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadHealth();

    const id = setInterval(() => {
      loadHealth(true);
    }, 5 * 60 * 1000);

    return () => clearInterval(id);
  }, []);

  if (loading) {
    return <div className="pt-16 min-h-screen flex items-center justify-center"><LoadingSpinner label="Loading integration health..." /></div>;
  }

  return (
    <div className="pt-16 min-h-screen">
      <div className="section-padding py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Activity className="w-7 h-7 gold-text" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Bookmaker Integration Health</h1>
              <p className="text-sm text-gray-400">Monitors provider connectivity and credential readiness without exposing secrets.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/admin" className="btn-secondary text-sm inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Admin
            </Link>
            <button
              className="btn-primary text-sm inline-flex items-center gap-2"
              onClick={() => loadHealth(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="text-xs text-gray-500">
          Last checked:
          {' '}
          {checkedAt ? new Date(checkedAt).toLocaleString(language, { dateStyle: 'short', timeStyle: 'short' }) : 'Not yet'}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(healthRows.length > 0
            ? healthRows
            : PROVIDER_ORDER.map((provider) => ({
              provider,
              status: 'awaiting_approval' as const,
              lastSuccessfulTest: null,
              lastFailedTest: null,
              failureReason: 'Health data unavailable',
              responseTimeMs: null,
              lastCheckedTimestamp: null,
              apiAvailability: 'unavailable' as const,
              credentialStatus: [],
              recentErrors: [],
            })))
            .map((item) => (
            <div key={item.provider} className="card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-200">{PROVIDER_LABELS[item.provider]}</h2>
                  <p className="text-xs text-gray-500">Provider ID: {item.provider}</p>
                </div>
                <span className={`${badgeClass(item.status)} text-xs`}>{item.status}</span>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Current status</span>
                  <span className="text-gray-200">{item.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">API availability</span>
                  <span className={item.apiAvailability === 'available' ? 'text-green-400' : item.apiAvailability === 'degraded' ? 'text-yellow-400' : 'text-red-400'}>
                    {item.apiAvailability}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Last check</span>
                  <span className="text-gray-200">
                    {item.lastCheckedTimestamp
                      ? new Date(item.lastCheckedTimestamp).toLocaleString(language, { dateStyle: 'short', timeStyle: 'short' })
                      : 'Never'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Last successful test</span>
                  <span className="text-gray-200">
                    {item.lastSuccessfulTest
                      ? new Date(item.lastSuccessfulTest).toLocaleString(language, { dateStyle: 'short', timeStyle: 'short' })
                      : 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Last failed test</span>
                  <span className="text-gray-200">
                    {item.lastFailedTest
                      ? new Date(item.lastFailedTest).toLocaleString(language, { dateStyle: 'short', timeStyle: 'short' })
                      : 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Response time</span>
                  <span className="text-gray-200">{item.responseTimeMs != null ? `${item.responseTimeMs} ms` : 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Failure reason</span>
                  <span className="text-gray-200">{item.failureReason ?? 'None'}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-[#1e293b] bg-[#0a0e1a] mb-4">
                <p className="text-xs text-gray-500 mb-2">Credential status</p>
                {item.credentialStatus.length === 0 ? (
                  <p className="text-xs text-gray-400">API data unavailable.</p>
                ) : (
                  <div className="space-y-1">
                    {item.credentialStatus.map((credential) => (
                      <div key={credential.name} className="flex items-center justify-between text-xs">
                        <span className="text-gray-300 font-mono">{credential.name}</span>
                        <span className={credential.present ? 'text-green-400' : 'text-red-400'}>{credential.present ? 'Present' : 'Missing'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg border border-[#1e293b] bg-[#0a0e1a]">
                <p className="text-xs text-gray-500 mb-2">Recent errors</p>
                {item.recentErrors.length === 0 ? (
                  <p className="text-xs text-gray-400">No recent errors.</p>
                ) : (
                  <div className="space-y-2">
                    {item.recentErrors.map((entry, index) => (
                      <div key={`${entry.timestamp}:${index}`} className="text-xs border border-[#1e293b] rounded-md p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-red-400">{entry.status}</span>
                          <span className="text-gray-500">{new Date(entry.timestamp).toLocaleString(language, { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                        <p className="text-gray-300">{entry.failureReason ?? 'Unknown failure'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
