import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  User as UserIcon, Mail, Crown, Activity, Settings, Save,
  CheckCircle2, Zap, Calendar, Loader2, CreditCard, XCircle,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui';
import type {
  BillingCycle,
  PaymentRecord,
  SubscriptionPlan,
  SubscriptionPlanDefinition,
  SubscriptionRecord,
  SubscriptionStatus,
} from '@/lib/types';
import {
  cancelCurrentSubscription,
  createCheckoutSession,
  getSubscriptionOverview,
  verifyPaymentReference,
} from '@/services/subscriptionService';
import { useI18n } from '@/lib/i18n';
import { COUNTRY_OPTIONS, SUPPORTED_LANGUAGES, getCountryOption } from '@/lib/geo';
import { applyBillingCycle } from '@/lib/pricing';

const PLAN_FALLBACK_INFO: Record<SubscriptionPlan, { name: string; limit: number; price: number }> = {
  free: { name: 'Free', limit: 10, price: 0 },
  basic: { name: 'Basic', limit: 50, price: 2500 },
  pro: { name: 'Premium', limit: 500, price: 5000 },
  enterprise: { name: 'Enterprise', limit: 10000, price: 15000 },
};

const STATUS_BADGE_CLASS: Record<SubscriptionStatus, string> = {
  active: 'badge-success',
  pending: 'badge-warning',
  failed: 'badge-danger',
  cancelled: 'badge-info',
  expired: 'badge-info',
};

function formatCurrency(amount: number, currency = 'USD', locale = 'en') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlanDefinition[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingActionLoading, setBillingActionLoading] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingSuccess, setBillingSuccess] = useState<string | null>(null);
  const [processedReference, setProcessedReference] = useState<string | null>(null);

  useEffect(() => {
    setUsername(profile?.username ?? '');
    setAvatarUrl(profile?.avatarUrl ?? '');
  }, [profile?.username, profile?.avatarUrl]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      setBillingLoading(true);
      setBillingError(null);

      try {
        const overview = await getSubscriptionOverview();

        if (cancelled) return;

        setPlans(overview.plans);
        setSubscription(overview.subscription);
        setPayments(overview.payments);
      } catch (error) {
        if (cancelled) return;
        setBillingError(error instanceof Error ? error.message : 'Failed to load billing data.');
      } finally {
        if (!cancelled) {
          setBillingLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const reference = searchParams.get('reference') || searchParams.get('trxref');

    if (!reference) return;
    if (processedReference === reference) return;

    let cancelled = false;

    (async () => {
      setBillingActionLoading('verify');
      setBillingError(null);
      setBillingSuccess(null);

      try {
        const verification = await verifyPaymentReference(reference);
        if (cancelled) return;

        setProcessedReference(reference);

        if (verification.success) {
          setBillingSuccess('Payment verified successfully. Your subscription is now active.');
        } else {
          setBillingError('Payment was not successful. Please try again or choose another payment method.');
        }

        await refreshProfile();

        const overview = await getSubscriptionOverview();
        if (!cancelled) {
          setPlans(overview.plans);
          setSubscription(overview.subscription);
          setPayments(overview.payments);
        }
      } catch (error) {
        if (!cancelled) {
          setBillingError(error instanceof Error ? error.message : 'Failed to verify payment.');
        }
      } finally {
        if (!cancelled) {
          setBillingActionLoading(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, searchParams, refreshProfile, processedReference]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    const { error } = await supabase
      .from('profiles')
      .update({ username, avatar_url: avatarUrl })
      .eq('id', user.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      await refreshProfile();
      setTimeout(() => setSaved(false), 3000);
    }
  }

  async function handleCheckout(planId: string) {
    setBillingActionLoading(planId);
    setBillingError(null);
    setBillingSuccess(null);

    try {
      const country = profile?.country || 'US';
      const currency = profile?.currency || getCountryOption(country).defaultCurrency;
      const paymentProvider = getCountryOption(country).preferredPaymentProvider;
      const session = await createCheckoutSession(planId, billingCycle, {
        country,
        currency,
        paymentProvider,
      });
      window.location.href = session.authorizationUrl;
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : 'Failed to initialize checkout.');
      setBillingActionLoading(null);
    }
  }

  async function handleCancelSubscription() {
    if (!subscription) return;

    setBillingActionLoading('cancel');
    setBillingError(null);
    setBillingSuccess(null);

    try {
      await cancelCurrentSubscription(subscription.id);
      await refreshProfile();

      const overview = await getSubscriptionOverview();
      setPlans(overview.plans);
      setSubscription(overview.subscription);
      setPayments(overview.payments);

      setBillingSuccess('Subscription cancelled successfully. Your plan has been reverted.');
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : 'Failed to cancel subscription.');
    } finally {
      setBillingActionLoading(null);
    }
  }

  if (!profile) {
    return <div className="pt-16 min-h-screen flex items-center justify-center"><LoadingSpinner label="Loading profile..." /></div>;
  }

  const activePlan = (() => {
    const fromPlans = plans.find((plan) => plan.id === profile.plan);
    if (fromPlans) return fromPlans;

    const fallback = PLAN_FALLBACK_INFO[profile.plan];
    return {
      id: profile.plan,
      name: fallback.name,
      price: fallback.price,
      currency: profile.currency || 'USD',
      duration: 'monthly' as BillingCycle,
      usage_limit: fallback.limit,
      features: [],
      is_active: true,
      created_at: profile.createdAt,
      updated_at: profile.createdAt,
    } as SubscriptionPlanDefinition;
  })();

  const subscriptionStatus = subscription?.subscription_status || 'active';
  const usageRemaining = Math.max(profile.conversionLimit - profile.conversionsThisMonth, 0);
  const renewalDate = subscription?.expiry_date ? new Date(subscription.expiry_date) : null;

  return (
    <div className="pt-16 min-h-screen">
      <div className="section-padding py-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-8">{t('nav.profile', 'Profile')}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile card */}
          <div className="card p-6">
            <div className="flex flex-col items-center text-center">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="w-24 h-24 rounded-full object-cover border-2 border-[#d4af37]/30" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#1e293b] flex items-center justify-center text-3xl font-bold gold-text border-2 border-[#d4af37]/30">
                  {profile.username[0]?.toUpperCase() ?? 'U'}
                </div>
              )}
              <h2 className="text-lg font-semibold mt-4">{profile.username}</h2>
              <p className="text-sm text-gray-400">{profile.email}</p>
              <div className="mt-3">
                <span className="badge-gold">
                  <Crown className="w-3.5 h-3.5" />
                  {activePlan.name} Plan
                </span>
              </div>
              {profile.role === 'admin' && (
                <span className="badge-info mt-2">
                  <Settings className="w-3.5 h-3.5" />
                  Administrator
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="lg:col-span-2 space-y-6">
            {/* Usage stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="card p-5">
                <Zap className="w-5 h-5 gold-text mb-2" />
                <p className="text-2xl font-bold">{profile.conversionsThisMonth}</p>
                <p className="text-xs text-gray-500">Conversions this month</p>
              </div>
              <div className="card p-5">
                <Activity className="w-5 h-5 text-blue-400 mb-2" />
                <p className="text-2xl font-bold">{profile.conversionLimit}</p>
                <p className="text-xs text-gray-500">Monthly limit</p>
              </div>
              <div className="card p-5">
                <Calendar className="w-5 h-5 text-green-400 mb-2" />
                <p className="text-2xl font-bold">{new Date(profile.createdAt).toLocaleDateString(language, { month: 'short', year: 'numeric' })}</p>
                <p className="text-xs text-gray-500">Member since</p>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4 gold-text" /> Subscription Status</h3>
                  <p className="text-xs text-gray-500 mt-1">Current plan, renewal date, and usage availability.</p>
                </div>
                <span className={STATUS_BADGE_CLASS[subscriptionStatus]}>{subscriptionStatus.toUpperCase()}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="bg-[#0a0e1a] border border-[#1e293b] rounded-lg p-4">
                  <p className="text-xs text-gray-500">Current Plan</p>
                  <p className="text-base font-semibold mt-1">{activePlan.name}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatCurrency(Number(activePlan.localized_price ?? activePlan.price), profile.currency || activePlan.currency, language)}/{activePlan.duration}
                  </p>
                </div>
                <div className="bg-[#0a0e1a] border border-[#1e293b] rounded-lg p-4">
                  <p className="text-xs text-gray-500">Renewal Date</p>
                  <p className="text-base font-semibold mt-1">{renewalDate ? renewalDate.toLocaleDateString(language, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}</p>
                  <p className="text-xs text-gray-400 mt-1">{subscription?.billing_cycle ? `Cycle: ${subscription.billing_cycle}` : 'Free tier'}</p>
                </div>
                <div className="bg-[#0a0e1a] border border-[#1e293b] rounded-lg p-4">
                  <p className="text-xs text-gray-500">Usage Remaining</p>
                  <p className="text-base font-semibold mt-1">{usageRemaining} conversions</p>
                  <p className="text-xs text-gray-400 mt-1">{profile.conversionsThisMonth} used of {profile.conversionLimit}</p>
                </div>
              </div>

              {subscription?.subscription_status === 'active' && (
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={handleCancelSubscription}
                    disabled={billingActionLoading === 'cancel'}
                    className="btn-secondary text-sm flex items-center gap-2"
                  >
                    {billingActionLoading === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Cancel Subscription
                  </button>
                  <button
                    onClick={() => document.getElementById('payment-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="btn-secondary text-sm"
                  >
                    View Payment History
                  </button>
                </div>
              )}
            </div>

            {/* Edit form */}
            <div className="card p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><UserIcon className="w-4 h-4 gold-text" /> Edit Profile</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Avatar URL</label>
                  <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="email" value={profile.email} disabled className="input-field pl-10 opacity-60 cursor-not-allowed" />
                  </div>
                </div>
                <div className="pt-2 border-t border-[#1e293b]">
                  <h4 className="text-sm font-semibold text-gray-200 mb-2">{t('profile.regionTitle', 'Regional Preferences')}</h4>
                  <p className="text-xs text-gray-500 mb-3">{t('profile.regionSubtitle', 'Location, currency, and language settings for localized pricing and payments.')}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">{t('profile.chooseRegion', 'Choose your region')}</label>
                      <select value={profile.country} className="input-field opacity-70 cursor-not-allowed" disabled>
                        {COUNTRY_OPTIONS.map((option) => (
                          <option key={option.code} value={option.code}>{option.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">{t('profile.chooseCurrency', 'Choose your preferred currency')}</label>
                      <input value={profile.currency} className="input-field opacity-70 cursor-not-allowed" disabled />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">{t('profile.chooseLanguage', 'Choose your preferred language')}</label>
                      <select
                        value={language}
                        onChange={(event) => {
                          void setLanguage(event.target.value as 'en' | 'pt' | 'fr');
                        }}
                        className="input-field"
                      >
                        {SUPPORTED_LANGUAGES.map((entry) => (
                          <option key={entry.code} value={entry.code}>{entry.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
                  {saving ? 'Saving...' : saved ? <><CheckCircle2 className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> Save Changes</>}
                </button>
              </div>
            </div>

            {/* Subscription */}
            <div className="card p-6">
              <div className="mb-4">
                <h3 className="font-semibold flex items-center gap-2"><Crown className="w-4 h-4 gold-text" /> Subscription & Plans</h3>
                <p className="text-xs text-gray-500 mt-1">Upgrade, change, or manage billing directly from your account profile.</p>
              </div>

              <div className="flex items-center gap-3 mb-4">
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
              </div>

              {billingError && (
                <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
                  {billingError}
                </div>
              )}

              {billingSuccess && (
                <div className="mb-4 p-3 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 text-sm">
                  {billingSuccess}
                </div>
              )}

              {billingLoading ? (
                <LoadingSpinner label="Loading subscription plans..." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  {plans.map((plan) => {
                    const isCurrent = profile.plan === plan.id && subscription?.subscription_status === 'active';
                    const isFree = plan.id === 'free';

                    return (
                      <div key={plan.id} className={`p-4 rounded-lg border ${isCurrent ? 'border-[#d4af37]/50 bg-[#d4af37]/5' : 'border-[#1e293b]'}`}>
                        <p className="text-sm font-semibold">{plan.name}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatCurrency(
                            applyBillingCycle(Number(plan.localized_price ?? plan.price), billingCycle),
                            profile.currency || plan.currency,
                            language,
                          )} / {billingCycle}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{plan.usage_limit} conv/mo</p>

                        {plan.features.length > 0 && (
                          <ul className="mt-3 space-y-1">
                            {plan.features.slice(0, 2).map((feature) => (
                              <li key={feature} className="text-[11px] text-gray-400">• {feature}</li>
                            ))}
                          </ul>
                        )}

                        <div className="mt-4">
                          {isCurrent ? (
                            <span className="badge-gold text-xs">Current</span>
                          ) : isFree ? (
                            <span className="badge-info text-xs">Included</span>
                          ) : (
                            <button
                              onClick={() => handleCheckout(plan.id)}
                              disabled={!!billingActionLoading}
                              className="btn-primary text-xs px-3 py-2 w-full flex items-center justify-center gap-2"
                            >
                              {billingActionLoading === plan.id || billingActionLoading === 'verify'
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : null}
                              {profile.plan === 'free' || plan.id === 'enterprise' ? 'Upgrade Plan' : 'Change Plan'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div id="payment-history" className="card p-6">
              <div className="mb-4">
                <h3 className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4 gold-text" /> Payment History</h3>
                <p className="text-xs text-gray-500 mt-1">Track all payment attempts and successful subscription charges.</p>
              </div>

              {payments.length === 0 ? (
                <p className="text-sm text-gray-400">No payments recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-[#1e293b]">
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3">Reference</th>
                        <th className="py-2 pr-3">Amount</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2">Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-b border-[#1e293b]">
                          <td className="py-3 pr-3 text-gray-400">{new Date(payment.created_at).toLocaleDateString(language, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                          <td className="py-3 pr-3 font-mono text-xs text-gray-300">{payment.gateway_reference}</td>
                          <td className="py-3 pr-3">{formatCurrency(Number(payment.amount), payment.currency, language)}</td>
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
                              {payment.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 text-gray-400">{payment.payment_method || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
