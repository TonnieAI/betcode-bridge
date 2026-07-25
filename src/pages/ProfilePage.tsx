import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  User as UserIcon, Mail, Crown, Activity, Settings, Save,
  CheckCircle2, Zap, Calendar,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui';
import type { SubscriptionPlan } from '@/lib/types';

const PLAN_INFO: Record<SubscriptionPlan, { name: string; limit: number; price: string }> = {
  free: { name: 'Free', limit: 10, price: '₦0' },
  basic: { name: 'Basic', limit: 50, price: '₦2,500/mo' },
  pro: { name: 'Pro', limit: 500, price: '₦5,000/mo' },
  enterprise: { name: 'Enterprise', limit: 10000, price: 'Custom' },
};

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  if (!profile) {
    return <div className="pt-16 min-h-screen flex items-center justify-center"><LoadingSpinner label="Loading profile..." /></div>;
  }

  const planInfo = PLAN_INFO[profile.plan];

  return (
    <div className="pt-16 min-h-screen">
      <div className="section-padding py-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-8">Profile</h1>

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
                  {planInfo.name} Plan
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
                <p className="text-2xl font-bold">{new Date(profile.createdAt).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}</p>
                <p className="text-xs text-gray-500">Member since</p>
              </div>
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
                <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
                  {saving ? 'Saving...' : saved ? <><CheckCircle2 className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> Save Changes</>}
                </button>
              </div>
            </div>

            {/* Subscription */}
            <div className="card p-6">
              <div className="mb-4">
                <h3 className="font-semibold flex items-center gap-2"><Crown className="w-4 h-4 gold-text" /> Subscription & Plans</h3>
                <p className="text-xs text-gray-500 mt-1">Manage your current plan and see the available tiers from your account.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(Object.keys(PLAN_INFO) as SubscriptionPlan[]).map((plan) => {
                  const info = PLAN_INFO[plan];
                  const isCurrent = profile.plan === plan;
                  return (
                    <div key={plan} className={`p-4 rounded-lg border text-center ${isCurrent ? 'border-[#d4af37]/50 bg-[#d4af37]/5' : 'border-[#1e293b]'}`}>
                      <p className="text-sm font-semibold">{info.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{info.price}</p>
                      <p className="text-xs text-gray-500 mt-1">{info.limit} conv/mo</p>
                      {isCurrent && <span className="badge-gold mt-2 text-xs">Current</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
