import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { BOOKMAKER_LIST } from '@/lib/bookmakers';
import { BookmakerLogo, LoadingSpinner } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import {
  Shield, Users, Crown, Activity, BarChart3, BookOpen,
  TrendingUp, AlertCircle, Database, ScrollText, CreditCard,
  Loader2,
} from 'lucide-react';
import type { PaymentRecord, SubscriptionRecord } from '@/lib/types';

interface AdminStats {
  totalUsers: number;
  totalConversions: number;
  successRate: number;
  activeBookmakers: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  failedPayments: number;
  totalRevenue: number;
}

interface AdminProfileRow {
  id: string;
  username: string;
  email: string;
  plan: string;
  role: string;
  created_at: string;
}

interface AdminConversionRow {
  id: string;
  code: string;
  source_bookmaker: string;
  destination_bookmaker: string;
  conversion_percentage: number;
  created_at: string;
}

function formatCurrency(amount: number, currency = 'USD', locale = 'en') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function AdminPage() {
  const { language } = useI18n();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<AdminProfileRow[]>([]);
  const [recentConversions, setRecentConversions] = useState<AdminConversionRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'bookmakers' | 'billing' | 'logs'>('overview');
  const [adminActionLoading, setAdminActionLoading] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  async function loadAdminData() {
    setLoading(true);

    const [
      profilesRes,
      conversionsRes,
      subscriptionsRes,
      paymentsRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('conversions').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('subscriptions').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(300),
    ]);

    const profiles = (profilesRes.data ?? []) as AdminProfileRow[];
    const conversions = (conversionsRes.data ?? []) as AdminConversionRow[];
    const nextSubscriptions = (subscriptionsRes.data ?? []) as SubscriptionRecord[];
    const nextPayments = (paymentsRes.data ?? []) as PaymentRecord[];

    const totalUsers = profiles.length;
    const totalConversions = conversions.length;
    const successRate = totalConversions > 0
      ? Math.round(conversions.reduce((acc, c) => acc + c.conversion_percentage, 0) / totalConversions)
      : 0;

    const activeSubscriptions = nextSubscriptions.filter((subscription) => subscription.subscription_status === 'active').length;
    const expiredSubscriptions = nextSubscriptions.filter((subscription) => subscription.subscription_status === 'expired').length;
    const failedPayments = nextPayments.filter((payment) => payment.status === 'failed').length;
    const totalRevenue = nextPayments
      .filter((payment) => payment.status === 'success')
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    setStats({
      totalUsers,
      totalConversions,
      successRate,
      activeBookmakers: BOOKMAKER_LIST.length,
      activeSubscriptions,
      expiredSubscriptions,
      failedPayments,
      totalRevenue,
    });

    setRecentUsers(profiles);
    setRecentConversions(conversions);
    setSubscriptions(nextSubscriptions);
    setPayments(nextPayments);
    setLoading(false);
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  const usersById = useMemo(() => {
    return recentUsers.reduce<Record<string, AdminProfileRow>>((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {});
  }, [recentUsers]);

  async function runAdminSubscriptionAction(subscriptionId: string, action: 'activate' | 'cancel') {
    setAdminActionLoading(`${action}:${subscriptionId}`);
    setBillingError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        throw new Error('Session expired. Please sign in again.');
      }

      const response = await fetch('/api/admin/subscriptions/action', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscriptionId, action }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.details ? `${payload.error}: ${payload.details}` : payload?.error || 'Action failed');
      }

      await loadAdminData();
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : 'Failed to update subscription.');
    } finally {
      setAdminActionLoading(null);
    }
  }

  if (loading) {
    return <div className="pt-16 min-h-screen flex items-center justify-center"><LoadingSpinner label="Loading admin panel..." /></div>;
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'users' as const, label: 'Users', icon: Users },
    { id: 'bookmakers' as const, label: 'Bookmakers', icon: BookOpen },
    { id: 'billing' as const, label: 'Billing', icon: CreditCard },
    { id: 'logs' as const, label: 'System Logs', icon: ScrollText },
  ];

  return (
    <div className="pt-16 min-h-screen">
      <div className="section-padding py-8">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-7 h-7 gold-text" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Admin Panel</h1>
            <p className="text-gray-400">Manage users, bookmakers, subscriptions, and payment transactions</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card p-5">
            <Users className="w-5 h-5 text-blue-400 mb-2" />
            <p className="text-2xl font-bold">{stats?.totalUsers ?? 0}</p>
            <p className="text-xs text-gray-500">Total Users</p>
          </div>
          <div className="card p-5">
            <Activity className="w-5 h-5 text-green-400 mb-2" />
            <p className="text-2xl font-bold">{stats?.totalConversions ?? 0}</p>
            <p className="text-xs text-gray-500">Total Conversions</p>
          </div>
          <div className="card p-5">
            <Crown className="w-5 h-5 gold-text mb-2" />
            <p className="text-2xl font-bold">{stats?.activeSubscriptions ?? 0}</p>
            <p className="text-xs text-gray-500">Active Subscriptions</p>
          </div>
          <div className="card p-5">
            <TrendingUp className="w-5 h-5 text-emerald-400 mb-2" />
            <p className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue ?? 0, 'USD', language)}</p>
            <p className="text-xs text-gray-500">Revenue (successful payments)</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card p-5">
            <BarChart3 className="w-5 h-5 gold-text mb-2" />
            <p className="text-2xl font-bold">{stats?.successRate ?? 0}%</p>
            <p className="text-xs text-gray-500">Avg Success Rate</p>
          </div>
          <div className="card p-5">
            <BookOpen className="w-5 h-5 text-purple-400 mb-2" />
            <p className="text-2xl font-bold">{stats?.activeBookmakers ?? 0}</p>
            <p className="text-xs text-gray-500">Active Bookmakers</p>
          </div>
          <div className="card p-5">
            <AlertCircle className="w-5 h-5 text-yellow-400 mb-2" />
            <p className="text-2xl font-bold">{stats?.expiredSubscriptions ?? 0}</p>
            <p className="text-xs text-gray-500">Expired Subscriptions</p>
          </div>
          <div className="card p-5">
            <CreditCard className="w-5 h-5 text-red-400 mb-2" />
            <p className="text-2xl font-bold">{stats?.failedPayments ?? 0}</p>
            <p className="text-xs text-gray-500">Failed Payments</p>
          </div>
        </div>

        <div className="flex gap-1 mb-6 border-b border-[#1e293b] overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'border-[#d4af37] text-[#d4af37]' : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="font-semibold mb-4">Recent Users</h3>
              <div className="space-y-2">
                {recentUsers.slice(0, 5).map((user) => (
                  <div key={user.id} className="flex items-center justify-between py-2 px-3 bg-[#0a0e1a] rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-200">{user.username}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <span className="badge-gold text-xs">{user.plan}</span>
                  </div>
                ))}
                {recentUsers.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No users yet.</p>}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-semibold mb-4">Latest Payments</h3>
              <div className="space-y-2">
                {payments.slice(0, 5).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between py-2 px-3 bg-[#0a0e1a] rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-200">{formatCurrency(Number(payment.amount), payment.currency)}</p>
                      <p className="text-xs text-gray-500 font-mono">{payment.gateway_reference}</p>
                    </div>
                    <span className={
                      payment.status === 'success'
                        ? 'badge-success text-xs'
                        : payment.status === 'pending'
                          ? 'badge-warning text-xs'
                          : payment.status === 'failed'
                            ? 'badge-danger text-xs'
                            : 'badge-info text-xs'
                    }>
                      {payment.status}
                    </span>
                  </div>
                ))}
                {payments.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No payments yet.</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-[#1e293b]">
                    <th className="px-4 py-3 font-medium">Username</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((user) => (
                    <tr key={user.id} className="border-b border-[#1e293b] hover:bg-[#161f2e]">
                      <td className="px-4 py-3 font-medium text-gray-200">{user.username}</td>
                      <td className="px-4 py-3 text-gray-400">{user.email}</td>
                      <td className="px-4 py-3"><span className="badge-gold text-xs">{user.plan}</span></td>
                      <td className="px-4 py-3 text-gray-400">{user.role || 'user'}</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(user.created_at).toLocaleDateString(language, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'bookmakers' && (
          <div className="space-y-4">
            <div className="card p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-200">Manage betting companies</p>
                <p className="text-xs text-gray-500">Add, edit, and delete companies including logo uploads from one place.</p>
              </div>
              <Link to="/admin/betting-companies" className="btn-primary text-sm self-start md:self-auto">
                Open Management Module
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {BOOKMAKER_LIST.map((bookmaker) => (
                <div key={bookmaker.id} className="card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <BookmakerLogo id={bookmaker.id} />
                    <div>
                      <p className="font-medium text-gray-200">{bookmaker.name}</p>
                      <p className="text-xs text-gray-500">ID: {bookmaker.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="badge-success text-xs">Active</span>
                    <span className="text-xs text-gray-500">Plug-in Module</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="space-y-6">
            {billingError && (
              <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
                {billingError}
              </div>
            )}

            <div className="card p-5">
              <h3 className="font-semibold mb-4">Subscriptions</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-[#1e293b]">
                      <th className="py-2 pr-3">User</th>
                      <th className="py-2 pr-3">Plan</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Expiry</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.slice(0, 50).map((subscription) => {
                      const actionKeyActivate = `activate:${subscription.id}`;
                      const actionKeyCancel = `cancel:${subscription.id}`;
                      const user = usersById[subscription.user_id];

                      return (
                        <tr key={subscription.id} className="border-b border-[#1e293b]">
                          <td className="py-3 pr-3">
                            <p className="text-gray-200">{user?.username || 'Unknown user'}</p>
                            <p className="text-xs text-gray-500">{user?.email || subscription.user_id}</p>
                          </td>
                          <td className="py-3 pr-3 text-gray-300">{subscription.plan_id}</td>
                          <td className="py-3 pr-3 text-gray-300">{formatCurrency(Number(subscription.amount), subscription.currency, language)}</td>
                          <td className="py-3 pr-3">
                            <span className={
                              subscription.subscription_status === 'active'
                                ? 'badge-success'
                                : subscription.subscription_status === 'pending'
                                  ? 'badge-warning'
                                  : subscription.subscription_status === 'failed'
                                    ? 'badge-danger'
                                    : 'badge-info'
                            }>
                              {subscription.subscription_status}
                            </span>
                          </td>
                          <td className="py-3 pr-3 text-gray-400">
                            {subscription.expiry_date
                              ? new Date(subscription.expiry_date).toLocaleDateString(language, { month: 'short', day: 'numeric', year: 'numeric' })
                              : 'N/A'}
                          </td>
                          <td className="py-3 flex items-center gap-2">
                            <button
                              onClick={() => runAdminSubscriptionAction(subscription.id, 'activate')}
                              disabled={adminActionLoading === actionKeyActivate || subscription.subscription_status === 'active'}
                              className="btn-secondary text-xs px-3 py-2 disabled:opacity-50"
                            >
                              {adminActionLoading === actionKeyActivate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Activate'}
                            </button>
                            <button
                              onClick={() => runAdminSubscriptionAction(subscription.id, 'cancel')}
                              disabled={adminActionLoading === actionKeyCancel || subscription.subscription_status === 'cancelled'}
                              className="btn-secondary text-xs px-3 py-2 disabled:opacity-50"
                            >
                              {adminActionLoading === actionKeyCancel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Cancel'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-semibold mb-4">Payment Transactions</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-[#1e293b]">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Reference</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Provider</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2">Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.slice(0, 80).map((payment) => (
                      <tr key={payment.id} className="border-b border-[#1e293b]">
                        <td className="py-3 pr-3 text-gray-400">{new Date(payment.created_at).toLocaleDateString(language, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td className="py-3 pr-3 font-mono text-xs text-gray-300">{payment.gateway_reference}</td>
                        <td className="py-3 pr-3 text-gray-300">{formatCurrency(Number(payment.amount), payment.currency, language)}</td>
                        <td className="py-3 pr-3 text-gray-400">{payment.payment_provider}</td>
                        <td className="py-3 pr-3">
                          <span className={
                            payment.status === 'success'
                              ? 'badge-success'
                              : payment.status === 'pending'
                                ? 'badge-warning'
                                : payment.status === 'failed'
                                  ? 'badge-danger'
                                  : 'badge-info'
                          }>
                            {payment.status}
                          </span>
                        </td>
                        <td className="py-3 text-gray-400">{payment.payment_method || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-4 h-4 gold-text" />
              <h3 className="font-semibold">System Logs</h3>
            </div>
            <div className="space-y-2">
              {recentConversions.slice(0, 10).map((conversion) => (
                <div key={conversion.id} className="flex items-center justify-between py-2 px-3 bg-[#0a0e1a] rounded-lg text-sm">
                  <span className="font-mono text-gray-300">conversion_saved</span>
                  <span className="text-gray-400">{conversion.code} — {conversion.source_bookmaker} → {conversion.destination_bookmaker}</span>
                  <span className="text-gray-500">{new Date(conversion.created_at).toLocaleString(language, { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
              ))}
              {recentConversions.length === 0 && (
                <div className="flex flex-col items-center py-8 text-gray-400">
                  <AlertCircle className="w-8 h-8 mb-2" />
                  <p className="text-sm">No system logs recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
