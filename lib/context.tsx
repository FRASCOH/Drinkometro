'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Lang } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import type { Profile } from '@/lib/utils';

interface AppContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  currency: string;
  setCurrency: (currency: string) => void;
  user: any;
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
  t: (key: any) => string;
  loading: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('it');
  const [currency, setCurrency] = useState('EUR');
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Load preferences from localStorage
    const savedLang = localStorage.getItem('drinkometro_lang') as Lang;
    const savedCurrency = localStorage.getItem('drinkometro_currency');
    if (savedLang) setLang(savedLang);
    if (savedCurrency) setCurrency(savedCurrency);

    // Get initial auth state
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        loadProfile(user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data);
  };

  const handleSetLang = (newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem('drinkometro_lang', newLang);
  };

  const handleSetCurrency = (newCurrency: string) => {
    setCurrency(newCurrency);
    localStorage.setItem('drinkometro_currency', newCurrency);
  };

  const translate = (key: any) => t(key, lang);

  return (
    <AppContext.Provider value={{
      lang,
      setLang: handleSetLang,
      currency,
      setCurrency: handleSetCurrency,
      user,
      profile,
      setProfile,
      t: translate,
      loading,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
