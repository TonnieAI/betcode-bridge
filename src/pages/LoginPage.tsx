import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { getCountryOption } from '@/lib/geo';
import { clearPendingCheckout, getPendingCheckout } from '@/lib/pendingCheckout';
import { supabase } from '@/lib/supabase';
import { createCheckoutSession } from '@/services/subscriptionService';
import { ArrowLeftRight, Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldResumeCheckout = searchParams.get('checkout') === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function resumeCheckoutAfterAuth() {
    const pending = getPendingCheckout();
    if (!pending) {
      navigate('/dashboard');
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    let country = 'US';
    let currency = getCountryOption(country).defaultCurrency;

    if (userId) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('country,currency')
        .eq('id', userId)
        .maybeSingle();

      country = profileData?.country || country;
      currency = profileData?.currency || getCountryOption(country).defaultCurrency;
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
    setLoading(true);
    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      setLoading(false);
      setError(signInError);
      return;
    }

    if (shouldResumeCheckout) {
      try {
        await resumeCheckoutAfterAuth();
        return;
      } catch (checkoutError) {
        setLoading(false);
        setError(checkoutError instanceof Error ? checkoutError.message : 'Unable to continue checkout.');
        return;
      }
    }

    setLoading(false);
    navigate('/dashboard');
  }

  return (
    <div className="pt-16 min-h-screen flex items-center justify-center px-4">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#d4af37]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="card p-8 w-full max-w-md relative">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="w-10 h-10 rounded-lg gold-gradient flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-[#0a0e1a]" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold">Bet<span className="gold-text">Code</span> Bridge</span>
        </Link>

        <h1 className="text-2xl font-bold text-center mb-1">Welcome back</h1>
        <p className="text-sm text-gray-400 text-center mb-6">Sign in to your account to continue</p>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="mt-2 text-right">
              <Link to="/forgot-password" className="text-xs text-[#d4af37] hover:underline">Forgot password?</Link>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-sm text-gray-400 text-center mt-6">
          Don't have an account?{' '}
          <Link to={shouldResumeCheckout ? '/register?checkout=1' : '/register'} className="gold-text hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
