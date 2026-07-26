import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en from '@/locales/en.json';
import pt from '@/locales/pt.json';
import fr from '@/locales/fr.json';
import type { SupportedLanguage } from '@/lib/geo';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const MESSAGES: Record<SupportedLanguage, Record<string, string>> = { en, pt, fr };

interface I18nContextValue {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => Promise<void>;
  t: (key: string, fallback?: string) => string;
  formatDate: (value: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatCurrency: (amount: number, currency: string, options?: Intl.NumberFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const STORAGE_KEY = 'bcb:language';

function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
  if (value === 'pt' || value === 'fr') return value;
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user, profile, refreshProfile } = useAuth();
  const [language, setLanguageState] = useState<SupportedLanguage>(() => normalizeLanguage(localStorage.getItem(STORAGE_KEY)));

  useEffect(() => {
    if (!profile?.language) return;
    const next = normalizeLanguage(profile.language);
    setLanguageState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, [profile?.language]);

  const setLanguage = async (nextLanguage: SupportedLanguage) => {
    setLanguageState(nextLanguage);
    localStorage.setItem(STORAGE_KEY, nextLanguage);

    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ language: nextLanguage })
      .eq('id', user.id);

    if (!error) {
      await refreshProfile();
    }
  };

  const value = useMemo<I18nContextValue>(() => {
    const messages = MESSAGES[language] || MESSAGES.en;

    return {
      language,
      setLanguage,
      t: (key, fallback) => messages[key] || fallback || key,
      formatDate: (value, options) => {
        const date = value instanceof Date ? value : new Date(value);
        return new Intl.DateTimeFormat(language, options).format(date);
      },
      formatCurrency: (amount, currency, options) => {
        return new Intl.NumberFormat(language, {
          style: 'currency',
          currency,
          maximumFractionDigits: 2,
          ...options,
        }).format(amount);
      },
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}
