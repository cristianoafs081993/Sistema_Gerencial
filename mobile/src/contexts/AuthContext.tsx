import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchAppAccess, type AppAccess } from '../services/access';

type AuthStatus = 'loading' | 'signedOut' | 'loadingAccess' | 'denied' | 'error' | 'ready';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  access: AppAccess | null;
  errorMessage: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  retryAccess: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function translateAuthError(message?: string | null): string {
  const text = (message || '').toLowerCase();
  if (text.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (text.includes('email not confirmed')) return 'Este e-mail ainda não foi confirmado.';
  if (text.includes('too many requests') || text.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  if (text.includes('network') || text.includes('fetch')) {
    return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
  }
  return 'Não foi possível entrar agora. Tente novamente.';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [access, setAccess] = useState<AppAccess | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const loadedForUser = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setSessionLoaded(true);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!user) {
      loadedForUser.current = null;
      setAccess(null);
      setAccessError(null);
      setAccessLoading(false);
      return;
    }
    const key = `${user.id}:${retryToken}`;
    if (loadedForUser.current === key) return;
    loadedForUser.current = key;

    let cancelled = false;
    setAccessLoading(true);
    setAccessError(null);
    fetchAppAccess(user)
      .then((result) => {
        if (!cancelled) setAccess(result);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Falha ao carregar permissões', error);
        setAccess(null);
        setAccessError('Não foi possível carregar suas permissões.');
      })
      .finally(() => {
        if (!cancelled) setAccessLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `user` é derivado de `session`; o id e o retryToken definem quando recarregar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, retryToken]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? translateAuthError(error.message) : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const retryAccess = useCallback(() => setRetryToken((value) => value + 1), []);

  const status: AuthStatus = !sessionLoaded
    ? 'loading'
    : !user
      ? 'signedOut'
      : accessLoading || (!access && !accessError)
        ? 'loadingAccess'
        : accessError
          ? 'error'
          : access && access.tabs.length === 0
            ? 'denied'
            : 'ready';

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, access, errorMessage: accessError, signIn, signOut, retryAccess }),
    [status, user, access, accessError, signIn, signOut, retryAccess],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}
