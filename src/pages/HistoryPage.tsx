import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { BOOKMAKER_LIST, BOOKMAKERS } from '@/lib/bookmakers';
import type { BookmakerId, ConversionRecord } from '@/lib/types';
import {
  Search, Trash2, Download, ArrowRight, Filter, X, Eye, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { BookmakerBadge, ConversionPercentage, EmptyState, LoadingSpinner } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

export function HistoryPage() {
  const { user } = useAuth();
  const { language, t } = useI18n();
  const [records, setRecords] = useState<ConversionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterDest, setFilterDest] = useState<string>('all');
  const [selectedRecord, setSelectedRecord] = useState<ConversionRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('conversions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      setLoadError('Unable to load conversion history right now. Please refresh.');
    }

    setRecords((data ?? []) as unknown as ConversionRecord[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const filtered = records.filter((r) => {
    const matchSearch = !search ||
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      BOOKMAKERS[r.sourceBookmaker as BookmakerId]?.name.toLowerCase().includes(search.toLowerCase()) ||
      BOOKMAKERS[r.destinationBookmaker as BookmakerId]?.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.result?.selections ?? []).some((s: { fixture: string; league: string }) =>
        s.fixture.toLowerCase().includes(search.toLowerCase()) ||
        s.league.toLowerCase().includes(search.toLowerCase())
      );
    const matchSource = filterSource === 'all' || r.sourceBookmaker === filterSource;
    const matchDest = filterDest === 'all' || r.destinationBookmaker === filterDest;
    return matchSearch && matchSource && matchDest;
  });

  async function handleDelete(id: string) {
    const previous = records;
    setRecords(records.filter((r) => r.id !== id));
    const { error } = await supabase.from('conversions').delete().eq('id', id).eq('user_id', user?.id);
    if (error) {
      setRecords(previous);
      setLoadError('Unable to delete this conversion right now. Please try again.');
    }
  }

  function handleExport() {
    const headers = ['Date', 'Code', 'Source', 'Destination', 'Conversion %', 'Matched', 'Unavailable', 'Total', 'Original Odds', 'Destination Odds'];
    const rows = filtered.map((r) => [
      new Date(r.createdAt).toISOString(),
      r.code,
      BOOKMAKERS[r.sourceBookmaker as BookmakerId]?.name ?? r.sourceBookmaker,
      BOOKMAKERS[r.destinationBookmaker as BookmakerId]?.name ?? r.destinationBookmaker,
      `${r.conversionPercentage}%`,
      r.matchedCount,
      r.unavailableCount,
      r.totalSelections,
      r.originalTotalOdds,
      r.destinationTotalOdds,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `betcode-bridge-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setSearch('');
    setFilterSource('all');
    setFilterDest('all');
  }

  const hasFilters = search || filterSource !== 'all' || filterDest !== 'all';

  return (
    <div className="pt-16 min-h-screen">
      <div className="section-padding py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{t('history.title', 'Conversion History')}</h1>
            <p className="text-gray-400">{t('history.subtitle', 'Search, filter, export, and manage your past conversions.')}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} disabled={filtered.length === 0} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50">
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <Link to="/convert" className="btn-primary text-sm">New Conversion</Link>
          </div>
        </div>

        {/* Filters */}
        {loadError && (
          <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            {loadError}
          </div>
        )}

        <div className="card p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code, fixture, league, or bookmaker..."
                className="input-field pl-10"
              />
            </div>
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="input-field md:w-44 cursor-pointer">
              <option value="all">All Sources</option>
              {BOOKMAKER_LIST.map((bm) => <option key={bm.id} value={bm.id}>{bm.name}</option>)}
            </select>
            <select value={filterDest} onChange={(e) => setFilterDest(e.target.value)} className="input-field md:w-44 cursor-pointer">
              <option value="all">All Destinations</option>
              {BOOKMAKER_LIST.map((bm) => <option key={bm.id} value={bm.id}>{bm.name}</option>)}
            </select>
            {hasFilters && (
              <button onClick={clearFilters} className="btn-ghost flex items-center gap-1 text-sm">
                <X className="w-4 h-4" /> Clear
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <LoadingSpinner label="Loading history..." />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Filter} title={hasFilters ? "No matching conversions" : "No conversions yet"} message={hasFilters ? "Try adjusting your filters." : "Start converting bet slips to build your history."} />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-[#1e293b]">
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Source → Destination</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Date</th>
                    <th className="px-4 py-3 font-medium text-center hidden sm:table-cell">Matched</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Conversion</th>
                    <th className="px-4 py-3 font-medium text-right">Odds</th>
                    <th className="px-4 py-3 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-[#1e293b] hover:bg-[#161f2e] transition-colors">
                      <td className="px-4 py-3 font-mono text-gray-300">{r.code}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <BookmakerBadge id={r.sourceBookmaker as BookmakerId} size="sm" />
                          <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                          <BookmakerBadge id={r.destinationBookmaker as BookmakerId} size="sm" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                        {new Date(r.createdAt).toLocaleDateString(language, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className="text-green-400">{r.matchedCount}</span>
                        <span className="text-gray-500 mx-1">/</span>
                        <span className="text-gray-400">{r.totalSelections}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="w-28"><ConversionPercentage percentage={r.conversionPercentage} /></div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className="text-gray-400">{Number(r.originalTotalOdds).toFixed(2)}</span>
                        <ArrowRight className="w-3 h-3 inline mx-1 text-gray-600" />
                        <span className="gold-text">{Number(r.destinationTotalOdds).toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setSelectedRecord(r)} className="p-1.5 rounded hover:bg-[#1e293b] text-gray-400 hover:text-[#d4af37] transition-colors" title="View">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedRecord(null)}>
          <div className="card max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{t('history.details', 'Conversion Details')}</h3>
              <button onClick={() => setSelectedRecord(null)} className="p-1.5 rounded hover:bg-[#1e293b] text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <BookmakerBadge id={selectedRecord.sourceBookmaker as BookmakerId} />
              <ArrowRight className="w-4 h-4 text-gray-500" />
              <BookmakerBadge id={selectedRecord.destinationBookmaker as BookmakerId} />
              <span className="font-mono text-sm text-gray-400 bg-[#1e293b] px-3 py-1 rounded-lg">{selectedRecord.code}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-[#0a0e1a] rounded-lg p-3 border border-[#1e293b] text-center">
                <p className="text-xs text-gray-500">Matched</p>
                <p className="text-lg font-bold text-green-400">{selectedRecord.matchedCount}</p>
              </div>
              <div className="bg-[#0a0e1a] rounded-lg p-3 border border-[#1e293b] text-center">
                <p className="text-xs text-gray-500">Unavailable</p>
                <p className="text-lg font-bold text-red-400">{selectedRecord.unavailableCount}</p>
              </div>
              <div className="bg-[#0a0e1a] rounded-lg p-3 border border-[#1e293b] text-center">
                <p className="text-xs text-gray-500">Rate</p>
                <p className="text-lg font-bold gold-text">{selectedRecord.conversionPercentage}%</p>
              </div>
            </div>
            <div className="space-y-2">
              {selectedRecord.result?.selections?.map((sel: {
                fixture: string; league: string; market: string; selection: string;
                originalOdds: number; destinationOdds: number | null; status: string;
              }, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 bg-[#0a0e1a] rounded-lg border border-[#1e293b]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{sel.fixture}</p>
                    <p className="text-xs text-gray-500">{sel.market} — {sel.selection}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    <span className="font-mono text-sm text-gray-400">{sel.originalOdds.toFixed(2)}</span>
                    <ArrowRight className="w-3 h-3 text-gray-600" />
                    <span className="font-mono text-sm gold-text">{sel.destinationOdds !== null ? sel.destinationOdds.toFixed(2) : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
