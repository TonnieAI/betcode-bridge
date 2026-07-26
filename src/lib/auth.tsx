import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { SubscriptionPlan, UserProfile } from './types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    username: string,
    options: { country: string; currency: string; language: 'en' | 'pt' | 'fr' }
  ) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PLAN_LIMITS: Record<SubscriptionPlan, number> = {
  free: 10,
  basic: 50,
  pro: 500,
  enterprise: 10000,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(u: User) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', u.id)
      .maybeSingle();

    if (error || !data) {
      setProfile(null);
      return;
    }

    setProfile({
      id: data.id,
      email: u.email ?? '',
      username: data.username,
      avatarUrl: data.avatar_url,
      country: data.country,
      currency: data.currency,
      language: data.language,
      plan: data.plan as SubscriptionPlan,
      conversionsThisMonth: data.conversions_this_month,
      conversionLimit: PLAN_LIMITS[data.plan as SubscriptionPlan] ?? data.conversion_limit,
      createdAt: data.created_at,
      role: data.role as 'user' | 'admin',
    });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadProfile(s.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadProfile(s.user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(
    email: string,
    password: string,
    username: string,
    options: { country: string; currency: string; language: 'en' | 'pt' | 'fr' }
  ) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          country: options.country,
          currency: options.currency,
          language: options.language,
        },
      },
    });
    if (error) return { error: error.message };
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username,
        country: options.country,
        currency: options.currency,
        language: options.language,
      });
    }
    return { error: null };
  }

  async function requestPasswordReset(email: string) {
    const configuredAppUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
    const appUrl = configuredAppUrl || window.location.origin;
    const redirectTo = `${appUrl.replace(/\/+$/, '')}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: error?.message ?? null };
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  async function refreshProfile() {
    if (user) await loadProfile(user);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signIn,
        signUp,
        requestPasswordReset,
        updatePassword,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
