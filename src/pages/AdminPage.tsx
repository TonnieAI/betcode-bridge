import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { BOOKMAKER_LIST } from '@/lib/bookmakers';
import {
  Shield, Users, Crown, Activity, BarChart3, BookOpen,
  TrendingUp, AlertCircle, Database, Key, ScrollText,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui';

interface AdminStats {
  totalUsers: number;
  totalConversions: number;
  successRate: number;
  activeBookmakers: number;
}

export function AdminPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<{ id: string; username: string; email: string; plan: string; role: string; created_at: string }[]>([]);
  const [recentConversions, setRecentConversions] = useState<{ id: string; code: string; source_bookmaker: string; destination_bookmaker: string; conversion_percentage: number; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'bookmakers' | 'logs'>('overview');

  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: conversions }] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('conversions').select('*').order('created_at', { ascending: false }).limit(20),
      ]);

      const totalUsers = profiles?.length ?? 0;
      const totalConversions = conversions?.length ?? 0;
      const successRate = totalConversions > 0
        ? Math.round((conversions ?? []).reduce((acc: number, c: { conversion_percentage: number }) => acc + c.conversion_percentage, 0) / totalConversions)
        : 0;

      setStats({
        totalUsers,
        totalConversions,
        successRate,
        activeBookmakers: BOOKMAKER_LIST.length,
      });
      setRecentUsers((profiles ?? []) as never);
      setRecentConversions((conversions ?? []) as never);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="pt-16 min-h-screen flex items-center justify-center"><LoadingSpinner label="Loading admin panel..." /></div>;
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'users' as const, label: 'Users', icon: Users },
    { id: 'bookmakers' as const, label: 'Bookmakers', icon: BookOpen },
    { id: 'logs' as const, label: 'System Logs', icon: ScrollText },
  ];

  return (
    <div className="pt-16 min-h-screen">
      <div className="section-padding py-8">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-7 h-7 gold-text" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Admin Panel</h1>
            <p className="text-gray-400">Manage users, bookmakers, and system analytics</p>
          </div>
        </div>

        {/* Stats */}
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
            <TrendingUp className="w-5 h-5 gold-text mb-2" />
            <p className="text-2xl font-bold">{stats?.successRate ?? 0}%</p>
            <p className="text-xs text-gray-500">Avg Success Rate</p>
          </div>
          <div className="card p-5">
            <BookOpen className="w-5 h-5 text-purple-400 mb-2" />
            <p className="text-2xl font-bold">{stats?.activeBookmakers ?? 0}</p>
            <p className="text-xs text-gray-500">Active Bookmakers</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[#1e293b]">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id ? 'border-[#d4af37] text-[#d4af37]' : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="font-semibold mb-4">Recent Users</h3>
              <div className="space-y-2">
                {recentUsers.slice(0, 5).map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-2 px-3 bg-[#0a0e1a] rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-200">{u.username}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                    <span className="badge-gold text-xs">{u.plan}</span>
                  </div>
                ))}
                {recentUsers.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No users yet.</p>}
              </div>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold mb-4">Recent Conversions</h3>
              <div className="space-y-2">
                {recentConversions.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 px-3 bg-[#0a0e1a] rounded-lg">
                    <span className="font-mono text-sm text-gray-300">{c.code}</span>
                    <span className="text-sm text-gray-400">{c.source_bookmaker} → {c.destination_bookmaker}</span>
                    <span className="text-sm font-bold gold-text">{c.conversion_percentage}%</span>
                  </div>
                ))}
                {recentConversions.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No conversions yet.</p>}
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
                  {recentUsers.map((u) => (
                    <tr key={u.id} className="border-b border-[#1e293b] hover:bg-[#161f2e]">
                      <td className="px-4 py-3 font-medium text-gray-200">{u.username}</td>
                      <td className="px-4 py-3 text-gray-400">{u.email}</td>
                      <td className="px-4 py-3"><span className="badge-gold text-xs">{u.plan}</span></td>
                      <td className="px-4 py-3 text-gray-400">{u.role ?? 'user'}</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(u.created_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'bookmakers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {BOOKMAKER_LIST.map((bm) => (
              <div key={bm.id} className="card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold" style={{ background: `${bm.color}20`, color: bm.color }}>
                    {bm.shortName}
                  </div>
                  <div>
                    <p className="font-medium text-gray-200">{bm.name}</p>
                    <p className="text-xs text-gray-500">ID: {bm.id}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="badge-success text-xs">Active</span>
                  <span className="text-xs text-gray-500">Plug-in Module</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-4 h-4 gold-text" />
              <h3 className="font-semibold">System Logs</h3>
            </div>
            <div className="space-y-2">
              {recentConversions.slice(0, 10).map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 px-3 bg-[#0a0e1a] rounded-lg text-sm">
                  <span className="font-mono text-gray-300">conversion_saved</span>
                  <span className="text-gray-400">{c.code} — {c.source_bookmaker} → {c.destination_bookmaker}</span>
                  <span className="text-gray-500">{new Date(c.created_at).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' })}</span>
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
