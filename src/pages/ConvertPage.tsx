import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BOOKMAKERS, BOOKMAKER_LIST, getIntegrationModeLabel, isBookmakerLive } from '@/lib/bookmakers';
import { convertBetCode } from '@/lib/conversionEngine';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { BookmakerId, ConversionResult } from '@/lib/types';
import { getDecoder } from '@/lib/providers/registry'; 
import {
  ArrowRight, AlertCircle, CheckCircle2, XCircle, TrendingUp, TrendingDown,
  Copy, Save, Star, RefreshCw, Info, Ticket,
} from 'lucide-react';
import { BookmakerBadge, StatusBadge, ConversionPercentage, LoadingSpinner } from '@/components/ui';
import { isCodeExpired } from '@/lib/conversionEngine';

export function ConvertPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [source, setSource] = useState<BookmakerId>('bet9ja');
  const [destination, setDestination] = useState<BookmakerId>('sportybet');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liveOnly, setLiveOnly] = useState(false);

  const filteredBookmakers = useMemo(
    () => (liveOnly ? BOOKMAKER_LIST.filter((bm) => bm.integrationMode === 'live') : BOOKMAKER_LIST),
    [liveOnly],
  );

  const hasAvailableBookmakers = filteredBookmakers.length > 0;

  useEffect(() => {
    if (!hasAvailableBookmakers) return;

    const ids = new Set(filteredBookmakers.map((bm) => bm.id));
    const fallbackSource = filteredBookmakers[0].id;
    const fallbackDestination = filteredBookmakers.find((bm) => bm.id !== fallbackSource)?.id ?? fallbackSource;

    if (!ids.has(source)) {
      setSource(fallbackSource);
    }

    if (!ids.has(destination)) {
      setDestination(fallbackDestination);
    }
  }, [source, destination, filteredBookmakers, hasAvailableBookmakers]);

  async function handleConvert() {
  console.log('handleConvert called'); // Add this line
  setError(null);
  setResult(null);
  setSaved(false);
  if (!code.trim()) {
    console.log('No code entered'); // Add this line
    setError('Please enter a bet code.');
    return;
  }
  if (source === destination) {
    console.log('Source and destination are the same'); // Add this line
    setError('Source and destination bookmaker must be different.');
    return;
  }
  const decoder = getDecoder(source);
  console.log('Decoder:', decoder); // Add this line
  if (!decoder) {
    console.log('No decoder found for source'); // Add this line
    setError(`No decoder registered for bookmaker: ${source}.`);
    return;
  }
  if (isCodeExpired(code.trim(), decoder)) {
    console.log('Code is expired'); // Add this line
    setError('Bet code has expired. Codes are valid for 24 hours.');
    return;
  }
  setLoading(true);
  try {
    console.log('About to convert code'); // Add this line
    const res = await convertBetCode(source, destination, code.trim());
    console.log('Conversion result:', res); // Add this line
    setResult(res);
  } catch (e) {
    console.error('Conversion error:', e); // Add this line
    setError(e instanceof Error ? e.message : 'Conversion failed. Please try again.');
  } finally {
    console.log('Conversion completed'); // Add this line
    setLoading(false);
  }
}

  async function handleSave() {
    if (!user || !result) return;

    const { error: saveError } = await supabase.rpc('save_conversion_with_quota', {
      p_source_bookmaker: result.sourceBookmaker,
      p_destination_bookmaker: result.destinationBookmaker,
      p_code: result.sourceCode,
      p_conversion_percentage: result.conversionPercentage,
      p_matched_count: result.matchedCount,
      p_unavailable_count: result.unavailableCount,
      p_total_selections: result.selections.length,
      p_original_total_odds: result.originalTotalOdds,
      p_destination_total_odds: result.destinationTotalOdds,
      p_result: result,
    });

    if (saveError) {
      const code = saveError.message?.toUpperCase() ?? '';

      if (code.includes('QUOTA_EXCEEDED')) {
        setError(`You've reached your monthly conversion limit (${profile?.conversionLimit ?? 0}). Upgrade your plan to continue.`);
        await refreshProfile();
        return;
      }

      if (code.includes('AUTH_REQUIRED')) {
        setError('Your session has expired. Please sign in again.');
        navigate('/login');
        return;
      }

      if (code.includes('PROFILE_NOT_FOUND')) {
        setError('Profile not found. Please sign out and sign in again.');
        return;
      }

      setError('Failed to save conversion: ' + saveError.message);
      return;
    }

    await refreshProfile();
    setSaved(true);
  }

  async function handleCopyCode() {
    if (!result?.destinationCode) return;
    await navigator.clipboard.writeText(result.destinationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSwap() {
    setSource(destination);
    setDestination(source);
  }

  const reachedLimit = profile ? profile.conversionsThisMonth >= profile.conversionLimit : false;
  const sourceIsLive = isBookmakerLive(source);
  const destinationIsLive = isBookmakerLive(destination);
  const selectedPairIsLive = sourceIsLive && destinationIsLive;

  return (
    <div className="pt-16 min-h-screen">
      <div className="section-padding py-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Convert Bet Slip</h1>
        <p className="text-gray-400 mb-8">Enter a bet code and select source and destination bookmakers.</p>

        {/* ── Conversion form ─────────────────────────────────────── */}
        <div className="card p-6 md:p-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <p className="text-xs text-gray-400">Selected bookmakers</p>
              <p className="text-sm text-gray-500">Logos are shown here so you can confirm the pair before converting.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BookmakerBadge id={source} size="sm" />
              <ArrowRight className="w-4 h-4 text-gray-500" />
              <BookmakerBadge id={destination} size="sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end mb-6">
            <div className="md:col-span-3 flex items-center justify-between gap-3 mb-1">
              <p className="text-xs text-gray-400">Bookmaker visibility</p>
              <div className="inline-flex rounded-lg border border-[#2a3a52] bg-[#0a0e1a] p-1">
                <button
                  type="button"
                  onClick={() => setLiveOnly(false)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    !liveOnly ? 'bg-[#d4af37]/20 text-[#f0d77a]' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setLiveOnly(true)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    liveOnly ? 'bg-green-500/20 text-green-300' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Live only
                </button>
              </div>
            </div>

            {/* Source */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Source Bookmaker</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as BookmakerId)}
                className="input-field cursor-pointer"
                disabled={!hasAvailableBookmakers}
              >
                {filteredBookmakers.map((bm) => (
                  <option key={bm.id} value={bm.id}>{bm.name} ({getIntegrationModeLabel(bm.id)})</option>
                ))}
              </select>
              <p className="text-xs mt-1 text-gray-500">
                Status: <span className={sourceIsLive ? 'text-green-400' : 'text-yellow-400'}>{sourceIsLive ? 'Live API' : 'Simulated'}</span>
              </p>
            </div>

            {/* Swap */}
            <div className="flex items-end justify-center pb-3">
              <button onClick={handleSwap} disabled={!hasAvailableBookmakers} className="p-3 rounded-lg bg-[#1e293b] border border-[#2a3a52] hover:border-[#d4af37]/40 hover:text-[#d4af37] transition-all active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed" title="Swap">
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Destination */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Destination Bookmaker</label>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value as BookmakerId)}
                className="input-field cursor-pointer"
                disabled={!hasAvailableBookmakers}
              >
                {filteredBookmakers.map((bm) => (
                  <option key={bm.id} value={bm.id}>{bm.name} ({getIntegrationModeLabel(bm.id)})</option>
                ))}
              </select>
              <p className="text-xs mt-1 text-gray-500">
                Status: <span className={destinationIsLive ? 'text-green-400' : 'text-yellow-400'}>{destinationIsLive ? 'Live API' : 'Simulated'}</span>
              </p>
            </div>
          </div>

          {!hasAvailableBookmakers && (
            <div className="mb-6 flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <div>
                No bookmakers match this filter yet.
                {' '}
                <span className="text-gray-300">Switch to All, or mark at least one bookmaker as Live API in configuration.</span>
              </div>
            </div>
          )}

          {!selectedPairIsLive && hasAvailableBookmakers && (
            <div className="mb-6 flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm text-yellow-300">
              <Info className="w-4 h-4 mt-0.5" />
              <div>
                This pair is currently running in simulation mode.
                {' '}
                <span className="text-gray-300">
                  {BOOKMAKERS[source].name} and {BOOKMAKERS[destination].name} are shown with status so users can distinguish live vs simulated translations.
                </span>
              </div>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Bet Code</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
                placeholder="e.g. B9X7YQ4ZP2"
                className="input-field font-mono uppercase tracking-wider"
              />
              <button
                onClick={handleConvert}
                disabled={loading || reachedLimit || !hasAvailableBookmakers}
                className="btn-primary whitespace-nowrap flex items-center gap-2"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                {loading ? 'Converting...' : 'Convert'}
              </button>
            </div>
          </div>

          {reachedLimit && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm text-yellow-400">
              <AlertCircle className="w-4 h-4" />
              You've reached your monthly conversion limit ({profile?.conversionLimit}). Upgrade your plan to continue.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {!user && (
            <p className="text-sm text-gray-500 mt-4 flex items-center gap-1.5">
              <Info className="w-4 h-4" />
              <button onClick={() => navigate('/login')} className="text-[#d4af37] hover:underline">Sign in</button> to save your conversions to history.
            </p>
          )}
        </div>

        {/* ── Loading ──────────────────────────────────────────────── */}
        {loading && <LoadingSpinner label="Decoding bet slip and matching selections..." />}

        {/* ── Results ──────────────────────────────────────────────── */}
        {result && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Summary header */}
            <div className="card p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                  <BookmakerBadge id={result.sourceBookmaker} />
                  <ArrowRight className="w-5 h-5 text-gray-500" />
                  <BookmakerBadge id={result.destinationBookmaker} />
                  <span className="font-mono text-sm text-gray-400 bg-[#1e293b] px-3 py-1 rounded-lg">{result.sourceCode}</span>
                </div>
                <div className="flex items-center gap-3">
                  {user && (
                    <button
                      onClick={handleSave}
                      disabled={saved}
                      className="btn-secondary text-sm flex items-center gap-2"
                    >
                      {saved ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Save className="w-4 h-4" />}
                      {saved ? 'Saved' : 'Save'}
                    </button>
                  )}
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-[#0a0e1a] rounded-lg p-4 border border-[#1e293b]">
                  <p className="text-xs text-gray-500 mb-1">Conversion Rate</p>
                  <ConversionPercentage percentage={result.conversionPercentage} />
                </div>
                <div className="bg-[#0a0e1a] rounded-lg p-4 border border-[#1e293b]">
                  <p className="text-xs text-gray-500 mb-1">Matched</p>
                  <p className="text-xl font-bold text-green-400">
  {result.matchedCount ?? 0}
</p>
                </div>
                <div className="bg-[#0a0e1a] rounded-lg p-4 border border-[#1e293b]">
                  <p className="text-xs text-gray-500 mb-1">Unavailable</p>
                  <p className="text-xl font-bold text-red-400">
  {result.unavailableCount ?? 0}
</p>
                </div>
                <div className="bg-[#0a0e1a] rounded-lg p-4 border border-[#1e293b]">
                  <p className="text-xs text-gray-500 mb-1">Original Odds</p>
                  <p className="text-xl font-bold text-gray-200">{(result.originalTotalOdds ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-[#0a0e1a] rounded-lg p-4 border border-[#1e293b]">
                  <p className="text-xs text-gray-500 mb-1">Destination Odds</p>
                  <p className="text-xl font-bold gold-text">{(result.destinationTotalOdds ?? 0).toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Destination bet code */}
            {result.destinationCode && (
              <div className="card p-6 border-[#d4af37]/30">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2 mb-1">
                      <Ticket className="w-5 h-5 gold-text" />
                      Destination Bet Code
                    </h3>
                    <p className="text-sm text-gray-400">
                      Use this code on {BOOKMAKER_LIST.find(b => b.id === result.destinationBookmaker)?.name} to load the converted bet slip.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <code className="font-mono text-2xl font-bold gold-text bg-[#0a0e1a] px-6 py-3 rounded-lg border border-[#d4af37]/20 tracking-wider">
                      {result.destinationCode}
                    </code>
                    <button onClick={handleCopyCode} className="btn-primary text-sm flex items-center gap-2 whitespace-nowrap">
                      {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-4 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  This code is generated from the matched selections. Visit {BOOKMAKER_LIST.find(b => b.id === result.destinationBookmaker)?.name} and enter this code in their bet slip import field. BetCode Bridge does not place bets automatically.
                </p>
              </div>
            )}

            {/* Selections table */}
            <div className="card overflow-hidden">
              <div className="p-5 border-b border-[#1e293b]">
                <h3 className="font-semibold">
  Selections ({result.selections?.length ?? 0})
</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-[#1e293b]">
                      <th className="px-4 py-3 font-medium">Fixture</th>
                      <th className="px-4 py-3 font-medium hidden md:table-cell">League</th>
                      <th className="px-4 py-3 font-medium hidden lg:table-cell">Kickoff</th>
                      <th className="px-4 py-3 font-medium">Market</th>
                      <th className="px-4 py-3 font-medium">Selection</th>
                      <th className="px-4 py-3 font-medium text-right">Orig. Odds</th>
                      <th className="px-4 py-3 font-medium text-right">Dest. Odds</th>
                      <th className="px-4 py-3 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.selections ?? []).map((sel, i) => (
                      <tr key={i} className="border-b border-[#1e293b] hover:bg-[#161f2e] transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-200">{sel.fixture}</div>
                          <div className="text-xs text-gray-500 md:hidden">{sel.league}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{sel.league}</td>
                        <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                          {new Date(sel.kickoff).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                          {' '}
                          {new Date(sel.kickoff).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-gray-300">{sel.market}</td>
                        <td className="px-4 py-3 text-gray-300">{sel.selection}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">{(sel.originalOdds ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {sel.destinationOdds !== null ? (
                            <span className={`
                              ${sel.oddsDifference !== null && sel.oddsDifference > 0 ? 'text-green-400' : ''}
                              ${sel.oddsDifference !== null && sel.oddsDifference < 0 ? 'text-red-400' : ''}
                              ${sel.oddsDifference !== null && Math.abs(sel.oddsDifference) < 0.001 ? 'text-gray-300' : ''}
                            `}>
                              {(sel.destinationOdds ?? 0).toFixed(2)}
                              {sel.oddsChangePercent !== null && Math.abs(sel.oddsChangePercent) > 1 && (
                                <span className="text-xs ml-1">
                                  ({sel.oddsChangePercent > 0 ? '+' : ''}{sel.oddsChangePercent.toFixed(1)}%)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-red-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={sel.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reconstructed slip */}
            <div className="card p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Copy className="w-5 h-5 gold-text" />
                Reconstructed Bet Slip for {BOOKMAKER_LIST.find(b => b.id === result.destinationBookmaker)?.name}
              </h3>
              <div className="space-y-2">
                {(result.selections ?? [])
  .filter((s) => s.availability === 'available')
  .map((sel, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 bg-[#0a0e1a] rounded-lg border border-[#1e293b]">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">{sel.fixture}</p>
                        <p className="text-xs text-gray-500">{sel.market} — {sel.selection}</p>
                      </div>
                      <span className="font-mono text-sm gold-text ml-3">
  {sel.destinationOdds !== null && sel.destinationOdds !== undefined
    ? sel.destinationOdds.toFixed(2)
    : '—'}
</span>
                    </div>
                  ))}
                {(result.selections ?? []).filter((s) => s.availability !== 'available').length > 0 && (
                  <div className="text-xs text-gray-500 pt-2 border-t border-[#1e293b]">
                    {result.unavailableCount} selection(s) unavailable at destination — not included in reconstructed slip.
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#1e293b]">
                <span className="text-sm text-gray-400">Total Accumulator Odds</span>
                <span className="text-xl font-bold gold-text">
  {(result.destinationTotalOdds ?? 0).toFixed(2)}
</span>
              </div>
              <p className="text-xs text-gray-500 mt-3 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                This is a reconstructed slip for review only. BetCode Bridge does not place bets. Manually recreate these selections on the destination bookmaker.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
