import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { BOOKMAKERS } from '@/lib/bookmakers';
import type { BookmakerId, ConversionRecord, FavoritePair } from '@/lib/types';
import {
  ArrowRight, TrendingUp, CheckCircle2, XCircle, Star, Plus,
  Activity, BarChart3, Calendar, Zap, ArrowLeftRight, Trash2,
} from 'lucide-react';
import { BookmakerBadge, ConversionPercentage, EmptyState, LoadingSpinner } from '@/components/ui';

export function DashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [conversions, setConversions] = useState<ConversionRecord[]>([]);
  const [favorites, setFavorites] = useState<FavoritePair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: convData }, { data: favData }] = await Promise.all([
        supabase.from('conversions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('favorites').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);
      setConversions((convData ?? []) as unknown as ConversionRecord[]);
      setFavorites((favData ?? []) as unknown as FavoritePair[]);
      setLoading(false);
    })();
  }, [user]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalConversions = conversions.length;
  const todayConversions = conversions.filter((c) => {
    const d = new Date(c.createdAt);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }).length;
  const successRate = totalConversions > 0
    ? Math.round(conversions.reduce((acc, c) => acc + c.conversionPercentage, 0) / totalConversions)
    : 0;
  const totalMatched = conversions.reduce((acc, c) => acc + c.matchedCount, 0);
  const totalUnavailable = conversions.reduce((acc, c) => acc + c.unavailableCount, 0);

  // Most converted bookmaker pairs
  const pairCounts: Record<string, number> = {};
  conversions.forEach((c) => {
    const key = `${c.sourceBookmaker}→${c.destinationBookmaker}`;
    pairCounts[key] = (pairCounts[key] ?? 0) + 1;
  });
  const topPairs = Object.entries(pairCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Most popular leagues from recent conversions
  const leagueCounts: Record<string, number> = {};
  conversions.forEach((c) => {
    if (c.result?.selections) {
      c.result.selections.forEach((s: { league: string }) => {
        leagueCounts[s.league] = (leagueCounts[s.league] ?? 0) + 1;
      });
    }
  });
  const topLeagues = Object.entries(leagueCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);

  async function removeFavorite(id: string) {
    setFavorites(favorites.filter((f) => f.id !== id));
    await supabase.from('favorites').delete().eq('id', id).eq('user_id', user?.id);
  }

  if (loading) {
    return <div className="pt-16 min-h-screen flex items-center justify-center"><LoadingSpinner label="Loading dashboard..." /></div>;
  }

  const stats = [
    { label: 'Total Conversions', value: totalConversions, icon: Activity, color: 'text-blue-400' },
    { label: "Today's Conversions", value: todayConversions, icon: Calendar, color: 'text-green-400' },
    { label: 'Success Rate', value: `${successRate}%`, icon: TrendingUp, color: 'gold-text' },
    { label: 'Matched Selections', value: totalMatched, icon: CheckCircle2, color: 'text-green-400' },
  ];

  return (
    <div className="pt-16 min-h-screen">
      <div className="section-padding py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-400">Welcome back, {profile?.username ?? 'User'}</p>
          </div>
          <Link to="/convert" className="btn-primary text-sm flex items-center gap-2 self-start">
            <Plus className="w-4 h-4" />
            New Conversion
          </Link>
        </div>

        {/* Plan usage banner */}
        <div className="card p-4 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 gold-text" />
            <div>
              <p className="text-sm font-medium">{profile?.plan.toUpperCase()} Plan</p>
              <p className="text-xs text-gray-400">{profile?.conversionsThisMonth} / {profile?.conversionLimit} conversions this month</p>
            </div>
          </div>
          <div className="flex-1 max-w-[200px] h-2 bg-[#1e293b] rounded-full overflow-hidden">
            <div className="h-full gold-gradient rounded-full transition-all duration-500" style={{ width: `${Math.min((profile?.conversionsThisMonth ?? 0) / (profile?.conversionLimit ?? 1) * 100, 100)}%` }} />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s, i) => (
            <div key={i} className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent conversions */}
          <div className="lg:col-span-2 card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4 gold-text" /> Recent Conversions</h3>
              <Link to="/history" className="text-sm text-[#d4af37] hover:underline">View all</Link>
            </div>

            {conversions.length === 0 ? (
              <EmptyState icon={ArrowLeftRight} title="No conversions yet" message="Start converting bet slips to see your history here." />
            ) : (
              <div className="space-y-3">
                {conversions.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-3 px-4 bg-[#0a0e1a] rounded-lg border border-[#1e293b] hover:border-[#2a3a52] transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: BOOKMAKERS[c.sourceBookmaker as BookmakerId]?.color }} />
                        <span className="text-xs text-gray-400 hidden sm:inline">{BOOKMAKERS[c.sourceBookmaker as BookmakerId]?.shortName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: BOOKMAKERS[c.destinationBookmaker as BookmakerId]?.color }} />
                        <span className="text-xs text-gray-400 hidden sm:inline">{BOOKMAKERS[c.destinationBookmaker as BookmakerId]?.shortName}</span>
                      </div>
                      <span className="font-mono text-xs text-gray-500 truncate">{c.code}</span>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <div className="hidden sm:block w-24"><ConversionPercentage percentage={c.conversionPercentage} /></div>
                      <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Favorites */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><Star className="w-4 h-4 gold-text" /> Favorite Pairs</h3>
            </div>

            {favorites.length === 0 ? (
              <div className="text-center py-8">
                <Star className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No favorites yet.</p>
                <p className="text-xs text-gray-500 mt-1">Save your most-used bookmaker pairs for quick access.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {favorites.map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-2 px-3 bg-[#0a0e1a] rounded-lg border border-[#1e293b]">
                    <div className="flex items-center gap-2">
                      <BookmakerBadge id={f.sourceBookmaker} size="sm" />
                      <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                      <BookmakerBadge id={f.destinationBookmaker} size="sm" />
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => navigate('/convert')} className="p-1.5 rounded hover:bg-[#1e293b] text-gray-400 hover:text-[#d4af37] transition-colors" title="Use">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeFavorite(f.id)} className="p-1.5 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors" title="Remove">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Analytics: Top pairs */}
          <div className="card p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-4"><BarChart3 className="w-4 h-4 gold-text" /> Most Converted Pairs</h3>
            {topPairs.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {topPairs.map(([key, count]) => {
                  const [src, dest] = key.split('→') as BookmakerId[];
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookmakerBadge id={src} size="sm" />
                        <ArrowRight className="w-3 h-3 text-gray-500" />
                        <BookmakerBadge id={dest} size="sm" />
                      </div>
                      <span className="text-sm font-bold text-gray-300">{count}×</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Analytics: Top leagues */}
          <div className="lg:col-span-2 card p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-4"><BarChart3 className="w-4 h-4 gold-text" /> Most Popular Leagues</h3>
            {topLeagues.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {topLeagues.map(([league, count]) => {
                  const maxCount = topLeagues[0][1];
                  return (
                    <div key={league} className="flex items-center gap-3">
                      <span className="text-sm text-gray-300 w-32 truncate">{league}</span>
                      <div className="flex-1 h-2 bg-[#1e293b] rounded-full overflow-hidden">
                        <div className="h-full gold-gradient rounded-full" style={{ width: `${(count / maxCount) * 100}%` }} />
                      </div>
                      <span className="text-sm font-bold text-gray-400 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
