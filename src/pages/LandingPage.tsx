import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BOOKMAKER_LIST } from '@/lib/bookmakers';
import {
  ArrowLeftRight, Zap, Shield, Search, BarChart3, Bell, Star,
  Check, ChevronDown, TrendingUp, Clock, Layers, Lock,
} from 'lucide-react';

const features = [
  { icon: Zap, title: 'Instant Conversion', desc: 'Decode and recreate bet slips across 10 Nigerian bookmakers in seconds.' },
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

const plans = [
  {
    name: 'Free', price: '₦0', period: 'forever',
    limit: '10 conversions / month',
    features: ['10 conversions per month', 'All 10 bookmakers', 'Basic odds comparison', '7-day history'],
    cta: 'Get Started', highlight: false,
  },
  {
    name: 'Basic', price: '₦2,500', period: '/ month',
    limit: '50 conversions / month',
    features: ['50 conversions per month', 'All 10 bookmakers', 'Full odds comparison', 'Unlimited history', 'Export conversions', 'Email notifications'],
    cta: 'Choose Basic', highlight: false,
  },
  {
    name: 'Pro', price: '₦5,000', period: '/ month',
    limit: '500 conversions / month',
    features: ['500 conversions per month', 'Priority decoding', 'Advanced analytics', 'Favorites & alerts', 'API access', 'No advertisements'],
    cta: 'Choose Pro', highlight: true,
  },
  {
    name: 'Enterprise', price: 'Custom', period: '',
    limit: 'Unlimited conversions',
    features: ['Unlimited conversions', 'Dedicated support', 'Custom bookmaker plugins', 'SLA guarantee', 'On-premise option', 'Audit logs'],
    cta: 'Contact Sales', highlight: false,
  },
];

const faqs = [
  { q: 'Does BetCode Bridge place bets for me?', a: 'No. BetCode Bridge only translates bet slips between bookmakers. After conversion, you review the reconstructed slip and manually recreate it on the destination bookmaker. We never place bets on your behalf.' },
  { q: 'How does the conversion work?', a: 'Each bookmaker has a decoder module that reads the bet code and outputs a normalized structure. Our mapping engine then matches fixtures, markets, and selections against the destination bookmaker using alias databases for team names and market types.' },
  { q: 'What happens when a market is unavailable?', a: 'We clearly indicate when a market or selection cannot be matched at the destination bookmaker. We never guess or approximate — unavailable selections are flagged so you can make informed decisions.' },
  { q: 'Can I use official bookmaker APIs?', a: 'Yes. The architecture is built around a provider interface. When official APIs or licensed data feeds become available, each bookmaker\'s decoder is updated to call that API. The frontend and conversion pipeline remain unchanged.' },
  { q: 'Which bookmakers are supported?', a: 'Currently we support Bet9ja, SportyBet, BetKing, 1xBet Nigeria, NairaBet, MerryBet, BangBet, MSport, SureBet247, and Premier Bet Nigeria. Additional bookmakers can be added as plug-in modules.' },
  { q: 'Is my data secure?', a: 'Yes. We use JWT authentication, password hashing, rate limiting, and row-level security. Your conversion history is private to your account.' },
];

export function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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
              10 Nigerian bookmakers supported
            </div>

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              Convert Bet Slips
              <br />
              <span className="gold-text">Across Bookmakers</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 leading-relaxed mb-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              Enter a bet code from one Nigerian sportsbook and instantly recreate
              the equivalent selections on another. No guessing — just precise,
              transparent bet slip conversion.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <Link to="/convert" className="btn-primary flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5" />
                Convert a Bet Slip
              </Link>
              <Link to="/register" className="btn-secondary">Create Free Account</Link>
            </div>

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
          <p className="text-gray-400">10 Nigerian sportsbooks, with more added as plug-in modules.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {BOOKMAKER_LIST.map((bm) => (
            <div key={bm.id} className="card card-hover p-5 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg" style={{ background: `${bm.color}20`, color: bm.color }}>
                {bm.shortName}
              </div>
              <span className="text-sm font-medium text-gray-200 text-center">{bm.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────── */}
      <section className="section-padding py-20 bg-[#0f1623] border-y border-[#1e293b]">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Simple, transparent pricing</h2>
          <p className="text-gray-400">Start free. Upgrade when you need more conversions.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((p) => (
            <div key={p.name} className={`card p-6 relative ${p.highlight ? 'border-[#d4af37]/50 shadow-[0_0_30px_rgba(212,175,55,0.1)]' : ''}`}>
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gold-gradient text-[#0a0e1a] text-xs font-bold">
                  Most Popular
                </div>
              )}
              <h3 className="text-lg font-semibold mb-1">{p.name}</h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold">{p.price}</span>
                <span className="text-sm text-gray-500">{p.period}</span>
              </div>
              <p className="text-sm text-gray-400 mb-4">{p.limit}</p>
              <ul className="space-y-2 mb-6">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/register" className={`w-full text-center ${p.highlight ? 'btn-primary' : 'btn-secondary'} text-sm`}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section className="section-padding py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Frequently asked questions</h2>
          <p className="text-gray-400">Everything you need to know about BetCode Bridge.</p>
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
            <p className="text-gray-400 mb-6 max-w-xl mx-auto">Join BetCode Bridge today and translate bet codes across 10 Nigerian bookmakers.</p>
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
