import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { AuthError, Session, User } from '@supabase/supabase-js';

import { getScreenForPath } from '@/lib/appScreens';
import { isSuperAdminUser } from '@/lib/authz';
import { supabase } from '@/lib/supabase';
import { auditLogin, auditLogout } from '@/services/auditLog';
import { fetchUserAccess, type UserAccessGroup, type UserOrg } from '@/services/userAccess';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAccessLoading: boolean;
  accessError: string | null;
  isSuperAdmin: boolean;
  canInviteUsers: boolean;
  canManageUsers: boolean;
  userGroups: UserAccessGroup[];
  screenAccessIds: string[];
  /** Órgão primário do usuário autenticado */
  userOrg: UserOrg | null;
  canAccessScreen: (screenId: string) => boolean;
  canAccessPath: (pathname: string) => boolean;
  signInWithPassword: (email: string, password: string) => Promise<AuthError | null>;
  updatePassword: (password: string) => Promise<AuthError | null>;
  requestPasswordReset: (email: string, redirectTo?: string) => Promise<AuthError | null>;
  signOut: () => Promise<AuthError | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccessLoading, setIsAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [userGroups, setUserGroups] = useState<UserAccessGroup[]>([]);
  const [screenAccessIds, setScreenAccessIds] = useState<string[]>([]);
  const [userOrg, setUserOrg] = useState<UserOrg | null>(null);

  // Ref para saber se já registramos o login desta sessão (evita duplicatas)
  const lastAuditedSessionId = useRef<string | null>(null);

  const user = session?.user ?? null;
  const isSuperAdmin = isSuperAdminUser(user);

  // ── Inicialização e listener de estado de autenticação ──────────────────
  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) console.error('Falha ao recuperar sessao do Supabase', error);
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
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);

      // Registrar logout na trilha de auditoria
      if (event === 'SIGNED_OUT') {
        void auditLogout(null);
        lastAuditedSessionId.current = null;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── Carregamento das permissões e org após login ─────────────────────────
  useEffect(() => {
    let mounted = true;

    if (!user) {
      setUserGroups([]);
      setScreenAccessIds([]);
      setUserOrg(null);
      setAccessError(null);
      setIsAccessLoading(false);
      return;
    }

    setIsAccessLoading(true);
    setAccessError(null);

    fetchUserAccess(user, isSuperAdmin)
      .then((access) => {
        if (!mounted) return;
        setUserGroups(access.groups);
        setScreenAccessIds(access.screenIds);
        setUserOrg(access.org);

        // Registrar login na trilha de auditoria (apenas uma vez por sessão)
        const sessionId = session?.access_token?.slice(-16) ?? user.id;
        if (lastAuditedSessionId.current !== sessionId) {
          lastAuditedSessionId.current = sessionId;
          void auditLogin(access.org?.id ?? null);
        }
      })
      .catch((error) => {
        if (!mounted) return;
        console.error('Falha ao carregar permissoes do usuario', error);
        setUserGroups([]);
        setScreenAccessIds([]);
        setUserOrg(null);
        setAccessError(error instanceof Error ? error.message : 'Falha ao carregar permissões do usuário.');
      })
      .finally(() => {
        if (!mounted) return;
        setIsAccessLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user?.id, isSuperAdmin]);

  // ── Ações de autenticação ────────────────────────────────────────────────

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({
      password,
      data: { uses_default_password: false },
    });
    return error;
  };

  const requestPasswordReset = async (email: string, redirectTo?: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return error;
  };

  // ── Helpers de acesso ────────────────────────────────────────────────────

  const canAccessScreen = (screenId: string) => isSuperAdmin || screenAccessIds.includes(screenId);

  const canAccessPath = (pathname: string) => {
    const screen = getScreenForPath(pathname);
    if (!screen) return true;
    return canAccessScreen(screen.id);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isAuthenticated: Boolean(session),
        isLoading,
        isAccessLoading,
        accessError,
        isSuperAdmin,
        canInviteUsers: isSuperAdmin,
        canManageUsers: isSuperAdmin,
        userGroups,
        screenAccessIds,
        userOrg,
        canAccessScreen,
        canAccessPath,
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
