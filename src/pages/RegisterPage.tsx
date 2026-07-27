import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { clearPendingCheckout, getPendingCheckout } from '@/lib/pendingCheckout';
import { COUNTRY_OPTIONS, SUPPORTED_LANGUAGES, getCountryOption, type SupportedCurrency } from '@/lib/geo';
import { useI18n } from '@/lib/i18n';
import { createCheckoutSession } from '@/services/subscriptionService';
import { ArrowLeftRight, Mail, Lock, User, AlertCircle, Eye, EyeOff, Check } from 'lucide-react';

export function RegisterPage() {
  const { signUp } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldResumeCheckout = searchParams.get('checkout') === '1';
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [country, setCountry] = useState('US');
  const [language, setLanguage] = useState<'en' | 'pt' | 'fr'>('en');
  const [currency, setCurrency] = useState<SupportedCurrency>('USD');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedCountry = getCountryOption(country);

  function handleCountryChange(nextCountry: string) {
    setCountry(nextCountry);
    const option = getCountryOption(nextCountry);
    setCurrency(option.defaultCurrency as SupportedCurrency);
  }

  async function resumeCheckoutAfterAuth() {
    const pending = getPendingCheckout();
    if (!pending) {
      navigate('/dashboard');
      return;
    }

    const paymentProvider = getCountryOption(country).preferredPaymentProvider;
    const session = await createCheckoutSession(pending.planId, pending.billingCycle, {
      country,
      currency,
      paymentProvider,
    });

    clearPendingCheckout();
    window.location.href = session.authorizationUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, username, {
      country,
      currency,
      language,
    });
    setLoading(false);

    if (error) {
      setError(error);
    } else {
      if (shouldResumeCheckout) {
        try {
          await resumeCheckoutAfterAuth();
          return;
        } catch (checkoutError) {
          setError(checkoutError instanceof Error ? checkoutError.message : 'Unable to continue checkout.');
          return;
        }
      }

      navigate('/dashboard');
    }
  }

  return (
    <div className="pt-16 min-h-screen flex items-center justify-center px-4 py-8">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#d4af37]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="card p-8 w-full max-w-md relative">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="w-10 h-10 rounded-lg gold-gradient flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-[#0a0e1a]" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold">Bet<span className="gold-text">Code</span> Bridge</span>
        </Link>

        <h1 className="text-2xl font-bold text-center mb-1">{t('register.title', 'Create your account')}</h1>
        <p className="text-sm text-gray-400 text-center mb-6">{t('register.subtitle', 'Start converting bet slips worldwide')}</p>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="your_username"
                className="input-field pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="input-field pl-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('register.country', 'Country')}</label>
              <select
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="input-field"
              >
                {COUNTRY_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>{option.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('register.language', 'Language')}</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'en' | 'pt' | 'fr')}
                className="input-field"
              >
                {SUPPORTED_LANGUAGES.map((entry) => (
                  <option key={entry.code} value={entry.code}>{entry.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('register.currency', 'Currency')}</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
                className="input-field"
              >
                {selectedCountry.supportedCurrencies.map((supportedCurrency) => (
                  <option key={supportedCurrency} value={supportedCurrency}>{supportedCurrency}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="input-field pl-10 pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="input-field pl-10"
              />
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-gray-400">
            <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span>By signing up, you agree to our Terms of Service and acknowledge that BetCode Bridge does not place bets on your behalf.</span>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-sm text-gray-400 text-center mt-6">
          Already have an account?{' '}
          <Link to={shouldResumeCheckout ? '/login?checkout=1' : '/login'} className="gold-text hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
