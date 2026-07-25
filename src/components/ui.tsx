import { useEffect, useMemo, useState } from 'react';
import type { BookmakerId, SelectionStatus } from '@/lib/types';
import { BOOKMAKERS } from '@/lib/bookmakers';
import {
  getBettingCompanyLogoMap,
  normalizeCompanyNameForLookup,
  normalizeCompanyWebsiteForLookup,
} from '@/services/bettingCompanyService';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, ArrowRightLeft, Clock } from 'lucide-react';

export function BookmakerLogo({ id, size = 'md' }: { id: BookmakerId; size?: 'sm' | 'md' }) {
  const bm = BOOKMAKERS[id];
  const [dbLogoUrl, setDbLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const logoMap = await getBettingCompanyLogoMap();
        if (!mounted) return;

        const normalized = normalizeCompanyNameForLookup(bm.name);
        const host = normalizeCompanyWebsiteForLookup(bm.website);
        const byName = logoMap[normalized] ?? null;
        const byHost = host ? logoMap[`host:${host}`] ?? null : null;
        setDbLogoUrl(byName ?? byHost);
      } catch {
        if (!mounted) return;
        setDbLogoUrl(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [bm.name]);

  const logoCandidates = useMemo(() => {
    if (dbLogoUrl) {
      return [dbLogoUrl];
    }

    const raw = bm.logoUrl ?? '';
    if (!raw) return [] as string[];

    const base = raw.replace(/\.(svg|png|jpe?g|webp)$/i, '');
    return [
      `${base}.svg`,
      `${base}.png`,
      `${base}.jpg`,
      `${base}.jpeg`,
      `${base}.webp`,
    ];
  }, [bm.logoUrl, dbLogoUrl]);
  const [logoIndex, setLogoIndex] = useState(0);
  const wrapperSize = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const imageSize = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';
  const currentLogo = logoCandidates[logoIndex];
  const showLogo = Boolean(currentLogo);

  return (
    <div
      className={`${wrapperSize} rounded-xl flex items-center justify-center border shadow-sm overflow-hidden`}
      style={{
        background: `linear-gradient(135deg, ${bm.color} 0%, ${bm.color}CC 100%)`,
        borderColor: `${bm.color}66`,
      }}
      aria-hidden="true"
    >
      {showLogo ? (
        <img
          src={currentLogo}
          alt={`${bm.name} logo`}
          className={`${imageSize} object-contain`}
          loading="lazy"
          onError={() => {
            setLogoIndex((prev) => (prev + 1 < logoCandidates.length ? prev + 1 : prev));
          }}
        />
      ) : (
        <div className={`flex flex-col items-center justify-center leading-none font-black text-white ${textSize}`}>
          <span>{bm.shortName}</span>
        </div>
      )}
    </div>
  );
}

export function BookmakerBadge({ id, size = 'md' }: { id: BookmakerId; size?: 'sm' | 'md' }) {
  const bm = BOOKMAKERS[id];
  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';
  const isLive = bm.integrationMode === 'live';

  return (
    <span
      className={`inline-flex items-center gap-2 ${sizeClasses} rounded-lg font-medium border`}
      style={{
        background: `${bm.color}15`,
        borderColor: `${bm.color}40`,
        color: bm.color,
      }}
    >
      <BookmakerLogo id={id} size={size} />
      {bm.name}
      <span
        className={`rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
          isLive
            ? 'border-green-400/40 bg-green-500/10 text-green-300'
            : 'border-yellow-400/40 bg-yellow-500/10 text-yellow-300'
        }`}
      >
        {isLive ? 'Live' : 'Sim'}
      </span>
    </span>
  );
}

export function StatusBadge({ status }: { status: SelectionStatus }) {
  const config = {
    matched: { className: 'badge-success', icon: CheckCircle2, label: 'Matched' },
    unavailable: { className: 'badge-danger', icon: XCircle, label: 'Unavailable' },
    odds_changed: { className: 'badge-warning', icon: AlertTriangle, label: 'Odds Changed' },
    market_changed: { className: 'badge-info', icon: ArrowRightLeft, label: 'Market Changed' },
    suspended: { className: 'badge-danger', icon: Clock, label: 'Suspended' },
  };

  const { className, icon: Icon, label } = config[status];

  return (
    <span className={className}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

export function ConversionPercentage({ percentage }: { percentage: number }) {
  const color = percentage >= 80 ? 'text-green-400' : percentage >= 50 ? 'text-yellow-400' : 'text-red-400';
  const bg = percentage >= 80 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-[#1e293b] rounded-full overflow-hidden min-w-[60px]">
        <div className={`h-full ${bg} rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }} />
      </div>
      <span className={`text-sm font-bold ${color}`}>{percentage}%</span>
    </div>
  );
}

export function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <RefreshCw className="w-8 h-8 text-[#d4af37] animate-spin" />
      {label && <p className="text-sm text-gray-400">{label}</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, message }: { icon: typeof CheckCircle2; title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#1e293b] flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-200 mb-1">{title}</h3>
      <p className="text-sm text-gray-400 max-w-sm">{message}</p>
    </div>
  );
}
