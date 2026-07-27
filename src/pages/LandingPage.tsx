import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { getCountryOption } from '@/lib/geo';
import { useI18n } from '@/lib/i18n';
import { savePendingCheckout } from '@/lib/pendingCheckout';
import type { BillingCycle } from '@/lib/types';
import { applyBillingCycle, convertFromNgn, PRICE_DISPLAY_CURRENCIES } from '@/lib/pricing';
import { buildFallbackCatalog, getGlobalBookmakers, type GlobalBookmaker } from '@/services/bookmakerCatalogService';
import { createCheckoutSession } from '@/services/subscriptionService';
import {
  ArrowLeftRight, Zap, Shield, Search, BarChart3, Bell, Star,
  Check, ChevronDown, TrendingUp, Clock, Layers, Lock, Loader2,
} from 'lucide-react';

const features = [
  { icon: Zap, title: 'Instant Conversion', desc: 'Decode and recreate bet slips across supported global bookmakers in seconds.' },
  { icon: Shield, title: 'Provider Abstraction', desc: 'Each bookmaker is a plug-in module. Official APIs connect without frontend changes.' },
  { icon: Search, title: 'Smart Matching', desc: 'Alias databases normalize team names and markets across all bookmakers.' },
  { icon: BarChart3, title: 'Odds Comparison', desc: 'See original vs destination odds with percentage changes highlighted.' },
  { icon: Bell, title: 'Real-time Alerts', desc: 'Get notified when markets are unavailable, odds change, or subscriptions expire.' },
  { icon: Star, title: 'Favorites', desc: 'Save your most-used bookmaker pairs for one-click conversion.' },
];

const steps = [
  { num: '01', title: 'Enter Your Bet Code', desc: 'Paste the bet code from your source bookmaker and select your destination.' },
  { num: '02', title: 'Smart Decoding', desc: 'Our provider engine decodes the slip and normalizes all fixtures and markets.' },
  { num: '03', title: 'Match & Compare', desc: 'We match selections, compare odds, and flag any unavailable or changed markets.' },
  { num: '04', title: 'Reconstructed Slip', desc: 'Review your converted slip with full transparency, then recreate it manually.' },
];

const pricingPreview = [
  { id: 'free', name: 'Free', baseNgn: 0, limit: '10 conversions / month' },
  { id: 'basic', name: 'Basic', baseNgn: 2500, limit: '50 conversions / month' },
  { id: 'pro', name: 'Premium', baseNgn: 5000, limit: '500 conversions / month' },
];

function formatCurrency(amount: number, currency = 'USD', locale = 'en') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const faqs = [
  { q: 'Does BetCode Bridge place bets for me?', a: 'No. BetCode Bridge only translates bet slips between bookmakers. After conversion, you review the reconstructed slip and manually recreate it on the destination bookmaker. We never place bets on your behalf.' },
  { q: 'How does the conversion work?', a: 'Each bookmaker has a decoder module that reads the bet code and outputs a normalized structure. Our mapping engine then matches fixtures, markets, and selections against the destination bookmaker using alias databases for team names and market types.' },
  { q: 'What happens when a market is unavailable?', a: 'We clearly indicate when a market or selection cannot be matched at the destination bookmaker. We never guess or approximate — unavailable selections are flagged so you can make informed decisions.' },
  { q: 'Can I use official bookmaker APIs?', a: 'Yes. The architecture is built around a provider interface. When official APIs or licensed data feeds become available, each bookmaker\'s decoder is updated to call that API. The frontend and conversion pipeline remain unchanged.' },
  { q: 'Which bookmakers are supported?', a: 'We support a growing catalog of bookmakers across regions including the United Kingdom, United States, South Africa, Ghana, Kenya, and Mozambique. Additional bookmakers are added through plug-in provider modules and catalog updates.' },
  { q: 'Is my data secure?', a: 'Yes. We use JWT authentication, password hashing, rate limiting, and row-level security. Your conversion history is private to your account.' },
];

export function LandingPage() {
  const { user, profile } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [bookmakers, setBookmakers] = useState<GlobalBookmaker[]>([]);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [displayCurrency, setDisplayCurrency] = useState<(typeof PRICE_DISPLAY_CURRENCIES)[number]>('USD');
  const [checkoutLoadingPlanId, setCheckoutLoadingPlanId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const { t, language } = useI18n();
  const navigate = useNavigate();

  async function handleSubscribe(planId: string) {
    setCheckoutError(null);

    if (planId === 'free') {
      navigate('/register');
      return;
    }

    if (!user) {
      savePendingCheckout({ planId, billingCycle });
      navigate('/register?checkout=1');
      return;
    }

    const country = profile?.country || 'US';
    const currency = profile?.currency || getCountryOption(country).defaultCurrency;
    const paymentProvider = getCountryOption(country).preferredPaymentProvider;

    setCheckoutLoadingPlanId(planId);

    try {
      const session = await createCheckoutSession(planId, billingCycle, {
        country,
        currency,
        paymentProvider,
      });

      window.location.href = session.authorizationUrl;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Failed to initialize checkout.');
      setCheckoutLoadingPlanId(null);
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = await getGlobalBookmakers(true);
        if (!mounted) return;
        setBookmakers(data.length > 0 ? data : buildFallbackCatalog());
      } catch {
        if (!mounted) return;
        setBookmakers(buildFallbackCatalog());
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="pt-16">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f1623] via-[#0a0e1a] to-[#0a0e1a]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#d4af37]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-green-500/5 rounded-full blur-[100px]" />

        <div className="relative section-padding py-20 md:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1e293b] border border-[#2a3a52] text-sm text-gray-300 mb-6 animate-fade-in-up">
              <Zap className="w-3.5 h-3.5 gold-text" />
              {t('landing.heroBadge', 'Supported bookmakers worldwide')}
            </div>

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              {t('landing.heroTitle1', 'Convert Bet Slips')}
              <br />
              <span className="gold-text">{t('landing.heroTitle2', 'Across Bookmakers')}</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 leading-relaxed mb-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              {t('landing.heroDesc', 'Enter a bet code from one supported sportsbook and recreate equivalent selections on another with transparent mapping.')}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <Link to="/convert" className="btn-primary flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5" />
                {t('landing.ctaPrimary', 'Convert a Bet Slip')}
              </Link>
              <Link to="/register" className="btn-secondary">{t('landing.ctaSecondary', 'Create Free Account')}</Link>
            </div>

            <p className="mt-4 text-sm text-gray-500 animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
              Choose a plan and continue directly to secure checkout.
            </p>

            <div className="flex items-center justify-center gap-6 mt-10 text-sm text-gray-500 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-400" /> No betting</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-400" /> Transparent</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-400" /> Secure</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section className="section-padding py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Built for serious bettors</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">Everything you need to translate bet slips between bookmakers with precision.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="card card-hover p-6">
              <div className="w-12 h-12 rounded-xl bg-[#1e293b] flex items-center justify-center mb-4">
                <f.icon className="w-6 h-6 gold-text" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────── */}
      <section className="section-padding py-20 bg-[#0f1623] border-y border-[#1e293b]">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">How it works</h2>
          <p className="text-gray-400">Four simple steps from code to converted slip.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="relative">
              <div className="card p-6 h-full">
                <div className="text-3xl font-bold gold-text opacity-50 mb-3">{s.num}</div>
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-px bg-[#2a3a52]" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Supported bookmakers ─────────────────────────────────── */}
      <section className="section-padding py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Supported bookmakers</h2>
          <p className="text-gray-400">{t('landing.supportedDesc', 'Global bookmaker coverage with expandable provider modules.')}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {bookmakers.slice(0, 20).map((bm) => (
            <a key={bm.id} className="card card-hover p-5 flex flex-col items-center gap-3" href={bm.website} target="_blank" rel="noreferrer">
              <div className="w-10 h-10 rounded-xl border border-[#2a3a52] bg-[#0f1623] flex items-center justify-center text-[10px] text-gray-300">
                {bm.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-200 text-center leading-tight">{bm.name}</span>
              <span className="text-xs text-gray-500">{bm.country}</span>
            </a>
          ))}
          {bookmakers.length === 0 && (
            <div className="col-span-full text-center text-sm text-gray-500">Bookmaker catalog will appear after synchronization.</div>
          )}
        </div>
      </section>

      {/* ── Pricing preview (pre-login) ──────────────────────────── */}
      <section className="section-padding py-20 bg-[#0f1623] border-y border-[#1e293b]">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Plans for every growth stage</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">Browse pricing and subscribe in one click.</p>
        </div>

        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="text-xs text-gray-500">Billing cycle</span>
          <div className="inline-flex rounded-lg border border-[#2a3a52] bg-[#0a0e1a] p-1">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                billingCycle === 'monthly' ? 'bg-[#d4af37]/20 text-[#f0d77a]' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                billingCycle === 'yearly' ? 'bg-[#d4af37]/20 text-[#f0d77a]' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Yearly
            </button>
          </div>

          <div className="inline-flex rounded-lg border border-[#2a3a52] bg-[#0a0e1a] p-1">
            {PRICE_DISPLAY_CURRENCIES.map((currency) => (
              <button
                key={currency}
                type="button"
                onClick={() => setDisplayCurrency(currency)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  displayCurrency === currency ? 'bg-[#d4af37]/20 text-[#f0d77a]' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {currency}
              </button>
            ))}
          </div>
        </div>

        {checkoutError && (
          <div className="max-w-2xl mx-auto mb-6 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm text-center">
            {checkoutError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {pricingPreview.map((plan) => (
            <div key={plan.name} className="card p-6 text-center">
              <p className="text-sm text-gray-400">{plan.name}</p>
              <p className="text-3xl font-bold mt-2 gold-text">
                {formatCurrency(
                  applyBillingCycle(convertFromNgn(plan.baseNgn, displayCurrency), billingCycle),
                  displayCurrency,
                  language,
                )}
              </p>
              <p className="text-xs text-gray-500 mt-1">per {billingCycle === 'monthly' ? 'month' : 'year'}</p>
              <p className="text-sm text-gray-300 mt-4">{plan.limit}</p>
              <p className="text-[11px] text-gray-500 mt-1">
                {`≈ ${formatCurrency(applyBillingCycle(plan.baseNgn, billingCycle), 'NGN', language)} base price`}
              </p>
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={checkoutLoadingPlanId === plan.id}
                  className="btn-primary text-sm px-4 py-2 w-full max-w-[180px] flex items-center justify-center gap-2"
                >
                  {checkoutLoadingPlanId === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Subscribe
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section className="section-padding py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Frequently asked questions</h2>
          <p className="text-gray-400">{t('landing.faqTitle', 'Frequently asked questions')}</p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="card overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-[#161f2e] transition-colors"
              >
                <span className="font-medium text-gray-100">{faq.q}</span>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-5 text-sm text-gray-400 leading-relaxed animate-fade-in-up">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="section-padding pb-20">
        <div className="card p-8 md:p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#d4af37]/5 via-transparent to-green-500/5" />
          <div className="relative">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to convert your first bet slip?</h2>
            <p className="text-gray-400 mb-6 max-w-xl mx-auto">{t('landing.finalCtaDesc', 'Join BetCode Bridge and convert betting codes between supported bookmakers worldwide.')}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register" className="btn-primary">Get Started Free</Link>
              <Link to="/convert" className="btn-secondary">Try Convert</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
