import { Loader2, ShieldCheck } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { buildAuthRoute } from '@/lib/auth';

export function ProtectedRoute() {
  const location = useLocation();
  const { isAuthenticated, isLoading, isAccessLoading, accessError, canAccessPath } = useAuth();

  if (isLoading || (isAuthenticated && isAccessLoading)) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_48%,#ffffff_100%)] px-4 py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
          <div className="w-full rounded-[28px] border border-white/80 bg-white/90 px-8 py-12 text-center shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <div className="mt-5 space-y-2">
              <p className="text-lg font-semibold text-slate-900">Validando sessão</p>
              <p className="text-sm leading-6 text-slate-500">
                O Sistema Gerencial está confirmando sua autenticação e permissões.
              </p>
            </div>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Sessão persistente habilitada
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const nextPath = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={buildAuthRoute(nextPath)} replace />;
  }

  if (accessError) {
    return (
      <div className="min-h-screen bg-white px-4 py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
          <div className="w-full rounded-xl border border-border-default bg-white px-8 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="mt-5 space-y-2">
              <p className="text-lg font-semibold text-slate-900">Não foi possível carregar suas permissões</p>
              <p className="text-sm leading-6 text-slate-500">{accessError}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!canAccessPath(location.pathname)) {
    return (
      <div className="min-h-screen bg-white px-4 py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
          <div className="w-full rounded-xl border border-border-default bg-white px-8 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="mt-5 space-y-2">
              <p className="text-lg font-semibold text-slate-900">Acesso restrito</p>
              <p className="text-sm leading-6 text-slate-500">
                Seu grupo de usuários não possui permissão para acessar esta tela.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
