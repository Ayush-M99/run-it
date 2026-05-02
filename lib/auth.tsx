import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error?: string }>;
  startPreview: () => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const PREVIEW_SESSION = {
  access_token: 'preview-token',
  refresh_token: 'preview-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    app_metadata: {},
    user_metadata: { display_name: 'Preview Runner' },
    aud: 'authenticated',
    created_at: new Date(0).toISOString(),
    email: 'preview@run-it.local',
  },
} as unknown as Session;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthCtx = {
    session,
    loading,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message };
    },
    signUp: async (email, password, displayName) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });
      return { error: error?.message };
    },
    startPreview: () => {
      setSession(PREVIEW_SESSION);
    },
    signOut: async () => {
      if (session?.access_token === PREVIEW_SESSION.access_token) {
        setSession(null);
        return;
      }
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}
