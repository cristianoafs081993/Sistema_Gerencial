import { createContext, useContext, useEffect, useState } from 'react';
import type { AuthError, Session, User } from '@supabase/supabase-js';

import { isSuperAdminUser } from '@/lib/authz';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSuperAdmin: boolean;
  canInviteUsers: boolean;
  signInWithPassword: (email: string, password: string) => Promise<AuthError | null>;
  updatePassword: (password: string) => Promise<AuthError | null>;
  requestPasswordReset: (email: string, redirectTo?: string) => Promise<AuthError | null>;
  signOut: () => Promise<AuthError | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const user = session?.user ?? null;
  const isSuperAdmin = isSuperAdminUser(user);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;

        if (error) {
          console.error('Falha ao recuperar sessao do Supabase', error);
        }

        setSession(data.session);
        setIsLoading(false);
      })
      .catch((error) => {
        if (!mounted) return;

        console.error('Falha inesperada ao recuperar sessao do Supabase', error);
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return error;
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return error;
  };

  const requestPasswordReset = async (email: string, redirectTo?: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    return error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return error;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isAuthenticated: Boolean(session),
        isLoading,
        isSuperAdmin,
        canInviteUsers: isSuperAdmin,
        signInWithPassword,
        updatePassword,
        requestPasswordReset,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de AuthProvider.');
  }

  return context;
}
